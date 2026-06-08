'use client';

import React, { useMemo, useEffect, useRef, useState } from 'react';
import type { KizmaColor, KizmaGameState, KizmaMove } from './types';
import { COLOR_HEX } from './types';
import {
  GRID, RING_COORDS, HOME_PATH, YARD_BOX, START_OFFSET, SAFE_GLOBAL,
  posToCoord, GOAL_POS,
} from './boardLayout';

const START_GLOBAL = new Set(Object.values(START_OFFSET));

function colorOfStartGlobal(g: number): KizmaColor | null {
  for (const c of Object.keys(START_OFFSET) as KizmaColor[]) {
    if (START_OFFSET[c] === g) return c;
  }
  return null;
}

// ── Zar yüzü — noktalı SVG ───────────────────────────────────────────────────
function DieFace({ value, size = 44 }: { value: number; size?: number }) {
  const dots: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-0.28, -0.28], [0.28, 0.28]],
    3: [[-0.28, -0.28], [0, 0], [0.28, 0.28]],
    4: [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]],
    5: [[-0.28, -0.28], [0.28, -0.28], [0, 0], [-0.28, 0.28], [0.28, 0.28]],
    6: [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0], [0.28, 0], [-0.28, 0.28], [0.28, 0.28]],
  };
  const d = dots[value] ?? dots[1];
  return (
    <svg viewBox="-0.6 -0.6 1.2 1.2" width={size} height={size}>
      <rect x="-0.58" y="-0.58" width="1.16" height="1.16" rx="0.2" fill="white" />
      <rect x="-0.55" y="-0.55" width="1.1" height="1.1" rx="0.18" fill="none" stroke="#d0d5de" strokeWidth="0.04" />
      {d.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.11} fill="#1a2035" />
      ))}
    </svg>
  );
}

interface Props {
  state: KizmaGameState;
  myColor: KizmaColor | null;
  legalMoves: KizmaMove[];
  isMyTurn: boolean;
  onTokenClick: (color: KizmaColor, tokenId: number) => void;
  animDie: number | null;
  onStepSound?: () => void;
}

export function KizmaBoard({ state, myColor, legalMoves, isMyTurn, onTokenClick, animDie, onStepSound }: Props) {
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

  const dieFace = animDie ?? state.dice;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        viewBox={`0 0 ${GRID} ${GRID}`}
        width="100%"
        height="100%"
        style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', touchAction: 'manipulation' }}
        role="img"
        aria-label="Kızma Birader tahtası"
      >
        <defs>
          <linearGradient id="kb-bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#1e2840" />
            <stop offset="100%" stopColor="#0d1420" />
          </linearGradient>
          {(['red', 'blue', 'yellow', 'white'] as KizmaColor[]).map((c) => (
            <radialGradient key={`yd-${c}`} id={`kb-yard-${c}`} cx="40%" cy="40%" r="65%">
              <stop offset="0%" stopColor={COLOR_HEX[c]} stopOpacity="0.95" />
              <stop offset="100%" stopColor={COLOR_HEX[c]} stopOpacity="0.5" />
            </radialGradient>
          ))}
          {(['red', 'blue', 'yellow', 'white'] as KizmaColor[]).map((c) => (
            <radialGradient key={`tk-${c}`} id={`kb-tok-${c}`} cx="35%" cy="30%" r="60%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          ))}
        </defs>

        {/* Zemin gradyan */}
        <rect x={0} y={0} width={GRID} height={GRID} fill="url(#kb-bg)" />

        {/* Yard kutuları */}
        {(Object.keys(YARD_BOX) as KizmaColor[]).map((c) => {
          const b = YARD_BOX[c];
          return (
            <g key={`yard-${c}`}>
              <rect x={b.x + 0.15} y={b.y + 0.15} width={b.w - 0.3} height={b.h - 0.3} rx={0.6}
                fill={`url(#kb-yard-${c})`} />
              <rect x={b.x + 1.0} y={b.y + 1.0} width={b.w - 2.0} height={b.h - 2.0} rx={0.45}
                fill="#0e1319" opacity={0.82} />
              <rect x={b.x + 0.15} y={b.y + 0.15} width={b.w - 0.3} height={b.h - 0.3} rx={0.6}
                fill="none" stroke={COLOR_HEX[c]} strokeWidth={0.1} opacity={0.6} />
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
              <rect x={c.x + 0.05} y={c.y + 0.05} width={0.9} height={0.9} rx={0.12}
                fill={startColor ? COLOR_HEX[startColor] : '#dde3ef'}
                stroke="#0e1319" strokeWidth={0.04} />
              {isSafe && !isStart && (
                <circle cx={c.x + 0.5} cy={c.y + 0.5} r={0.19} fill="none" stroke="#8892a8" strokeWidth={0.06} />
              )}
            </g>
          );
        })}

        {/* Ev sütunları */}
        {(Object.keys(HOME_PATH) as KizmaColor[]).flatMap((c) =>
          HOME_PATH[c].map((cell, i) => (
            <rect key={`home-${c}-${i}`}
              x={cell.x + 0.05} y={cell.y + 0.05} width={0.9} height={0.9} rx={0.12}
              fill={COLOR_HEX[c]} opacity={0.88} stroke="#0e1319" strokeWidth={0.04} />
          )),
        )}

        {/* Merkez — 4 üçgen + yıldız */}
        <g>
          <polygon points="6,6 9,6 7.5,7.5" fill={COLOR_HEX.blue} opacity={0.95} />
          <polygon points="9,6 9,9 7.5,7.5" fill={COLOR_HEX.yellow} opacity={0.95} />
          <polygon points="9,9 6,9 7.5,7.5" fill={COLOR_HEX.white} opacity={0.95} />
          <polygon points="6,9 6,6 7.5,7.5" fill={COLOR_HEX.red} opacity={0.95} />
          <rect x={6} y={6} width={3} height={3} fill="none" stroke="#0e1319" strokeWidth={0.05} />
          <rect x={6.8} y={6.8} width={1.4} height={1.4} rx={0.3} fill="#ffd700" opacity={0.95} stroke="#c8a200" strokeWidth={0.06} />
          <text x={7.5} y={7.67} textAnchor="middle" fontSize={0.75} fontWeight="bold"
            fill="#0e1319" fontFamily="serif">★</text>
        </g>

        {/* Taşlar */}
        {tokenNodes.map((n) => {
          const fill = COLOR_HEX[n.color];
          const isWhiteColor = n.color === 'white';
          return (
            <g key={`tok-${n.color}-${n.id}`}
              onClick={() => n.movable && onTokenClick(n.color, n.id)}
              style={{ cursor: n.movable ? 'pointer' : 'default' }}
            >
              {n.movable && (
                <circle cx={n.x} cy={n.y} r={0.46} fill="none" stroke="#22c55e" strokeWidth={0.1} opacity={0.85}>
                  <animate attributeName="r" values="0.40;0.50;0.40" dur="1.1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Gölge */}
              <circle cx={n.x + 0.04} cy={n.y + 0.07} r={0.3} fill="rgba(0,0,0,0.4)" />
              {/* Gövde */}
              <circle cx={n.x} cy={n.y} r={0.3} fill={fill}
                stroke={isWhiteColor ? '#2a303d' : '#0e1319'}
                strokeWidth={isWhiteColor ? 0.08 : 0.06} />
              {/* Işık */}
              <circle cx={n.x} cy={n.y} r={0.3} fill={`url(#kb-tok-${n.color})`} />
              {/* Merkez nokta */}
              <circle cx={n.x} cy={n.y} r={0.09}
                fill={isWhiteColor ? '#4a5568' : 'rgba(255,255,255,0.45)'} />
            </g>
          );
        })}
      </svg>

      {/* Zar — tahta ortasına yüzen */}
      {dieFace != null && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 10,
          filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.6))',
        }}>
          <DieFace value={dieFace} size={56} />
        </div>
      )}
    </div>
  );
}
