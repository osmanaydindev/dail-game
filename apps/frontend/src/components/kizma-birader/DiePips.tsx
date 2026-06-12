'use client';

import React from 'react';

// Pip (nokta) düzenleri — 24x24 viewBox üzerinde.
const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[7.5, 7.5], [16.5, 16.5]],
  3: [[7.5, 7.5], [12, 12], [16.5, 16.5]],
  4: [[7.5, 7.5], [16.5, 7.5], [7.5, 16.5], [16.5, 16.5]],
  5: [[7.5, 7.5], [16.5, 7.5], [12, 12], [7.5, 16.5], [16.5, 16.5]],
  6: [[7.5, 7.5], [16.5, 7.5], [7.5, 12], [16.5, 12], [7.5, 16.5], [16.5, 16.5]],
};

export function DiePips({ value, spinning }: { value: number; spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      className={spinning ? 'kb-die-rolling' : undefined}
      aria-hidden
    >
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#ffffff" stroke="#c9ced8" strokeWidth="1" />
      {PIPS[value]?.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.1" fill="#1a1f27" />
      ))}
    </svg>
  );
}
