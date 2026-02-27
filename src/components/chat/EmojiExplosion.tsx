"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Same regex used in MessageBubble to detect emoji characters.
 * Extracts all emoji from a string so we can use them in the animation.
 */
const EMOJI_RE =
  /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F?/gu;

export function extractEmojis(text: string): string[] {
  const matches = text.match(EMOJI_RE);
  if (!matches) return [];
  // Deduplicate while preserving order
  return [...new Set(matches)];
}

/* ── Particle shape ── */
interface Particle {
  emoji: string;
  // Current position / state
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  // Velocity
  vx: number;
  vy: number;
  vr: number; // rotational velocity
  // Lifecycle (0→1)
  life: number;
  lifeSpeed: number;
  // Gravity pull
  gravity: number;
}

interface EmojiExplosionProps {
  /** The emojis to explode (extracted from the sent message) */
  emojis: string[];
  /** Called when the animation finishes */
  onComplete: () => void;
  /** Container width (design viewport) */
  width: number;
  /** Container height (design viewport) */
  height: number;
}

const PARTICLE_COUNT = 28;
const BIG_EMOJI_DURATION = 420; // ms — how long the big center emoji stays

export function EmojiExplosion({
  emojis,
  onComplete,
  width,
  height,
}: EmojiExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef<"big" | "explode" | "done">("big");
  const bigStartRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);

  const primaryEmoji = emojis[0] ?? "🎉";

  /** Build scattered particles originating from center */
  const spawnParticles = useCallback(() => {
    const cx = width / 2;
    const cy = height / 2;
    const particles: Particle[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4;
      const speed = 3 + Math.random() * 6;
      const emoji = emojis[Math.floor(Math.random() * emojis.length)] ?? primaryEmoji;

      particles.push({
        emoji,
        x: cx,
        y: cy,
        size: 20 + Math.random() * 24,
        opacity: 1,
        rotation: Math.random() * 360,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // slight upward bias
        vr: (Math.random() - 0.5) * 8,
        life: 0,
        lifeSpeed: 0.008 + Math.random() * 0.008,
        gravity: 0.08 + Math.random() * 0.04,
      });
    }

    particlesRef.current = particles;
  }, [emojis, primaryEmoji, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    phaseRef.current = "big";
    bigStartRef.current = performance.now();

    const animate = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      if (phaseRef.current === "big") {
        // ── Phase 1: Big emoji scale-in at center ──
        const elapsed = now - bigStartRef.current;
        const t = Math.min(elapsed / BIG_EMOJI_DURATION, 1);

        // Elastic ease-out curve
        const scale = t < 1
          ? 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 2.5) * (1 - t)
          : 1;

        const size = 72 * scale;
        ctx.save();
        ctx.globalAlpha = Math.min(t * 3, 1);
        ctx.font = `${size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(primaryEmoji, width / 2, height / 2);
        ctx.restore();

        if (t >= 1) {
          phaseRef.current = "explode";
          spawnParticles();
        }

        animRef.current = requestAnimationFrame(animate);
        return;
      }

      if (phaseRef.current === "explode") {
        // ── Phase 2: Particles scatter ──
        const particles = particlesRef.current;
        let allDead = true;

        for (const p of particles) {
          p.life += p.lifeSpeed;
          if (p.life >= 1) {
            p.opacity = 0;
            continue;
          }

          allDead = false;

          // Physics
          p.vy += p.gravity;
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.vr;

          // Fade out in last 40% of life
          p.opacity = p.life > 0.6 ? 1 - (p.life - 0.6) / 0.4 : 1;

          // Draw
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.font = `${p.size}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.emoji, 0, 0);
          ctx.restore();
        }

        if (allDead) {
          phaseRef.current = "done";
          onComplete();
          return;
        }

        animRef.current = requestAnimationFrame(animate);
        return;
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [width, height, primaryEmoji, spawnParticles, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
