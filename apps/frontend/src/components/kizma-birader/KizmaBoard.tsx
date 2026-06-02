'use client';

import React, { useMemo } from 'react';
import type { KizmaColor, KizmaGameState, KizmaMove } from './types';
import { COLOR_HEX } from './types';
import {
  GRID, RING_COORDS, HOME_PATH, YARD_BOX, START_OFFSET, SAFE_GLOBAL,
  posToCoord,
} from './boardLayout';

const START_GLOBAL = new Set(Object.values(START_OFFSET)); // {0,13,26,39}

function colorOfStartGlobal(g: number): KizmaColor | null {
  for (const c of Object.keys(START_OFFSET) as KizmaColor[]) {
    if (START_OFFSET[c] === g) return c;
  }
  return null;
}

interface Props {
  state: KizmaGameState;
  myColor: KizmaColor | null;
  legalMoves: KizmaMove[];
  isMyTurn: boolean;
  onTokenClick: (color: KizmaColor, tokenId: number) => void;
}

export function KizmaBoard({ state, myColor, legalMoves, isMyTurn, onTokenClick }: Props) {
  const movableTokenIds = useMemo(() => {
    if (!isMyTurn) return new Set<number>();
    return new Set(legalMoves.map((m) => m.tokenId));
  }, [legalMoves, isMyTurn]);

  // Tüm taşları topla; aynı hücrede yığılanları hafifçe dağıt.
  const tokenNodes = useMemo(() => {
    type Node = { color: KizmaColor; id: number; x: number; y: number; movable: boolean };
    const raw = state.players.flatMap((p) =>
      p.tokens.map((t) => {
        const c = posToCoord(p.color, t.pos, t.id);
        return { color: p.color, id: t.id, x: c.x, y: c.y, pos: t.pos };
      }),
    );
    // Gruplama (yard hariç; yard zaten ayrı slot)
    const groups = new Map<string, typeof raw>();
    for (const r of raw) {
      const key = r.pos < 0 ? `yard-${r.color}-${r.id}` : `${r.x.toFixed(2)},${r.y.toFixed(2)}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    const nodes: Node[] = [];
    for (const arr of groups.values()) {
      const n = arr.length;
      arr.forEach((r, i) => {
        let { x, y } = r;
        if (n > 1) {
          const ang = (Math.PI * 2 * i) / n;
          const rad = 0.16;
          x += Math.cos(ang) * rad;
          y += Math.sin(ang) * rad;
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
  }, [state.players, myColor, movableTokenIds]);

  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      width="100%"
      height="100%"
      style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', touchAction: 'manipulation' }}
      role="img"
      aria-label="Kızma Birader tahtası"
    >
      {/* Zemin */}
      <rect x={0} y={0} width={GRID} height={GRID} rx={0.6} fill="#11161d" />

      {/* Yard kutuları */}
      {(Object.keys(YARD_BOX) as KizmaColor[]).map((c) => {
        const b = YARD_BOX[c];
        return (
          <g key={`yard-${c}`}>
            <rect x={b.x + 0.2} y={b.y + 0.2} width={b.w - 0.4} height={b.h - 0.4} rx={0.5} fill={COLOR_HEX[c]} opacity={0.9} />
            <rect x={b.x + 1.1} y={b.y + 1.1} width={b.w - 2.2} height={b.h - 2.2} rx={0.4} fill="#0e1319" opacity={0.85} />
          </g>
        );
      })}

      {/* Halka hücreleri */}
      {RING_COORDS.map((c, g) => {
        const isStart = START_GLOBAL.has(g);
        const isSafe = SAFE_GLOBAL.has(g);
        const startColor = isStart ? colorOfStartGlobal(g) : null;
        return (
          <g key={`ring-${g}`}>
            <rect
              x={c.x + 0.06}
              y={c.y + 0.06}
              width={0.88}
              height={0.88}
              rx={0.14}
              fill={startColor ? COLOR_HEX[startColor] : '#e9ecf2'}
              stroke="#0e1319"
              strokeWidth={0.05}
            />
            {isSafe && !isStart && (
              <circle cx={c.x + 0.5} cy={c.y + 0.5} r={0.2} fill="none" stroke="#7c8597" strokeWidth={0.07} />
            )}
          </g>
        );
      })}

      {/* Ev sütunları */}
      {(Object.keys(HOME_PATH) as KizmaColor[]).flatMap((c) =>
        HOME_PATH[c].map((cell, i) => (
          <rect
            key={`home-${c}-${i}`}
            x={cell.x + 0.06}
            y={cell.y + 0.06}
            width={0.88}
            height={0.88}
            rx={0.14}
            fill={COLOR_HEX[c]}
            opacity={0.85}
            stroke="#0e1319"
            strokeWidth={0.05}
          />
        )),
      )}

      {/* Merkez goal — 4 üçgen */}
      <g>
        <polygon points="6,6 9,6 7.5,7.5" fill={COLOR_HEX.blue} opacity={0.95} />
        <polygon points="9,6 9,9 7.5,7.5" fill={COLOR_HEX.yellow} opacity={0.95} />
        <polygon points="9,9 6,9 7.5,7.5" fill={COLOR_HEX.white} opacity={0.95} />
        <polygon points="6,9 6,6 7.5,7.5" fill={COLOR_HEX.red} opacity={0.95} />
        <rect x={6} y={6} width={3} height={3} fill="none" stroke="#0e1319" strokeWidth={0.06} />
      </g>

      {/* Taşlar */}
      {tokenNodes.map((n) => {
        const fill = COLOR_HEX[n.color];
        const isWhite = n.color === 'white';
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
            <circle cx={n.x} cy={n.y} r={0.34} fill={fill} stroke={isWhite ? '#1a1f27' : '#0e1319'} strokeWidth={isWhite ? 0.1 : 0.08} />
            <circle cx={n.x} cy={n.y - 0.08} r={0.12} fill="#ffffff" opacity={isWhite ? 0.5 : 0.35} />
          </g>
        );
      })}
    </svg>
  );
}
