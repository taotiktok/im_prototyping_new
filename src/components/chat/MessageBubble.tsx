"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage, BubblePosition } from "@/types/chat";

/**
 * Detect if a string consists entirely of emoji characters.
 * Per Figma spec: emoji-only messages render without a bubble at 44px per emoji.
 */
const EMOJI_ONLY_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u;
export function isEmojiOnly(text: string): boolean {
  return text.trim().length > 0 && EMOJI_ONLY_RE.test(text);
}

interface MessageBubbleProps {
  message: ChatMessage;
  position: BubblePosition;
  showAvatar: boolean;
  contactAvatar: string;
  /** Called when the user long-presses the bubble */
  onLongPress?: (msgId: string) => void;
}

/**
 * Border radii from Figma design spec:
 * - Sender tail corner = bottom-right (BR), Receiver tail corner = bottom-left (BL)
 * - Tail corner = 0px on single/bottom (last in group)
 * - Continuation corner = 8px (connecting to adjacent same-sender bubble)
 * CSS order: top-left  top-right  bottom-right  bottom-left
 */
function getSenderRadius(pos: BubblePosition): string {
  switch (pos) {
    case "single": return "20px 20px 0px 20px";
    case "top":    return "20px 20px 8px 20px";
    case "middle": return "20px 8px 8px 20px";
    case "bottom": return "20px 8px 0px 20px";
  }
}

function getReceiverRadius(pos: BubblePosition): string {
  switch (pos) {
    case "single": return "20px 20px 20px 0px";
    case "top":    return "20px 20px 20px 8px";
    case "middle": return "8px 20px 20px 8px";
    case "bottom": return "8px 20px 20px 0px";
  }
}

const LONG_PRESS_MS = 500;

export function MessageBubble({
  message,
  position,
  showAvatar,
  contactAvatar,
  onLongPress,
}: MessageBubbleProps) {
  const isMe = message.sender === "me";
  const [secretRevealed, setSecretRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);

  const startPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if ("touches" in e) {
      e.preventDefault();
    }
    movedRef.current = false;
    timerRef.current = setTimeout(() => {
      if (onLongPress) {
        onLongPress(message.id);
      }
    }, LONG_PRESS_MS);
  }, [message.id, onLongPress]);

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMove = useCallback(() => {
    movedRef.current = true;
    cancelPress();
  }, [cancelPress]);

  // Prevent native context menu on long press (mobile)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Also trigger long-press for desktop right-click
      if (onLongPress) {
        onLongPress(message.id);
      }
    },
    [message.id, onLongPress],
  );

  return (
    <div
      className={`flex w-full ${isMe ? "justify-end" : ""}`}
      style={{
        paddingLeft: isMe ? 0 : 12,
        paddingRight: isMe ? 12 : 0,
      }}
    >
      {/* Receiver avatar area — 30px wide, only shown on last bubble in group */}
      {!isMe && (
        <div className="shrink-0" style={{ width: 30, marginRight: 8 }}>
          {showAvatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contactAvatar}
              alt=""
              className="rounded-full object-cover"
              style={{ width: 30, height: 30 }}
            />
          )}
        </div>
      )}

      {/* Bubble + reaction column */}
      <div className="flex flex-col" style={{ maxWidth: 260, alignItems: isMe ? "flex-end" : "flex-start" }}>
        {/* Bubble — sticker, media, emoji-only, or text */}
        {message.sticker ? (
          <div
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={handleMove}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onContextMenu={handleContextMenu}
            style={{
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            } as React.CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.sticker}
              alt="Sticker"
              style={{ width: 140, height: 140, objectFit: "contain", pointerEvents: "none" }}
              draggable={false}
            />
          </div>
        ) : message.media ? (
          /* Media message — Figma spec: 162×216px, borderRadius 12px
             shared_post: thumbnail + play icon + author overlay
             video:       thumbnail + play icon
             image:       thumbnail only */
          <div
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={handleMove}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onContextMenu={handleContextMenu}
            style={{
              position: "relative",
              width: 162,
              height: 216,
              borderRadius: 12,
              overflow: "hidden",
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
              flexShrink: 0,
            } as React.CSSProperties}
          >
            {/* Thumbnail */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.media.thumbnail}
              alt={message.media.type === "shared_post" ? "Shared post" : message.media.type === "video" ? "Video" : "Photo"}
              style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
              draggable={false}
            />

            {/* Play icon — for shared_post and video (28×28, centered) */}
            {(message.media.type === "shared_post" || message.media.type === "video") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/images/icons/icon-play-fill.svg"
                alt=""
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 28,
                  height: 28,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Author overlay — shared_post only: gradient bg + avatar + username */}
            {message.media.type === "shared_post" && message.media.authorName && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "linear-gradient(180deg, rgba(22,24,18,0) 0%, rgba(22,24,18,0.5) 100%)",
                }}
              >
                {message.media.authorAvatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={message.media.authorAvatar}
                    alt=""
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "0.5px solid rgba(255,255,255,0.75)",
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    lineHeight: "1.3em",
                    color: "#FFFFFF",
                    textShadow: "0px 1px 1px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {message.media.authorName}
                </span>
              </div>
            )}
          </div>
        ) : isEmojiOnly(message.text) ? (
          /* Emoji-only message — Figma "Sender Emoji" component:
             No bubble background, 44px per emoji, right-padded for sender */
          <div
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={handleMove}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onContextMenu={handleContextMenu}
            style={{
              fontSize: 44,
              lineHeight: "1.2em",
              paddingRight: isMe ? 4 : 0,
              paddingLeft: isMe ? 0 : 4,
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            {message.text}
          </div>
        ) : message.isSecret ? (
          /* ── Secret (blurred) message ── */
          <div
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={handleMove}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onContextMenu={handleContextMenu}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isMe ? "flex-end" : "flex-start",
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
            } as React.CSSProperties}
          >
            {/* "Type to reveal" hint — only shown when still hidden */}
            {!secretRevealed && (
              <span
                style={{
                  fontSize: 12,
                  lineHeight: "1.3em",
                  color: "rgba(0,0,0,0.35)",
                  marginBottom: 4,
                  paddingLeft: isMe ? 0 : 4,
                  paddingRight: isMe ? 4 : 0,
                }}
              >
                Type to reveal
              </span>
            )}
            <div
              style={{
                position: "relative",
                borderRadius: isMe ? getSenderRadius(position) : getReceiverRadius(position),
                overflow: "hidden",
              }}
            >
              {/* The actual text — blurred until revealed */}
              <div
                style={{
                  padding: "10px 12px",
                  background: isMe ? "#00A2C9" : "#FFFFFF",
                  color: isMe ? "#FFFFFF" : "#000000",
                  fontSize: 16,
                  lineHeight: "1.3em",
                  wordBreak: "break-word",
                  filter: secretRevealed ? "none" : "blur(8px)",
                  transition: "filter 0.35s ease",
                }}
              >
                {message.text}
              </div>
              {/* Mosaic overlay pattern — only when hidden */}
              {!secretRevealed && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: isMe
                      ? "repeating-conic-gradient(rgba(0,162,201,0.45) 0% 25%, rgba(0,162,201,0.25) 0% 50%) 0 0 / 6px 6px"
                      : "repeating-conic-gradient(rgba(180,180,180,0.4) 0% 25%, rgba(220,220,220,0.3) 0% 50%) 0 0 / 6px 6px",
                    pointerEvents: "none",
                    transition: "opacity 0.35s ease",
                  }}
                />
              )}
              {/* Invisible text input overlay — typing anything reveals */}
              {!secretRevealed && (
                <input
                  type="text"
                  aria-label="Type to reveal secret message"
                  autoComplete="off"
                  onFocus={(e) => {
                    // Reveal on first keystroke, not on focus
                    const el = e.currentTarget;
                    const handler = () => {
                      setSecretRevealed(true);
                      el.removeEventListener("input", handler);
                      el.blur();
                    };
                    el.addEventListener("input", handler);
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                    fontSize: 16,
                    border: "none",
                    background: "transparent",
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <div
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={handleMove}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onContextMenu={handleContextMenu}
            style={{
              padding: "10px 12px",
              borderRadius: isMe ? getSenderRadius(position) : getReceiverRadius(position),
              background: isMe ? "#00A2C9" : "#FFFFFF",
              color: isMe ? "#FFFFFF" : "#000000",
              fontSize: 16,
              lineHeight: "1.3em",
              wordBreak: "break-word",
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            {message.text}
          </div>
        )}

        {/*
          Reaction pill — Figma spec:
          - chat_container gap: -8px → pill overlaps bubble bottom by 8px
          - reaction_container: alignSelf stretch, alignItems flex-end (sender) / flex-start (receiver)
          - sender padding: 0 4px 0 0; receiver padding: 0 0 0 4px
          - Pill: borderRadius 100px, height 28px, padding 0 10px, bg rgba(0,0,0,0.05)
        */}
        <AnimatePresence>
          {message.reaction && (
            <motion.div
              key={message.reaction}
              initial={{ opacity: 0, scale: 0.3, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.3, y: 6 }}
              transition={{ type: "spring", stiffness: 700, damping: 30 }}
              style={{
                marginTop: -8,
                position: "relative",
                zIndex: 1,
                alignSelf: "stretch",
                display: "flex",
                justifyContent: isMe ? "flex-end" : "flex-start",
                paddingRight: isMe ? 4 : 0,
                paddingLeft: isMe ? 0 : 4,
                transformOrigin: isMe ? "right top" : "left top",
              }}
            >
              <div
                style={{
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 100,
                  background: "rgba(0, 0, 0, 0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 16, lineHeight: "18px", textAlign: "center" }}>
                  {message.reaction}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
