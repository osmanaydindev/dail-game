import { DailyEntry } from '../models/DailyEntry';
import type { PipelineStage } from 'mongoose';
import type { LeaderboardEntry, DailyLeaderboard } from '@dail-game/types';
import type { GameSlug } from '@dail-game/types';
import { SCORE_WEIGHTS } from '../config/gameConfig';

interface EntryWithUser {
  _id: string;
  userId: { _id: string; username: string; displayName: string; avatarUrl?: string };
  gameSlug: GameSlug;
  scores: Record<string, number>;
  normalizedScore: number;
  createdAt: Date;
}

function toLeaderboardEntry(entry: EntryWithUser, rank: number): LeaderboardEntry {
  return {
    rank,
    userId: entry.userId._id.toString(),
    username: entry.userId.username,
    displayName: entry.userId.displayName,
    avatarUrl: entry.userId.avatarUrl,
    normalizedScore: entry.normalizedScore,
    rawScores: entry.scores as any,
    gameSlug: entry.gameSlug,
  };
}

export async function getDailyLeaderboard(date: string): Promise<DailyLeaderboard> {
  const entries = await DailyEntry.find({ date })
    .populate<{ userId: { _id: string; username: string; displayName: string; avatarUrl?: string } }>('userId', 'username displayName avatarUrl')
    .sort({ normalizedScore: -1, createdAt: 1 })
    .lean() as unknown as EntryWithUser[];

  const wordleEntries = entries.filter((e) => e.gameSlug === 'wordle');
  const parollaEntries = entries.filter((e) => e.gameSlug === 'parolla');

  const userMap = new Map<string, { wordle: number; parolla: number; username: string; displayName: string; avatarUrl?: string; earliestEntry: Date }>();

  for (const e of entries) {
    const uid = e.userId._id.toString();
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        wordle: 0,
        parolla: 0,
        username: e.userId.username,
        displayName: e.userId.displayName,
        avatarUrl: e.userId.avatarUrl,
        earliestEntry: e.createdAt,
      });
    }
    const u = userMap.get(uid)!;
    if (e.gameSlug === 'wordle') u.wordle = e.normalizedScore;
    if (e.gameSlug === 'parolla') u.parolla = e.normalizedScore;
    if (e.createdAt < u.earliestEntry) u.earliestEntry = e.createdAt;
  }

  const totalEntries: LeaderboardEntry[] = Array.from(userMap.entries())
    .map(([uid, u]) => ({
      rank: 0,
      userId: uid,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      normalizedScore: parseFloat(
        ((u.wordle * SCORE_WEIGHTS.wordle) + (u.parolla * SCORE_WEIGHTS.parolla)).toFixed(4),
      ),
    }))
    .sort((a, b) => b.normalizedScore - a.normalizedScore)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return {
    date,
    wordle: wordleEntries.map(toLeaderboardEntry).map((e, i) => ({ ...e, rank: i + 1 })),
    parolla: parollaEntries.map(toLeaderboardEntry).map((e, i) => ({ ...e, rank: i + 1 })),
    total: totalEntries,
  };
}

export async function getPeriodLeaderboard(
  dateFilter: Record<string, unknown>,
  gameSlug?: GameSlug,
): Promise<LeaderboardEntry[]> {
  const matchStage: Record<string, unknown> = { ...dateFilter };
  if (gameSlug) matchStage.gameSlug = gameSlug;

  // Per-game tab: plain average of that game's own normalized scores.
  // Total tab: rebuild each day's weighted daily score first, then average the days —
  // otherwise a user who only plays one game gets averaged on a different scale than
  // the daily leaderboard uses.
  const groupStages: PipelineStage[] = gameSlug
    ? [
        {
          $group: {
            _id: '$userId',
            avgScore: { $avg: '$normalizedScore' },
            entryCount: { $sum: 1 },
            earliestEntry: { $min: '$createdAt' },
          },
        },
      ]
    : [
        {
          $group: {
            _id: { userId: '$userId', date: '$date' },
            wordle: { $sum: { $cond: [{ $eq: ['$gameSlug', 'wordle'] }, '$normalizedScore', 0] } },
            parolla: { $sum: { $cond: [{ $eq: ['$gameSlug', 'parolla'] }, '$normalizedScore', 0] } },
            earliestEntry: { $min: '$createdAt' },
          },
        },
        {
          $addFields: {
            dailyScore: {
              $add: [
                { $multiply: ['$wordle', SCORE_WEIGHTS.wordle] },
                { $multiply: ['$parolla', SCORE_WEIGHTS.parolla] },
              ],
            },
          },
        },
        {
          $group: {
            _id: '$_id.userId',
            avgScore: { $avg: '$dailyScore' },
            entryCount: { $sum: 1 },
            earliestEntry: { $min: '$earliestEntry' },
          },
        },
      ];

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    ...groupStages,
    { $sort: { avgScore: -1, earliestEntry: 1 } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        userId: '$_id',
        username: '$user.username',
        displayName: '$user.displayName',
        avatarUrl: '$user.avatarUrl',
        normalizedScore: { $round: ['$avgScore', 4] },
        entryCount: 1,
      },
    },
  ];

  const results = await DailyEntry.aggregate(pipeline);
  return results.map((r, i) => ({ ...r, rank: i + 1, userId: r.userId.toString() }));
}
