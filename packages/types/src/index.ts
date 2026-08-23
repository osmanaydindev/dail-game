// ─── Shared enums ────────────────────────────────────────────────────────────

export type Role = 'admin' | 'user';

export type GameSlug = 'wordle' | 'parolla';

/**
 * Weights for the combined daily score. Shared so the frontend can preview a
 * score without re-deriving numbers the backend owns — if these drift, the
 * home page and the leaderboard disagree.
 */
export const SCORE_WEIGHTS: Record<GameSlug, number> = {
  wordle: 0.4,
  parolla: 0.6,
};

// ─── API response envelope ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserPublic {
  _id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: Role;
  createdAt: string;
}

export interface UserSelf extends UserPublic {
  email: string;
  emailVerified?: boolean;
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export interface ScoreField {
  name: string;
  type: 'number' | 'boolean';
  label: string;
  min?: number;
  max?: number;
}

export interface GamePublic {
  _id: string;
  slug: GameSlug;
  name: string;
  officialUrl: string;
  scoreFields: ScoreField[];
  isActive: boolean;
}

// ─── Daily Entry ──────────────────────────────────────────────────────────────

export type WordleScores = {
  attempt: number; // 1–6; 7 = DNF
};

export type ParollaScores = {
  correct: number;
  wrong: number;
  blank: number;
};

export type GameScores = WordleScores | ParollaScores;

export interface DailyEntryPublic {
  _id: string;
  userId: string;
  userDisplayName: string;
  gameId: string;
  gameSlug: GameSlug;
  date: string; // YYYY-MM-DD
  scores: GameScores;
  normalizedScore: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  normalizedScore: number;
  rawScores?: GameScores;
  gameSlug?: GameSlug;
}

export interface DailyLeaderboard {
  date: string;
  wordle: LeaderboardEntry[];
  parolla: LeaderboardEntry[];
  total: LeaderboardEntry[];
}

export interface PeriodLeaderboard {
  period: string;
  entries: LeaderboardEntry[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserSelf;
  accessToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  displayName: string;
  locale?: 'tr' | 'en';
}

/** `error` value returned by POST /auth/login when the account is unverified. */
export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface CreateUserRequest {
  email: string;
  password: string;
  username: string;
  displayName: string;
  role?: Role;
}

export interface UpdateUserRequest {
  displayName?: string;
  avatarUrl?: string;
  role?: Role;
}
