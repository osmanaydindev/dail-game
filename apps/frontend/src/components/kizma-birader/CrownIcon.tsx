'use client';

import React from 'react';

// Geometrik taç — font glifi kullanılmaz (bkz. 630dfa4: glifler bazı
// tarayıcılarda öngörülemez boyutta render oluyor).
export function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="70%" height="70%" aria-hidden>
      <path
        d="M3 7.5 7.5 11 12 4.5 16.5 11 21 7.5 19.2 17H4.8 Z"
        fill="#f6c244"
        stroke="#8a6914"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect x="4.8" y="17.6" width="14.4" height="2.4" rx="1" fill="#f6c244" stroke="#8a6914" strokeWidth="0.8" />
    </svg>
  );
}
