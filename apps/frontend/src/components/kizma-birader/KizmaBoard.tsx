'use client';

import React, { useMemo, useEffect, useRef, useState } from 'react';
import type { KizmaColor, KizmaGameState, KizmaMove } from './types';
import { COLOR_HEX, BOARD_TINT } from './types';
import {
  GRID, RING_COORDS, HOME_PATH, YARD_BOX, YARD_SLOTS, START_OFFSET, SAFE_GLOBAL,
  posToCoord, GOAL_POS,
} from './boardLayout';

const START_GLOBAL = new Set(Object.values(START_OFFSET));

function colorOfStartGlobal(g: number): KizmaColor | null {
  for (const c of Object.keys(START_OFFSET) as KizmaColor[]) {
    if (START_OFFSET[c] === g) return c;
  }
  return null;
}

/** Geometrik 5 köşeli yıldız — font glifi değil (bkz. 630dfa4 boyut sorunu). */
function starPoints(cx: number, cy: number, ro = 0.36, ri = 0.15): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? ro : ri;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`);
  }
  return pts.join(' ');
}

// Ev sütunu giriş hücresindeki (HOME_PATH[c][0]) merkeze bakan beyaz ok.
const HOME_ARROW: Record<KizmaColor, string> = {
  red: '1.28,7.2 1.78,7.5 1.28,7.8',
  blue: '7.2,1.28 7.8,1.28 7.5,1.78',
  yellow: '13.72,7.2 13.22,7.5 13.72,7.8',
  white: '7.2,13.72 7.8,13.72 7.5,13.22',
};

interface Props {
  state: KizmaGameState;
  myColor: KizmaColor | null;
  legalMoves: KizmaMove[];
  isMyTurn: boolean;
  onTokenClick: (color: KizmaColor, tokenId: number) => void;
  onStepSound?: () => void;
}

export function KizmaBoard({ state, myColor, legalMoves, isMyTurn, onTokenClick, onStepSound }: Props) {
  const movableTokenIds = useMemo(() => {
    if (!isMyTurn) return new Set<number>();
    return new Set(legalMoves.map((m) => m.tokenId));
  }, [legalMoves, isMyTurn]);

  // ── Step-by-step piyon animasyonu ─────────────────────────────────────────
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    state.players.forEach((p) => p.tokens.forEach((t) => { init[`${p.color}-${t.id}`] = t.pos; }));
    return init;
  });
  const prevStateRef = useRef<KizmaGameState>(state);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    state.players.forEach((player) => {
      player.tokens.forEach((token) => {
        const key = `${player.color}-${token.id}`;
        const prevToken = prev.players
          .find((p) => p.color === player.color)?.tokens.find((t) => t.id === token.id);
        const prevPos = prevToken?.pos ?? -1;
        const nextPos = token.pos;

        if (prevPos === nextPos) return;

        // Yard'dan çıkış (pos: -1 → 0)
        if (prevPos < 0) {
          setDisplayPositions((dp) => ({ ...dp, [key]: prevPos }));
          const t1 = setTimeout(() => {
            setDisplayPositions((dp) => ({ ...dp, [key]: nextPos }));
            onStepSound?.();
          }, 80);
          timeoutsRef.current.push(t1);
          return;
        }

        // Home stretch'e giriş veya goal'a ulaşma — direkt
        if (nextPos >= 52) {
          setDisplayPositions((dp) => ({ ...dp, [key]: prevPos }));
          const steps = nextPos - prevPos;
          for (let s = 1; s <= steps; s++) {
            const stepPos = prevPos + s;
            const delay = s * 130;
            const t = setTimeout(() => {
              setDisplayPositions((dp) => ({ ...dp, [key]: Math.min(stepPos, GOAL_POS) }));
              if (s < steps) onStepSound?.();
            }, delay);
            timeoutsRef.current.push(t);
          }
          return;
        }

        // Normal halka adımları
        const steps = nextPos - prevPos;
        if (steps <= 0) {
          setDisplayPositions((dp) => ({ ...dp, [key]: nextPos }));
          return;
        }
        setDisplayPositions((dp) => ({ ...dp, [key]: prevPos }));
        for (let s = 1; s <= steps; s++) {
          const stepPos = prevPos + s;
          const delay = s * 130;
          const t = setTimeout(() => {
            setDisplayPositions((dp) => ({ ...dp, [key]: stepPos % 52 === 0 && stepPos !== 0 ? 51 : stepPos }));
            if (s < steps) onStepSound?.();
          }, delay);
          timeoutsRef.current.push(t);
        }
      });
    });

    return () => { timeoutsRef.current.forEach(clearTimeout); };
  }, [state, onStepSound]);

  // ── Token node'ları displayPositions'a göre hesapla ──────────────────────
  const tokenNodes = useMemo(() => {
    type Node = { color: KizmaColor; id: number; x: number; y: number; movable: boolean };
    const raw = state.players.flatMap((p) =>
      p.tokens.map((t) => {
        const key = `${p.color}-${t.id}`;
        const displayPos = displayPositions[key] ?? t.pos;
        const c = posToCoord(p.color, displayPos, t.id);
        return { color: p.color, id: t.id, x: c.x, y: c.y, pos: displayPos };
      }),
    );
    const groups = new Map<string, typeof raw>();
    for (const r of raw) {
      const gKey = r.pos < 0 ? `yard-${r.color}-${r.id}` : `${r.x.toFixed(2)},${r.y.toFixed(2)}`;
      const arr = groups.get(gKey) ?? [];
      arr.push(r);
      groups.set(gKey, arr);
    }
    const nodes: Node[] = [];
    for (const arr of groups.values()) {
      const n = arr.length;
      arr.forEach((r, i) => {
        let { x, y } = r;
        if (n > 1) {
          const ang = (Math.PI * 2 * i) / n;
          x += Math.cos(ang) * 0.16;
          y += Math.sin(ang) * 0.16;
        }
        nodes.push({
          color: r.color,
          id: r.id,
          x,
          y,
          movable: r.color === myColor && movableTokenIds.has(r.id),
        });
      });
    }
    return nodes;
  }, [state.players, myColor, movableTokenIds, displayPositions]);

  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      width="100%"
      height="100%"
      style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', touchAction: 'manipulation' }}
      role="img"
      aria-label="Kızma Birader tahtası"
    >
      <defs>
        {(['red', 'blue', 'yellow', 'white'] as KizmaColor[]).map((c) => (
          <radialGradient key={`tk-${c}`} id={`kb-tok-${c}`} cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        ))}
        {/* Çeyreklerin üstüne ince ışık geçişi */}
        <linearGradient id="kb-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        {/* Yumuşak gölge — yard daireleri ve merkez */}
        <filter id="kb-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.06" stdDeviation="0.1" floodColor="#000000" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Zemin */}
      <rect x={0} y={0} width={GRID} height={GRID} rx={0.6} fill="#f6f4ee" stroke="#3a4150" strokeWidth={0.1} />

      {/* Yard kutuları — yumuşak renkli çeyrek + gölgeli beyaz daire + soket slotlar */}
      {(Object.keys(YARD_BOX) as KizmaColor[]).map((c) => {
        const b = YARD_BOX[c];
        return (
          <g key={`yard-${c}`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.3} fill={BOARD_TINT[c]} />
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.3} fill="url(#kb-sheen)" />
            <circle cx={b.x + 3} cy={b.y + 3} r={2.45} fill="#ffffff" filter="url(#kb-soft)" />
            <circle cx={b.x + 3} cy={b.y + 3} r={2.45} fill="none" stroke={BOARD_TINT[c]} strokeWidth={0.07} opacity={0.5} />
            {YARD_SLOTS[c].map((s, i) => (
              <circle
                key={`slot-${c}-${i}`}
                cx={s.x} cy={s.y} r={0.55}
                fill={BOARD_TINT[c]} fillOpacity={0.28}
                stroke={BOARD_TINT[c]} strokeWidth={0.07} strokeOpacity={0.6}
              />
            ))}
          </g>
        );
      })}

      {/* Halka hücreleri — bitişik, köşesiz kareler */}
      {RING_COORDS.map((c, g) => {
        const isStart = START_GLOBAL.has(g);
        const isSafe = SAFE_GLOBAL.has(g);
        const startColor = isStart ? colorOfStartGlobal(g) : null;
        return (
          <g key={`ring-${g}`}>
            <rect
              x={c.x}
              y={c.y}
              width={1}
              height={1}
              fill={startColor ? BOARD_TINT[startColor] : '#ffffff'}
              stroke="#cfd5de"
              strokeWidth={0.035}
            />
            {isSafe && !isStart && (
              <polygon
                points={starPoints(c.x + 0.5, c.y + 0.5)}
                fill="#d3d9e2"
                stroke="#aab2bf"
                strokeWidth={0.03}
                strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}

      {/* Ev sütunları — bitişik kareler + giriş oku */}
      {(Object.keys(HOME_PATH) as KizmaColor[]).map((c) => (
        <g key={`home-${c}`}>
          {HOME_PATH[c].map((cell, i) => (
            <rect
              key={`home-${c}-${i}`}
              x={cell.x}
              y={cell.y}
              width={1}
              height={1}
              fill={BOARD_TINT[c]}
              stroke="#cfd5de"
              strokeWidth={0.035}
            />
          ))}
          <polygon points={HOME_ARROW[c]} fill="#ffffff" opacity={0.9} />
        </g>
      ))}

      {/* Merkez goal — 4 üçgen */}
      <g filter="url(#kb-soft)">
        <polygon points="6,6 9,6 7.5,7.5" fill={BOARD_TINT.blue} stroke="#ffffff" strokeWidth={0.1} />
        <polygon points="9,6 9,9 7.5,7.5" fill={BOARD_TINT.yellow} stroke="#ffffff" strokeWidth={0.1} />
        <polygon points="9,9 6,9 7.5,7.5" fill={BOARD_TINT.white} stroke="#ffffff" strokeWidth={0.1} />
        <polygon points="6,9 6,6 7.5,7.5" fill={BOARD_TINT.red} stroke="#ffffff" strokeWidth={0.1} />
        <rect x={6} y={6} width={3} height={3} fill="none" stroke="#3a4150" strokeWidth={0.05} />
      </g>

      {/* Taşlar */}
      {tokenNodes.map((n) => {
        const fill = COLOR_HEX[n.color];
        return (
          <g
            key={`tok-${n.color}-${n.id}`}
            onClick={() => n.movable && onTokenClick(n.color, n.id)}
            style={{ cursor: n.movable ? 'pointer' : 'default' }}
          >
            {n.movable && (
              <circle cx={n.x} cy={n.y} r={0.46} fill="none" stroke="#22c55e" strokeWidth={0.12}>
                <animate attributeName="r" values="0.40;0.50;0.40" dur="1.1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.45;1" dur="1.1s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Taşın altında merkezli yumuşak gölge */}
            <ellipse cx={n.x} cy={n.y + 0.3} rx={0.26} ry={0.1} fill="rgba(0,0,0,0.20)" />
            <circle cx={n.x} cy={n.y} r={0.34} fill={fill} stroke="#ffffff" strokeWidth={0.07} />
            {/* Işık */}
            <circle cx={n.x} cy={n.y} r={0.32} fill={`url(#kb-tok-${n.color})`} />
            <circle cx={n.x} cy={n.y - 0.08} r={0.11} fill="#ffffff" opacity={0.45} />
          </g>
        );
      })}
    </svg>
  );
}
