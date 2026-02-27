"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ScratchCardProps {
  /** The image URL hidden beneath the scratch overlay */
  imageSrc: string;
  /** Width of the scratch card in px */
  width: number;
  /** Height of the scratch card in px */
  height: number;
  /** Border radius for the card */
  borderRadius?: number;
  /** Percentage of area scratched to auto-reveal (0-100) */
  revealThreshold?: number;
  /** Scratch brush radius in px */
  brushRadius?: number;
  /** Overlay pattern style */
  overlayStyle?: "sparkle" | "gradient" | "solid";
  /** Primary color for the overlay */
  overlayColor?: string;
  /** Called when the card is fully revealed */
  onReveal?: () => void;
}

/**
 * Interactive scratch card that reveals an image beneath a scratchable overlay.
 * Uses an offscreen canvas for the scratch mask and renders via a visible canvas.
 * Performance: uses requestAnimationFrame for smooth scratching, avoids
 * re-renders during active scratching by keeping all state in refs.
 */
export function ScratchCard({
  imageSrc,
  width,
  height,
  borderRadius = 12,
  revealThreshold = 50,
  brushRadius = 22,
  overlayStyle = "sparkle",
  overlayColor = "#00C8F8",
  onReveal,
}: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const overlayPatternRef = useRef<HTMLCanvasElement | null>(null);
  const isScratchingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const revealedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const scratchedRef = useRef(0);
  const totalPixelsRef = useRef(0);

  const [isRevealed, setIsRevealed] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  /** Pixel ratio for sharp rendering */
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  /** Generate the overlay pattern canvas */
  const createOverlayPattern = useCallback(() => {
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = width * dpr;
    patternCanvas.height = height * dpr;
    const ctx = patternCanvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    if (overlayStyle === "sparkle") {
      // Base gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, overlayColor);
      grad.addColorStop(0.5, lightenColor(overlayColor, 20));
      grad.addColorStop(1, overlayColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Shimmer diagonal stripes
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      for (let i = -height; i < width + height; i += 12) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + height, height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Sparkle dots
      const sparkleCount = Math.floor((width * height) / 400);
      for (let i = 0; i < sparkleCount; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height;
        const sr = Math.random() * 2.5 + 0.5;
        const alpha = Math.random() * 0.6 + 0.2;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        // Cross sparkle for larger dots
        if (sr > 1.5) {
          ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(sx - sr * 2, sy);
          ctx.lineTo(sx + sr * 2, sy);
          ctx.moveTo(sx, sy - sr * 2);
          ctx.lineTo(sx, sy + sr * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Center icon: gift emoji area
      const cx = width / 2;
      const cy = height / 2;
      // Glow behind icon
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 36);
      glowGrad.addColorStop(0, "rgba(255,255,255,0.25)");
      glowGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 36, 0, Math.PI * 2);
      ctx.fill();

      // Draw a "scratch here" hint icon — a simple finger/touch icon
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `${28}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u{1F381}", cx, cy - 6);
      ctx.restore();

      // Hint text
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${11}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u5212\u5f00\u770b\u770b", cx, cy + 24);
      ctx.restore();

    } else if (overlayStyle === "gradient") {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, overlayColor);
      grad.addColorStop(1, lightenColor(overlayColor, 30));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Hint
      const cx = width / 2;
      const cy = height / 2;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${12}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u5212\u5f00\u770b\u770b", cx, cy);
      ctx.restore();
    } else {
      // solid
      ctx.fillStyle = overlayColor;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${12}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u5212\u5f00\u770b\u770b", cx, cy);
      ctx.restore();
    }

    return patternCanvas;
  }, [width, height, dpr, overlayStyle, overlayColor]);

  const drawSceneRef = useRef<() => void>(() => {});

  /** Preload the image on mount (before click) */
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  /** Prepare mask and overlay (only needs image dimensions, not the canvas element) */
  useEffect(() => {
    // Mask canvas (offscreen) — white = covered, transparent = scratched
    const mask = document.createElement("canvas");
    mask.width = width * dpr;
    mask.height = height * dpr;
    const maskCtx = mask.getContext("2d")!;
    maskCtx.fillStyle = "#FFFFFF";
    maskCtx.fillRect(0, 0, mask.width, mask.height);
    maskRef.current = mask;

    totalPixelsRef.current = width * dpr * height * dpr;
    scratchedRef.current = 0;

    // Create overlay pattern
    overlayPatternRef.current = createOverlayPattern();
  }, [width, height, dpr, createOverlayPattern]);

  /** Initialize the visible canvas once it mounts (after isClicked becomes true) */
  useEffect(() => {
    if (!isClicked || isRevealed || !imageLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    function drawScene() {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);

      // Draw image
      if (imageRef.current) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.drawImage(imageRef.current, 0, 0, width, height);
        ctx.restore();
      }

      // Draw overlay using mask as alpha
      if (maskRef.current && overlayPatternRef.current) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width * dpr;
        tempCanvas.height = height * dpr;
        const tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.drawImage(overlayPatternRef.current, 0, 0);
        tempCtx.globalCompositeOperation = "destination-in";
        tempCtx.drawImage(maskRef.current, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
      }
    }

    drawSceneRef.current = drawScene;
    // Initial paint
    drawScene();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClicked, isRevealed, imageLoaded, width, height, dpr]);

  /** Get position relative to canvas from mouse/touch event */
  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      return {
        x: ((clientX - rect.left) / rect.width) * width,
        y: ((clientY - rect.top) / rect.height) * height,
      };
    },
    [width, height],
  );

  /** Scratch along a line from lastPoint to current point */
  const scratchLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const mask = maskRef.current;
      if (!mask) return;
      const ctx = mask.getContext("2d")!;
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

  /** Check scratch percentage */
  const checkReveal = useCallback(() => {
    if (revealedRef.current) return;
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d")!;
    const data = ctx.getImageData(0, 0, mask.width, mask.height).data;
    let transparent = 0;
    // Check alpha channel every 4th pixel for performance
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] === 0) transparent++;
    }
    const total = Math.floor(data.length / 16);
    const pct = (transparent / total) * 100;
    scratchedRef.current = pct;
    if (pct >= revealThreshold) {
      revealedRef.current = true;
      setIsRevealed(true);
      onReveal?.();
    }
  }, [revealThreshold, onReveal]);

  /** Schedule a redraw on next animation frame */
  const scheduleRedraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawSceneRef.current();
    });
  }, []);

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isRevealed) return;
      if (!isClicked) return; // must click to "open" first

      if ("touches" in e) {
        e.preventDefault();
      }
      isScratchingRef.current = true;
      const pos = getPos(e);
      if (pos) {
        lastPointRef.current = pos;
        // Single dot scratch
        scratchLine(pos, pos);
        scheduleRedraw();
      }
    },
    [isRevealed, isClicked, getPos, scratchLine, scheduleRedraw],
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isScratchingRef.current || isRevealed) return;
      if ("touches" in e) {
        e.preventDefault();
      }
      const pos = getPos(e);
      if (pos && lastPointRef.current) {
        scratchLine(lastPointRef.current, pos);
        lastPointRef.current = pos;
        scheduleRedraw();
      }
    },
    [isRevealed, getPos, scratchLine, scheduleRedraw],
  );

  const handlePointerUp = useCallback(() => {
    if (isScratchingRef.current) {
      isScratchingRef.current = false;
      lastPointRef.current = null;
      checkReveal();
    }
  }, [checkReveal]);

  /** First click: "open" the scratch card (transition from covered to scratchable) */
  const handleClick = useCallback(() => {
    if (!isClicked && !isRevealed) {
      setIsClicked(true);
    }
  }, [isClicked, isRevealed]);

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
      {/* Covered state — before click */}
      <AnimatePresence>
        {!isClicked && !isRevealed && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={handleClick}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: `linear-gradient(135deg, ${overlayColor}, ${lightenColor(overlayColor, 25)})`,
              borderRadius,
            }}
          >
            {/* Shimmer animation overlay */}
            <motion.div
              animate={{
                backgroundPosition: ["200% 0%", "-200% 0%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)",
                backgroundSize: "200% 100%",
                borderRadius,
              }}
            />
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 36, lineHeight: 1 }}
            >
              {"\u{1F381}"}
            </motion.div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#FFFFFF",
                textShadow: "0 1px 3px rgba(0,0,0,0.15)",
                letterSpacing: "0.02em",
              }}
            >
              {"\u70b9\u51fb\u67e5\u770b"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revealed state — image fully visible */}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scratch canvas — visible while scratching */}
      {imageLoaded && isClicked && !isRevealed && (
        <canvas
          ref={canvasRef}
          width={width * dpr}
          height={height * dpr}
          style={{
            position: "absolute",
            inset: 0,
            width,
            height,
            zIndex: 1,
            borderRadius,
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerUp}
        />
      )}

      {/* Fallback: image behind everything while loading */}
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

/** Lighten a hex color by a percentage */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(2.55 * percent));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(2.55 * percent));
  const b = Math.min(255, (num & 0xff) + Math.round(2.55 * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
