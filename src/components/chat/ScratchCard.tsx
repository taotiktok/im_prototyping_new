"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

/* ────────────────────────────────────────────────────────────
   Props
   ──────────────────────────────────────────────────────────── */

interface ScratchCardProps {
  imageSrc: string;
  width: number;
  height: number;
  borderRadius?: number;
  /** % of area scratched to auto-reveal (0–100) */
  revealThreshold?: number;
  brushRadius?: number;
  overlayStyle?: "sparkle" | "gradient" | "solid";
  overlayColor?: string;
  onReveal?: () => void;
}

/* ────────────────────────────────────────────────────────────
   Colour helpers
   ──────────────────────────────────────────────────────────── */

function lighten(hex: string, pct: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(2.55 * pct));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(2.55 * pct));
  const b = Math.min(255, (n & 0xff) + Math.round(2.55 * pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function darken(hex: string, pct: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(2.55 * pct));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(2.55 * pct));
  const b = Math.max(0, (n & 0xff) - Math.round(2.55 * pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────── */

export function ScratchCard({
  imageSrc,
  width,
  height,
  borderRadius = 12,
  revealThreshold = 45,
  brushRadius = 22,
  overlayStyle = "sparkle",
  overlayColor = "#00C8F8",
  onReveal,
}: ScratchCardProps) {
  /* ── Refs ── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const tempRef = useRef<HTMLCanvasElement | null>(null); // persistent composite buffer
  const isScratchingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const revealedRef = useRef(false);
  const rafRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});

  /* ── State ── */
  const [isRevealed, setIsRevealed] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [scratchPct, setScratchPct] = useState(0);

  const dpr = useMemo(
    () => (typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1),
    [],
  );
  const W = width * dpr;
  const H = height * dpr;

  /* ── Build overlay pattern (offscreen) ── */
  const buildOverlay = useCallback(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const baseColor = overlayColor;
    const light = lighten(baseColor, 18);
    const dark = darken(baseColor, 10);

    if (overlayStyle === "sparkle") {
      // Rich gradient base
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, dark);
      g.addColorStop(0.35, baseColor);
      g.addColorStop(0.65, light);
      g.addColorStop(1, baseColor);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Diagonal shimmer stripes
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      for (let i = -height; i < width + height; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + height, height);
        ctx.stroke();
      }

      // Sparkle particles
      const count = Math.floor((width * height) / 320);
      for (let i = 0; i < count; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height;
        const sr = Math.random() * 2.2 + 0.4;
        const a = Math.random() * 0.55 + 0.25;
        ctx.globalAlpha = a;
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        if (sr > 1.4) {
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(sx - sr * 2.2, sy);
          ctx.lineTo(sx + sr * 2.2, sy);
          ctx.moveTo(sx, sy - sr * 2.2);
          ctx.lineTo(sx, sy + sr * 2.2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Center glow
      const cx = width / 2;
      const cy = height / 2;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 42);
      rg.addColorStop(0, "rgba(255,255,255,0.28)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.fill();

      // Gift box icon (pure shapes, no emoji)
      drawGiftIcon(ctx, cx, cy - 4, 22);

      // "Scratch to reveal" text
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = "#FFF";
      ctx.font = `600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 3;
      ctx.fillText("\u5212\u5f00\u770b\u770b", cx, cy + 26);
      ctx.restore();
    } else if (overlayStyle === "gradient") {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, baseColor);
      g.addColorStop(1, light);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Subtle noise dots
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = "#FFF";
        ctx.fillRect(
          Math.random() * width,
          Math.random() * height,
          Math.random() * 2 + 0.5,
          Math.random() * 2 + 0.5,
        );
      }
      ctx.globalAlpha = 1;

      const cx = width / 2;
      const cy = height / 2;
      drawGiftIcon(ctx, cx, cy - 4, 22);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#FFF";
      ctx.font = `600 11px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u5212\u5f00\u770b\u770b", cx, cy + 26);
      ctx.restore();
    } else {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      drawGiftIcon(ctx, cx, cy - 4, 20);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#FFF";
      ctx.font = `600 11px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u5212\u5f00\u770b\u770b", cx, cy + 26);
      ctx.restore();
    }

    return c;
  }, [W, H, dpr, width, height, overlayStyle, overlayColor]);

  /* ── Preload image ── */
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  /* ── Prepare offscreen buffers (mask + overlay + temp) ── */
  useEffect(() => {
    const mask = document.createElement("canvas");
    mask.width = W;
    mask.height = H;
    const mCtx = mask.getContext("2d")!;
    mCtx.fillStyle = "#FFF";
    mCtx.fillRect(0, 0, W, H);
    maskRef.current = mask;

    overlayRef.current = buildOverlay();

    const temp = document.createElement("canvas");
    temp.width = W;
    temp.height = H;
    tempRef.current = temp;
  }, [W, H, buildOverlay]);

  /* ── Wire up the visible canvas after click ── */
  useEffect(() => {
    if (!isClicked || isRevealed || !imgLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;

    function draw() {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, W, H);

      // Image layer
      if (imageRef.current) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.drawImage(imageRef.current, 0, 0, width, height);
        ctx.restore();
      }

      // Overlay layer composited through mask
      const t = tempRef.current;
      const ov = overlayRef.current;
      const mk = maskRef.current;
      if (t && ov && mk) {
        const tCtx = t.getContext("2d")!;
        tCtx.clearRect(0, 0, W, H);
        tCtx.drawImage(ov, 0, 0);
        tCtx.globalCompositeOperation = "destination-in";
        tCtx.drawImage(mk, 0, 0);
        tCtx.globalCompositeOperation = "source-over";
        ctx.drawImage(t, 0, 0);
      }
    }

    drawRef.current = draw;
    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isClicked, isRevealed, imgLoaded, W, H, dpr, width, height]);

  /* ── Pointer helpers ── */
  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      const c = canvasRef.current;
      if (!c) return null;
      const r = c.getBoundingClientRect();
      let cx: number, cy: number;
      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      } else {
        cx = (e as MouseEvent).clientX;
        cy = (e as MouseEvent).clientY;
      }
      return {
        x: ((cx - r.left) / r.width) * width,
        y: ((cy - r.top) / r.height) * height,
      };
    },
    [width, height],
  );

  /* Interpolated scratch line for smoother strokes */
  const scratchLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const m = maskRef.current;
      if (!m) return;
      const ctx = m.getContext("2d")!;
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushRadius * 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(from.x * dpr, from.y * dpr);
      ctx.lineTo(to.x * dpr, to.y * dpr);
      ctx.stroke();
    },
    [brushRadius, dpr],
  );

  const checkReveal = useCallback(() => {
    if (revealedRef.current) return;
    const m = maskRef.current;
    if (!m) return;
    const ctx = m.getContext("2d")!;
    const d = ctx.getImageData(0, 0, m.width, m.height).data;
    let transparent = 0;
    // Sample every 16th pixel for speed
    for (let i = 3; i < d.length; i += 16) {
      if (d[i] === 0) transparent++;
    }
    const total = Math.floor(d.length / 16);
    const pct = (transparent / total) * 100;
    setScratchPct(pct);
    if (pct >= revealThreshold) {
      revealedRef.current = true;
      setIsRevealed(true);
      onReveal?.();
    }
  }, [revealThreshold, onReveal]);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  }, []);

  /* ── Event handlers ── */
  const handleDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isRevealed || !isClicked) return;
      if ("touches" in e) e.preventDefault();
      isScratchingRef.current = true;
      const p = getPos(e);
      if (p) {
        lastPtRef.current = p;
        scratchLine(p, p);
        scheduleRedraw();
      }
    },
    [isRevealed, isClicked, getPos, scratchLine, scheduleRedraw],
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isScratchingRef.current || isRevealed) return;
      if ("touches" in e) e.preventDefault();
      const p = getPos(e);
      if (p && lastPtRef.current) {
        scratchLine(lastPtRef.current, p);
        lastPtRef.current = p;
        scheduleRedraw();
      }
    },
    [isRevealed, getPos, scratchLine, scheduleRedraw],
  );

  const handleUp = useCallback(() => {
    if (isScratchingRef.current) {
      isScratchingRef.current = false;
      lastPtRef.current = null;
      checkReveal();
    }
  }, [checkReveal]);

  const handleClick = useCallback(() => {
    if (!isClicked && !isRevealed) setIsClicked(true);
  }, [isClicked, isRevealed]);

  /* ── Sparkle burst particles for reveal ── */
  const particles = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 5 + 2,
      delay: Math.random() * 0.2,
      dx: (Math.random() - 0.5) * 60,
      dy: (Math.random() - 0.5) * 60,
    }));
  }, [width, height]);

  /* ── Progress ring calculation ── */
  const ringRadius = 14;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (ringCirc * Math.min(scratchPct, revealThreshold)) / revealThreshold;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius,
        overflow: "hidden",
        cursor: isRevealed ? "default" : isClicked ? "crosshair" : "pointer",
        touchAction: isClicked ? "none" : "auto",
        flexShrink: 0,
      }}
    >
      {/* ── Pre-click cover ── */}
      <AnimatePresence>
        {!isClicked && !isRevealed && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            onClick={handleClick}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: `linear-gradient(135deg, ${darken(overlayColor, 8)}, ${overlayColor}, ${lighten(overlayColor, 22)})`,
              borderRadius,
            }}
          >
            {/* Animated shimmer sweep */}
            <motion.div
              animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.22) 50%, transparent 62%)",
                backgroundSize: "200% 100%",
                borderRadius,
                pointerEvents: "none",
              }}
            />

            {/* Gift icon (vector, no emoji) */}
            <motion.div
              animate={{ scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                {/* Box body */}
                <rect x="5" y="17" width="26" height="14" rx="3" fill="rgba(255,255,255,0.92)" />
                {/* Box lid */}
                <rect x="3" y="13" width="30" height="6" rx="2" fill="rgba(255,255,255,0.96)" />
                {/* Vertical ribbon */}
                <rect x="16" y="13" width="4" height="18" rx="0.5" fill={overlayColor} />
                {/* Horizontal ribbon */}
                <rect x="3" y="14.5" width="30" height="3" rx="0.5" fill={overlayColor} />
                {/* Left bow */}
                <path
                  d="M18 14C18 14 14 6 10 8C6 10 14 14 18 14Z"
                  fill={lighten(overlayColor, 15)}
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="0.5"
                />
                {/* Right bow */}
                <path
                  d="M18 14C18 14 22 6 26 8C30 10 22 14 18 14Z"
                  fill={lighten(overlayColor, 15)}
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="0.5"
                />
                {/* Knot */}
                <circle cx="18" cy="13.5" r="2" fill={darken(overlayColor, 5)} />
              </svg>
            </motion.div>

            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#FFF",
                textShadow: "0 1px 4px rgba(0,0,0,0.18)",
                letterSpacing: "0.04em",
              }}
            >
              {"\u70b9\u51fb\u67e5\u770b"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scratch progress indicator ── */}
      <AnimatePresence>
        {isClicked && !isRevealed && scratchPct > 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 34 34">
              <circle
                cx="17"
                cy="17"
                r={ringRadius}
                fill="rgba(0,0,0,0.35)"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="2.5"
              />
              <circle
                cx="17"
                cy="17"
                r={ringRadius}
                fill="none"
                stroke="#FFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={ringCirc}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 17 17)"
                style={{ transition: "stroke-dashoffset 0.15s ease" }}
              />
              <text
                x="17"
                y="18"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#FFF"
                fontSize="8"
                fontWeight="700"
                fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              >
                {`${Math.round(Math.min((scratchPct / revealThreshold) * 100, 100))}%`}
              </text>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Revealed state ── */}
      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              borderRadius,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Revealed photo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              draggable={false}
            />

            {/* Sparkle burst on reveal */}
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 1, x: p.x, y: p.y, scale: 1 }}
                animate={{
                  opacity: 0,
                  x: p.x + p.dx,
                  y: p.y + p.dy,
                  scale: 0,
                }}
                transition={{
                  duration: 0.7,
                  delay: p.delay,
                  ease: "easeOut",
                }}
                style={{
                  position: "absolute",
                  width: p.size,
                  height: p.size,
                  borderRadius: "50%",
                  background: "#FFF",
                  boxShadow: `0 0 ${p.size * 2}px ${lighten(overlayColor, 30)}`,
                  pointerEvents: "none",
                  zIndex: 3,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scratch canvas ── */}
      {imgLoaded && isClicked && !isRevealed && (
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            position: "absolute",
            inset: 0,
            width,
            height,
            zIndex: 1,
            borderRadius,
          }}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
          onTouchStart={handleDown}
          onTouchMove={handleMove}
          onTouchEnd={handleUp}
          onTouchCancel={handleUp}
        />
      )}

      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt="Hidden photo"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          visibility: isRevealed || isClicked ? "visible" : "hidden",
        }}
        draggable={false}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Draw a gift box icon (pure canvas shapes, no emoji)
   ──────────────────────────────────────────────────────────── */

function drawGiftIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size / 22; // scale factor

  ctx.save();
  ctx.translate(cx - 11 * s, cy - 11 * s);
  ctx.scale(s, s);

  // Box body
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  roundRect(ctx, 2, 11, 18, 11, 2);
  ctx.fill();

  // Lid
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  roundRect(ctx, 0, 8, 22, 5, 1.5);
  ctx.fill();

  // Ribbon vertical
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(9.5, 8, 3, 14);

  // Ribbon horizontal
  ctx.fillRect(0, 9.5, 22, 2.5);

  // Bow left
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(11, 9);
  ctx.bezierCurveTo(11, 9, 6, 1, 3, 4);
  ctx.bezierCurveTo(0, 7, 8, 9, 11, 9);
  ctx.fill();

  // Bow right
  ctx.beginPath();
  ctx.moveTo(11, 9);
  ctx.bezierCurveTo(11, 9, 16, 1, 19, 4);
  ctx.bezierCurveTo(22, 7, 14, 9, 11, 9);
  ctx.fill();

  // Knot
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(11, 8.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
