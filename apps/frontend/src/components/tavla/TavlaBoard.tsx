'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { GameState, Move, Color } from './types';

// ─── Responsive geometry ───────────────────────────────────────────────────
// W/H are CSS (logical) pixels. DPR is the device pixel ratio used to render the
// canvas backing store at native resolution (crisp on retina/high-density phones).
const BOARD_ASPECT = 720 / 500; // width : height

interface Geo {
  W: number; H: number; DPR: number; landscape: boolean;
  BORDER: number; BAR_W: number; BOARD_W: number; POINT_W: number;
  BOARD_Y: number; BOARD_H: number; HALF_H: number; POINT_H: number;
  CR: number; DIE_S: number;
}

// Fit the board inside the available width AND height while keeping its aspect
// ratio — in landscape the height is the limiting dimension, in portrait the width.
function makeGeo(maxW: number, maxH?: number): Geo {
  const DPR = typeof window !== 'undefined' ? Math.min(Math.max(window.devicePixelRatio || 1, 1), 3) : 1;
  const landscape = typeof window !== 'undefined' &&
    window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches;

  let W = Math.min(Math.max(maxW, 280), 760);
  let H = W / BOARD_ASPECT;
  if (maxH && maxH > 140 && H > maxH) {
    H = maxH;
    W = H * BOARD_ASPECT;
  }
  W = Math.round(W);
  H = Math.round(H);

  const BORDER   = Math.max(10, Math.round(W * 0.025));
  const BAR_W    = Math.max(28, Math.round(W * 0.067));
  const BOARD_W  = W - 2 * BORDER;
  const POINT_W  = (BOARD_W - BAR_W) / 12;
  const BOARD_Y  = BORDER;
  const BOARD_H  = H - 2 * BORDER;
  const HALF_H   = BOARD_H / 2;
  const POINT_H  = HALF_H - Math.max(6, Math.round(HALF_H * 0.055));
  const CR       = Math.max(6, Math.min(Math.floor(POINT_W / 2) - 1, 22));
  const DIE_S    = Math.max(20, Math.min(34, Math.round(CR * 1.55)));
  return { W, H, DPR, landscape, BORDER, BAR_W, BOARD_W, POINT_W, BOARD_Y, BOARD_H, HALF_H, POINT_H, CR, DIE_S };
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function pointCol(idx: number): number { return idx < 12 ? 11 - idx : idx - 12; }
function colX(g: Geo, col: number): number {
  const halfLeft = g.BORDER + 6 * g.POINT_W + g.BAR_W;
  return col < 6
    ? g.BORDER + col * g.POINT_W + g.POINT_W / 2
    : halfLeft + (col - 6) * g.POINT_W + g.POINT_W / 2;
}
function pointX(g: Geo, idx: number): number { return colX(g, pointCol(idx)); }
function pointIsTop(idx: number): boolean { return idx >= 12; }
function checkerXY(g: Geo, idx: number, n: number): { x: number; y: number } {
  const x = pointX(g, idx);
  const isTop = pointIsTop(idx);
  const y = isTop
    ? g.BOARD_Y + g.CR + 2 + n * (g.CR * 2 + 2)
    : g.BOARD_Y + g.BOARD_H - g.CR - 2 - n * (g.CR * 2 + 2);
  return { x, y };
}
function barX(g: Geo): number { return g.BORDER + 6 * g.POINT_W + g.BAR_W / 2; }
function barY(g: Geo, color: Color, n: number): number {
  return color === 'white'
    ? g.BOARD_Y + g.HALF_H + g.CR + 4 + n * (g.CR * 2 + 4)
    : g.BOARD_Y + g.HALF_H - g.CR - 4 - n * (g.CR * 2 + 4);
}
function hitTestPoint(g: Geo, cx: number, cy: number): number | 'bar' | 'off' | null {
  if (cx > g.W - g.BORDER) return 'off';
  const barLeft = g.BORDER + 6 * g.POINT_W;
  if (cx >= barLeft && cx <= barLeft + g.BAR_W) return 'bar';
  const isTop = cy < g.BOARD_Y + g.HALF_H;
  let col: number;
  if (cx >= g.BORDER && cx < g.BORDER + 6 * g.POINT_W) {
    col = Math.floor((cx - g.BORDER) / g.POINT_W);
  } else if (cx > barLeft + g.BAR_W && cx < g.W - g.BORDER) {
    col = 6 + Math.floor((cx - barLeft - g.BAR_W) / g.POINT_W);
  } else {
    return null;
  }
  if (col < 0 || col > 11) return null;
  return isTop ? col + 12 : 11 - col;
}

// ── Move animation helpers ────────────────────────────────────────────────────
function boardChanged(prev: GameState, next: GameState): boolean {
  return next.board.some((v, i) => v !== prev.board[i]) ||
    next.borneOff.white !== prev.borneOff.white ||
    next.borneOff.black !== prev.borneOff.black ||
    next.bar.white !== prev.bar.white ||
    next.bar.black !== prev.bar.black;
}

interface DetectedMove { from: number | 'bar'; to: number | 'bar' | 'off'; color: Color; }

function detectMove(prev: GameState, next: GameState): DetectedMove | null {
  let color: Color | null = null;
  let from: number | 'bar' = 'bar';

  if (next.bar.white < prev.bar.white) { color = 'white'; from = 'bar'; }
  else if (next.bar.black < prev.bar.black) { color = 'black'; from = 'bar'; }
  else {
    for (let i = 0; i < 24; i++) {
      if (Math.max(0, next.board[i]) < Math.max(0, prev.board[i])) { color = 'white'; from = i; break; }
      if (Math.max(0, -next.board[i]) < Math.max(0, -prev.board[i])) { color = 'black'; from = i; break; }
    }
  }
  if (!color) return null;

  let to: number | 'bar' | 'off' = 0;
  if (color === 'white') {
    if (next.borneOff.white > prev.borneOff.white) { to = 'off'; }
    else { for (let i = 0; i < 24; i++) if (Math.max(0, next.board[i]) > Math.max(0, prev.board[i])) { to = i; break; } }
  } else {
    if (next.borneOff.black > prev.borneOff.black) { to = 'off'; }
    else { for (let i = 0; i < 24; i++) if (Math.max(0, -next.board[i]) > Math.max(0, -prev.board[i])) { to = i; break; } }
  }
  return { from, to, color };
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function drawTriangle(ctx: CanvasRenderingContext2D, g: Geo, col: number, isTop: boolean, fill: string) {
  const x = colX(g, col);
  const yBase = isTop ? g.BOARD_Y : g.BOARD_Y + g.BOARD_H;
  const yTip  = isTop ? g.BOARD_Y + g.POINT_H : g.BOARD_Y + g.BOARD_H - g.POINT_H;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x - g.POINT_W / 2, yBase);
  ctx.lineTo(x + g.POINT_W / 2, yBase);
  ctx.lineTo(x, yTip);
  ctx.closePath();
  ctx.fill();
}

function drawChecker(ctx: CanvasRenderingContext2D, x: number, y: number, color: Color, highlight: boolean, CR: number) {
  const isWhite = color === 'white';
  ctx.beginPath();
  ctx.arc(x, y, CR, 0, Math.PI * 2);
  ctx.fillStyle = isWhite ? '#e8e0d0' : '#2a1f1f';
  ctx.fill();
  ctx.strokeStyle = highlight ? '#4af' : (isWhite ? '#bbb' : '#555');
  ctx.lineWidth = highlight ? 2.5 : 2;
  ctx.stroke();
  const innerR = Math.max(2, CR - 5);
  ctx.beginPath();
  ctx.arc(x, y, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = isWhite ? '#ccc4b0' : '#3d2e2e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, value: number, used: boolean, S: number, rot = 0) {
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.translate(-x, -y); }
  ctx.fillStyle = used ? '#3a3a3c' : '#f5f0e8';
  ctx.strokeStyle = used ? '#555' : '#bbb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - S / 2, y - S / 2, S, S, Math.max(4, Math.round(S * 0.18)));
  ctx.fill(); ctx.stroke();
  const d = S * 0.24;
  const dotR = Math.max(1.5, S * 0.1);
  const dots: Record<number, [number, number][]> = {
    1: [[0,0]], 2:[[-d,-d],[d,d]], 3:[[-d,-d],[0,0],[d,d]],
    4:[[-d,-d],[d,-d],[-d,d],[d,d]], 5:[[-d,-d],[d,-d],[0,0],[-d,d],[d,d]],
    6:[[-d,-d],[d,-d],[-d,0],[d,0],[-d,d],[d,d]],
  };
  ctx.fillStyle = used ? '#555' : '#2a1f1f';
  for (const [dx, dy] of dots[value] ?? []) {
    ctx.beginPath(); ctx.arc(x + dx, y + dy, dotR, 0, Math.PI * 2); ctx.fill();
  }
  if (rot) ctx.restore();
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  state: GameState;
  myColor: Color;
  flip: boolean;
  selected: number | 'bar' | null;
  validMoves: Move[];
  animDice: number[] | null;
  /** Where the player dropped the dice on the board (canvas logical px), or null. */
  dicePos: { x: number; y: number } | null;
  onPointClick: (idx: number | 'bar' | 'off') => void;
}

interface AnimInfo extends DetectedMove { displayState: GameState; }

export function TavlaBoard({ state, myColor, flip, selected, validMoves, animDice, dicePos, onPointClick }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // geoRef for stable access inside callbacks; geo state triggers re-render
  const geoRef = useRef<Geo>(makeGeo(720));
  const [geo, setGeo] = useState<Geo>(() => makeGeo(720));

  const dark = '#1a3d2b', light = '#c8a96e', boardBg = '#2d5a3e', borderColor = '#8b6914';

  // ── Responsive sizing — fit to both available width and viewport height ─────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    // Landscape phone: the header is hidden and a CSS flex layout sizes this
    // wrapper to exactly the free space (100dvh minus player bar + buttons). We
    // read that real height via clientHeight — robust against the iOS quirk where
    // window.innerHeight is stale right after an orientation change. Portrait /
    // desktop are width-driven (no height constraint).
    const isLandscapePhone = () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches;
    const update = () => {
      const w = el.clientWidth;
      if (w < 10) return;
      const h = el.clientHeight;
      const availH = isLandscapePhone() && h > 80 ? h : undefined;
      const g = makeGeo(w, availH);
      const cur = geoRef.current;
      // Skip no-op updates to avoid a ResizeObserver feedback loop.
      if (cur.W === g.W && cur.H === g.H && cur.DPR === g.DPR && cur.landscape === g.landscape) return;
      geoRef.current = g;
      setGeo(g);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // ── Internal move animation (rAF-driven, no per-frame React state) ─────────
  const prevStateRef    = useRef<GameState | null>(null);
  const animInfoRef     = useRef<AnimInfo | null>(null);
  const rafRef          = useRef<number | null>(null);
  const animProgressRef = useRef(0);
  const offscreenRef    = useRef<HTMLCanvasElement | null>(null);
  const drawRef         = useRef<() => void>(() => {});

  // Static layer — the full scene WITHOUT the moving piece. Cacheable to an
  // offscreen canvas during an animation so each frame only needs a blit.
  const drawStatic = useCallback((ctx: CanvasRenderingContext2D, g: Geo) => {
    const { W, H, BORDER, BAR_W, BOARD_W, POINT_W, BOARD_Y, BOARD_H, HALF_H, POINT_H, CR } = g;
    ctx.clearRect(0, 0, W, H);

    const anim = animInfoRef.current;
    const ds = anim ? anim.displayState : state;
    const drawBoard = [...ds.board];
    const drawBar   = { ...ds.bar };
    if (anim) {
      if (typeof anim.from === 'number') drawBoard[anim.from] -= anim.color === 'white' ? 1 : -1;
      else drawBar[anim.color] = Math.max(0, drawBar[anim.color] - 1);
    }

    ctx.save();
    if (flip) { ctx.translate(W, H); ctx.scale(-1, -1); }

    // Board background
    ctx.fillStyle = boardBg;
    ctx.fillRect(BORDER, BOARD_Y, BOARD_W, BOARD_H);
    ctx.fillStyle = '#1e4a2e';
    ctx.fillRect(BORDER + 6 * POINT_W, BOARD_Y, BAR_W, BOARD_H);

    // Triangles
    for (let col = 0; col < 12; col++) {
      const fill = col % 2 === 0 ? dark : light;
      drawTriangle(ctx, g, col, true, fill);
      drawTriangle(ctx, g, col, false, fill);
    }

    // Borders
    ctx.strokeStyle = borderColor; ctx.lineWidth = 3;
    ctx.strokeRect(BORDER, BOARD_Y, BOARD_W, BOARD_H);
    ctx.strokeRect(BORDER + 6 * POINT_W, BOARD_Y, BAR_W, BOARD_H);
    ctx.strokeStyle = borderColor + '55'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(BORDER, BOARD_Y + HALF_H); ctx.lineTo(W - BORDER, BOARD_Y + HALF_H);
    ctx.stroke();

    // ── Highlight valid destinations ──────────────────────────────────────
    const destSet = new Set(
      validMoves.filter(m => m.from === selected || (selected === 'bar' && m.from === 'bar')).map(m => m.to),
    );
    for (const dest of destSet) {
      if (dest === 'off') {
        ctx.fillStyle = 'rgba(100,255,120,0.25)';
        ctx.fillRect(W - BORDER, BOARD_Y, BORDER, BOARD_H);
        ctx.strokeStyle = 'rgba(100,255,120,0.7)'; ctx.lineWidth = 2;
        ctx.strokeRect(W - BORDER, BOARD_Y, BORDER, BOARD_H);
      } else {
        const dx = pointX(g, dest as number);
        const isTop = pointIsTop(dest as number);
        ctx.fillStyle = 'rgba(100,255,120,0.25)';
        const yStart = isTop ? BOARD_Y : BOARD_Y + HALF_H;
        ctx.fillRect(dx - POINT_W / 2, yStart, POINT_W, HALF_H);
        ctx.strokeStyle = 'rgba(100,255,120,0.7)'; ctx.lineWidth = 2;
        ctx.strokeRect(dx - POINT_W / 2, yStart, POINT_W, HALF_H);
      }
    }

    // ── Checkers on points ─────────────────────────────────────────────────
    for (let idx = 0; idx < 24; idx++) {
      const count = drawBoard[idx];
      if (count === 0) continue;
      const color: Color = count > 0 ? 'white' : 'black';
      const abs = Math.abs(count);
      for (let n = 0; n < Math.min(abs, 5); n++) {
        const { x, y } = checkerXY(g, idx, n);
        const isSelected = selected === idx && n === Math.min(abs, 5) - 1;
        drawChecker(ctx, x, y, color, isSelected, CR);
      }
      if (abs > 5) {
        const { x, y } = checkerXY(g, idx, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath(); ctx.arc(x, y, CR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${CR}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(abs), x, y);
      }
    }

    // ── Bar checkers ───────────────────────────────────────────────────────
    const bx = barX(g);
    for (let n = 0; n < drawBar.white; n++) {
      const y = barY(g, 'white', n);
      drawChecker(ctx, bx, y, 'white', selected === 'bar' && myColor === 'white' && n === drawBar.white - 1, CR);
    }
    for (let n = 0; n < drawBar.black; n++) {
      const y = barY(g, 'black', n);
      drawChecker(ctx, bx, y, 'black', selected === 'bar' && myColor === 'black' && n === drawBar.black - 1, CR);
    }

    // ── Borne-off indicators ───────────────────────────────────────────────
    if (ds.borneOff.white > 0) {
      for (let n = 0; n < Math.min(ds.borneOff.white, 15); n++) {
        ctx.fillStyle = '#e8e0d0';
        ctx.fillRect(W - BORDER + 2, BOARD_Y + BOARD_H - 4 - n * 6 - 3, BORDER - 4, 5);
      }
    }
    if (ds.borneOff.black > 0) {
      for (let n = 0; n < Math.min(ds.borneOff.black, 15); n++) {
        ctx.fillStyle = '#2a1f1f';
        ctx.fillRect(W - BORDER + 2, BOARD_Y + 4 + n * 6 - 2, BORDER - 4, 4);
      }
    }

    ctx.restore();

    // Dice are drawn by drawDice() (separately, so they can be animated on top).

    // ── Point labels ──────────────────────────────────────────────────────
    if (!flip) {
      const labelSize = Math.max(7, Math.round(W * 0.014));
      ctx.font = `${labelSize}px system-ui`; ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let idx = 0; idx < 24; idx++) {
        const x = pointX(g, idx);
        const isTop = pointIsTop(idx);
        ctx.fillText(String(idx + 1), x, isTop ? BOARD_Y + labelSize * 0.7 : BOARD_Y + BOARD_H - labelSize * 0.7);
      }
    }
    // suppress unused warning
    void POINT_H;
  }, [state, myColor, flip, selected, validMoves, geo, dark, light, boardBg, borderColor]);

  // ── Dice layer — drawn on top; animates a throw-in + tumble while rolling ───
  const diceAnimRef = useRef<{ start: number } | null>(null);
  const diceRafRef  = useRef<number | null>(null);

  const drawDice = useCallback((ctx: CanvasRenderingContext2D, g: Geo) => {
    const { W, H, BORDER, BAR_W, POINT_W, BOARD_Y, HALF_H, DIE_S } = g;
    const rolling = animDice != null;
    const displayDice = animDice ?? state.dice;
    if (displayDice.length === 0) return;

    const usedCount = rolling ? 0 : state.dice.length - state.movesLeft.length;
    const gap = DIE_S + 6;

    // Centre: where the player dropped the dice (clamped inside the board), else
    // the default spot (right half in landscape, over the bar otherwise).
    let cx: number, cy: number;
    if (dicePos) {
      const half = displayDice.length * gap / 2;
      cx = Math.min(Math.max(dicePos.x, BORDER + half), W - BORDER - half);
      cy = Math.min(Math.max(dicePos.y, BORDER + DIE_S), H - BORDER - DIE_S);
    } else {
      cx = g.landscape ? BORDER + 6 * POINT_W + BAR_W + 3 * POINT_W : barX(g);
      cy = BOARD_Y + HALF_H;
    }
    const startX = cx - ((displayDice.length - 1) * gap) / 2;

    // While rolling the dice spin (decaying to upright). On a tap-roll (no drag)
    // they also fly in from the right; on a drag the finger already "threw" them.
    let offX = 0, offY = 0, spin = 0;
    if (rolling && diceAnimRef.current) {
      const elapsed = performance.now() - diceAnimRef.current.start;
      if (!dicePos) {
        const easeIn = 1 - Math.pow(1 - Math.min(elapsed / 380, 1), 3);
        offX = (1 - easeIn) * (DIE_S * 3.5);
        offY = (1 - easeIn) * (-DIE_S * 1.0);
      }
      spin = Math.max(0, 1 - elapsed / 750);
    }

    for (let i = 0; i < displayDice.length; i++) {
      const rot = spin * (Math.PI * 4 + i * 1.2); // 0 when settled → upright
      drawDie(ctx, startX + i * gap + offX, cy + offY, displayDice[i], !rolling && i < usedCount, DIE_S, rot);
    }
  }, [state, animDice, dicePos]);

  // ── Moving piece overlay — drawn on top of the static layer each frame ─────
  const drawMoving = useCallback((ctx: CanvasRenderingContext2D, g: Geo) => {
    const anim = animInfoRef.current;
    if (!anim) return;
    const { W, H, BORDER, BOARD_Y, BOARD_H, CR } = g;
    const bx = barX(g);
    const ease = 1 - Math.pow(1 - animProgressRef.current, 3);

    let fx: number, fy: number;
    if (anim.from === 'bar') {
      const n = Math.max(0, anim.displayState.bar[anim.color] - 1);
      fx = bx; fy = barY(g, anim.color, n);
    } else {
      const count = Math.abs(anim.displayState.board[anim.from as number]);
      const pos = checkerXY(g, anim.from as number, Math.max(0, count - 1));
      fx = pos.x; fy = pos.y;
    }

    let tx: number, ty: number;
    if (anim.to === 'off') {
      tx = W - BORDER / 2;
      ty = anim.color === 'white' ? BOARD_Y + BOARD_H - 10 : BOARD_Y + 10;
    } else if (anim.to === 'bar') {
      const n = state.bar[anim.color] - 1;
      tx = bx; ty = barY(g, anim.color, Math.max(0, n));
    } else {
      const friendly = anim.color === 'white'
        ? Math.max(0, state.board[anim.to as number])
        : Math.max(0, -state.board[anim.to as number]);
      const pos = checkerXY(g, anim.to as number, Math.max(0, friendly - 1));
      tx = pos.x; ty = pos.y;
    }

    const ax = fx + (tx - fx) * ease;
    const ay = fy + (ty - fy) * ease;

    ctx.save();
    if (flip) { ctx.translate(W, H); ctx.scale(-1, -1); }
    ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.arc(ax + 2, ay + 3, CR, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.globalAlpha = 1;
    drawChecker(ctx, ax, ay, anim.color, false, CR);
    ctx.restore();
  }, [state, flip, geo]);

  // ── Composite draw — blit cached static layer + moving piece while animating ─
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const g = geo;
    const pw = Math.round(g.W * g.DPR);
    const ph = Math.round(g.H * g.DPR);
    const blitOrStatic = () => {
      const off = offscreenRef.current;
      if (off && off.width === pw && off.height === ph) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, pw, ph);
        ctx.drawImage(off, 0, 0);
      } else {
        ctx.setTransform(g.DPR, 0, 0, g.DPR, 0, 0);
        drawStatic(ctx, g);
      }
    };
    if (animInfoRef.current) {
      // Piece move: cached board + moving piece + (static) dice on top.
      blitOrStatic();
      ctx.setTransform(g.DPR, 0, 0, g.DPR, 0, 0);
      drawMoving(ctx, g);
      drawDice(ctx, g);
    } else if (diceAnimRef.current) {
      // Dice roll: cached board (no dice) + animated dice.
      blitOrStatic();
      ctx.setTransform(g.DPR, 0, 0, g.DPR, 0, 0);
      drawDice(ctx, g);
    } else {
      ctx.setTransform(g.DPR, 0, 0, g.DPR, 0, 0);
      drawStatic(ctx, g);
      drawDice(ctx, g);
    }
  }, [drawStatic, drawMoving, drawDice, geo]);

  // ── Detect a move and animate it. rAF drives the canvas directly so there is
  //    no React re-render per frame (the previous cause of mobile jank). ───────
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (!prev || !boardChanged(prev, state)) return;

    const move = detectMove(prev, state);
    if (!move) return;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    animInfoRef.current = { ...move, displayState: prev };
    animProgressRef.current = 0;

    // Cache the static layer once for the whole animation → per-frame blit only.
    const g = geo;
    let off = offscreenRef.current;
    if (!off) { off = document.createElement('canvas'); offscreenRef.current = off; }
    off.width = Math.round(g.W * g.DPR);
    off.height = Math.round(g.H * g.DPR);
    const octx = off.getContext('2d');
    if (octx) { octx.setTransform(g.DPR, 0, 0, g.DPR, 0, 0); drawStatic(octx, g); }

    const startTime = performance.now();
    const step = (now: number) => {
      animProgressRef.current = Math.min((now - startTime) / 280, 1);
      drawRef.current();
      if (animProgressRef.current < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        animInfoRef.current = null;
        animProgressRef.current = 0;
        rafRef.current = null;
        drawRef.current(); // settle on final static state
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the latest draw fn for the rAF loop, and repaint on any state/geo change.
  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw]);

  // ── Dice roll animation — throw-in + tumble, driven directly by rAF ────────
  useEffect(() => {
    const rolling = animDice != null;
    if (rolling && diceAnimRef.current == null) {
      diceAnimRef.current = { start: performance.now() };
      // Cache the board WITHOUT dice so each frame is just a blit + dice draw.
      const g = geo;
      let off = offscreenRef.current;
      if (!off) { off = document.createElement('canvas'); offscreenRef.current = off; }
      off.width = Math.round(g.W * g.DPR);
      off.height = Math.round(g.H * g.DPR);
      const octx = off.getContext('2d');
      if (octx) { octx.setTransform(g.DPR, 0, 0, g.DPR, 0, 0); drawStatic(octx, g); }
      const loop = () => {
        drawRef.current();
        if (diceAnimRef.current) diceRafRef.current = requestAnimationFrame(loop);
      };
      diceRafRef.current = requestAnimationFrame(loop);
    } else if (!rolling && diceAnimRef.current != null) {
      diceAnimRef.current = null;
      if (diceRafRef.current != null) cancelAnimationFrame(diceRafRef.current);
      diceRafRef.current = null;
      drawRef.current(); // settle on the final dice
    }
  }, [animDice]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (diceRafRef.current !== null) cancelAnimationFrame(diceRafRef.current);
  }, []);

  // ── Unified pointer handler (mouse + touch) ────────────────────────────────
  const handleInteraction = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = geoRef.current;
    const rect = canvas.getBoundingClientRect();
    const rawX = (clientX - rect.left) * (g.W / rect.width);
    const rawY = (clientY - rect.top)  * (g.H / rect.height);
    const cx = flip ? g.W - rawX : rawX;
    const cy = flip ? g.H - rawY : rawY;
    const hit = hitTestPoint(g, cx, cy);
    if (hit !== null) onPointClick(hit);
  }, [flip, onPointClick]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    handleInteraction(e.clientX, e.clientY);
  }, [handleInteraction]);

  // onTouchEnd: no 300 ms delay, prevents ghost click
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (t) handleInteraction(t.clientX, t.clientY);
  }, [handleInteraction]);

  const { W, H, DPR } = geo;

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas
        ref={canvasRef}
        width={Math.round(W * DPR)}
        height={Math.round(H * DPR)}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'block',
          // CSS (logical) size — backing store is DPR× larger for crispness.
          width: `${W}px`,
          height: `${H}px`,
          flexShrink: 0,
          cursor: 'pointer',
          // Prevent scroll-interference on touch; lets game intercept all touch events
          touchAction: 'none',
        }}
      />
    </div>
  );
}
