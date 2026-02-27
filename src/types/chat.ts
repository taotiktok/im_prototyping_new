export interface ChatContact {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  streakCount?: number;
  isActive: boolean;
  stats: string;
  mutualInfo: string;
}

/** Emoji reactions available in the long-press picker */
export const REACTION_EMOJIS = ["❤️", "😂", "😡", "😭", "👍", "🤔", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/**
 * Media attachment for shared posts, videos, and images.
 * All media types render at 162×216px per Figma spec.
 */
export interface ChatMedia {
  type: "shared_post" | "video" | "image" | "scratch_card";
  /** Thumbnail / cover image URL */
  thumbnail: string;
  /** shared_post only — original post author's avatar */
  authorAvatar?: string;
  /** shared_post only — original post author's username */
  authorName?: string;
  /** scratch_card only — overlay color theme */
  scratchOverlayColor?: string;
  /** scratch_card only — overlay visual style */
  scratchOverlayStyle?: "sparkle" | "gradient" | "solid";
}

export interface ChatMessage {
  id: string;
  sender: "me" | "them";
  text: string;
  /** Image path for sticker messages (no text bubble, just the sticker image) */
  sticker?: string;
  /** Media attachment (shared post, video, or image) — 162×216px */
  media?: ChatMedia;
  /** Epoch ms when the message was sent — used to compute timestamp visibility */
  sentAt?: number;
  timestamp?: string; // shown as centered timestamp label above this message
  isSeen?: boolean;   // "Seen" indicator below sender's message
  reaction?: ReactionEmoji; // emoji reaction shown below the bubble
}

/** Computed position within a consecutive group from the same sender */
export type BubblePosition = "single" | "top" | "middle" | "bottom";
