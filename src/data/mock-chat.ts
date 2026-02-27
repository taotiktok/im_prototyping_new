import { ChatContact, ChatMessage } from "@/types/chat";
import { InboxDMItem } from "@/types/inbox";

/* ── sentAt helper ── */

/** Parse "9:16 PM" → epoch ms (using a fixed reference date) */
function parseTimeToMs(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  if (match[3].toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (match[3].toUpperCase() === "AM" && hours === 12) hours = 0;
  // Fixed reference date — only relative gaps matter
  return new Date(2026, 1, 27, hours, minutes, 0).getTime();
}

/**
 * Walk a message array and fill in `sentAt` for every message.
 * - Messages with a `timestamp` string → parse it.
 * - Messages without → previous sentAt + 15 s (within the same minute).
 */
function withSentAt(msgs: ChatMessage[]): ChatMessage[] {
  let last = 0;
  return msgs.map((m) => {
    if (m.timestamp) {
      last = parseTimeToMs(m.timestamp);
    } else {
      last += 15_000; // 15 seconds later — stays within the 1-min window
    }
    return { ...m, sentAt: last };
  });
}

/**
 * Convert any InboxDMItem into a ChatContact for the chat page.
 * Fills in reasonable defaults for fields the inbox doesn't carry.
 */
export function dmItemToContact(item: InboxDMItem): ChatContact {
  const handle = `@${item.title.toLowerCase().replace(/\s+/g, "")}`;
  return {
    id: item.id,
    name: item.title,
    handle,
    avatar: item.avatar,
    streakCount: item.streakCount,
    isActive: item.isOnline ?? false,
    stats: "",
    mutualInfo: "",
  };
}

/* ── Shared media thumbnail paths ── */
const THUMB = "/images/media/post-thumbnail.png";
const POST_AVATAR = "/images/media/post-author-avatar.png";
const SCRATCH_IMG = "/images/media/scratch-reveal.jpg";

/** Per-contact starter messages keyed by DM item id */
const contactMessages: Record<string, ChatMessage[]> = {
  /* ── Taoo425 (dm1) ── */
  dm1: withSentAt([
    { id: "m1", sender: "them", text: "Heyyyyy, did you see Taylor Swift is coming to our town next month?", timestamp: "9:16 PM" },
    { id: "m2", sender: "them", text: "I heard her new album is amazing and everyone's wristbands lit up!" },
    { id: "m3", sender: "them", text: "Her acoustic set was a real treat." },
    { id: "m4", sender: "me",   text: "Wowww! She always knows how to captivate her audience." },
    { id: "m5", sender: "me",   text: "Wanna buy ticket together?", timestamp: "9:20 PM" },
    { id: "m6", sender: "them", text: "Count me in plzz. But tickets are gonna sell out fast. We should set up a plan.", media: { type: "shared_post", thumbnail: THUMB, authorName: "TaylorSwift", authorAvatar: POST_AVATAR } },
    { id: "m7", sender: "them", text: "", timestamp: "9:21 PM", media: { type: "shared_post", thumbnail: THUMB, authorName: "TaylorSwift", authorAvatar: POST_AVATAR } },
    { id: "m8", sender: "me",   text: "OMG look at this stage!", timestamp: "9:22 PM", media: { type: "video", thumbnail: THUMB } },
    { id: "m9", sender: "them", text: "I got you a surprise!!", timestamp: "9:23 PM" },
    { id: "m10", sender: "them", text: "", media: { type: "scratch_card", thumbnail: SCRATCH_IMG, scratchOverlayColor: "#FE2C55", scratchOverlayStyle: "sparkle" } },
    { id: "m11", sender: "me",   text: "Omg what is this!!" },
    { id: "m12", sender: "me",   text: "", media: { type: "scratch_card", thumbnail: SCRATCH_IMG, scratchOverlayColor: "#00C8F8", scratchOverlayStyle: "sparkle" } },
    { id: "m13", sender: "me",   text: "Hahah, ok!", isSeen: true },
  ]),

  /* ── Tommy Tang (dm2) ── */
  dm2: withSentAt([
    { id: "m1", sender: "them", text: "Yo check out this video I found 😂", timestamp: "11:05 AM" },
    { id: "m2", sender: "them", text: "", media: { type: "shared_post", thumbnail: THUMB, authorName: "funnyvids", authorAvatar: POST_AVATAR } },
    { id: "m3", sender: "me",   text: "Lmaooo that's hilarious 🤣" },
    { id: "m4", sender: "them", text: "Right?! I've watched it like 10 times" },
    { id: "m5", sender: "me",   text: "", timestamp: "11:30 AM", media: { type: "video", thumbnail: THUMB } },
    { id: "m6", sender: "me",   text: "Here's another one" },
    { id: "m7", sender: "them", text: "", timestamp: "12:15 PM", media: { type: "image", thumbnail: THUMB } },
    { id: "m8", sender: "them", text: "Look what I got today!" },
    { id: "m9", sender: "them", text: "", media: { type: "scratch_card", thumbnail: SCRATCH_IMG, scratchOverlayColor: "#FF6B35", scratchOverlayStyle: "gradient" } },
  ]),

  /* ── summer (dm3) ── */
  dm3: withSentAt([
    { id: "m1", sender: "them", text: "Hey are you free this weekend?", timestamp: "3:00 PM" },
    { id: "m2", sender: "me",   text: "Yeah! What's up?" },
    { id: "m3", sender: "them", text: "Found this cool spot", media: { type: "image", thumbnail: THUMB } },
    { id: "m4", sender: "them", text: "We should totally go! 🏖️" },
    { id: "m5", sender: "me",   text: "Omg that looks amazing!!", timestamp: "3:15 PM" },
    { id: "m6", sender: "me",   text: "", media: { type: "video", thumbnail: THUMB } },
    { id: "m7", sender: "me",   text: "Here's a video from last time" },
    { id: "m8", sender: "them", text: "", timestamp: "3:20 PM", media: { type: "shared_post", thumbnail: THUMB, authorName: "travelgram", authorAvatar: POST_AVATAR } },
    { id: "m9", sender: "them", text: "Also found this on my feed" },
  ]),

  /* ── July (dm4) ── */
  dm4: withSentAt([
    { id: "m1", sender: "me",   text: "Happy birthday!! 🎂🎉", timestamp: "10:00 AM" },
    { id: "m2", sender: "them", text: "Aww thank you so much!! 🥹" },
    { id: "m3", sender: "them", text: "", media: { type: "image", thumbnail: THUMB } },
    { id: "m4", sender: "them", text: "Look at my cake!" },
    { id: "m5", sender: "me",   text: "That looks delicious 😍", timestamp: "10:30 AM" },
    { id: "m6", sender: "me",   text: "", media: { type: "shared_post", thumbnail: THUMB, authorName: "cakeboss", authorAvatar: POST_AVATAR } },
    { id: "m7", sender: "me",   text: "Reminds me of this post lol" },
    { id: "m8", sender: "them", text: "", timestamp: "11:00 AM", media: { type: "video", thumbnail: THUMB } },
    { id: "m9", sender: "them", text: "hello!!!", isSeen: false },
  ]),

  /* ── pumpkin (dm5) ── */
  dm5: withSentAt([
    { id: "m1", sender: "them", text: "Can you send me that recipe?", timestamp: "4:00 PM" },
    { id: "m2", sender: "me",   text: "Sure! Here it is" },
    { id: "m3", sender: "me",   text: "", media: { type: "image", thumbnail: THUMB } },
    { id: "m4", sender: "them", text: "Omg yesss thank you!!" },
    { id: "m5", sender: "them", text: "", timestamp: "4:30 PM", media: { type: "video", thumbnail: THUMB } },
    { id: "m6", sender: "them", text: "I tried making it, check this out" },
    { id: "m7", sender: "me",   text: "That actually looks so good! 🔥" },
    { id: "m8", sender: "me",   text: "", timestamp: "5:00 PM", media: { type: "shared_post", thumbnail: THUMB, authorName: "foodie101", authorAvatar: POST_AVATAR } },
    { id: "m9", sender: "me",   text: "Hello how r u recently", isSeen: false },
  ]),

  /* ── Alex (dm6) ── */
  dm6: withSentAt([
    { id: "m1", sender: "me",   text: "Did you watch the new episode??", timestamp: "8:00 PM" },
    { id: "m2", sender: "them", text: "YES OMG 🤯" },
    { id: "m3", sender: "them", text: "That plot twist was insane" },
    { id: "m4", sender: "them", text: "", media: { type: "shared_post", thumbnail: THUMB, authorName: "tvshowfan", authorAvatar: POST_AVATAR } },
    { id: "m5", sender: "them", text: "Everyone's talking about it" },
    { id: "m6", sender: "me",   text: "", timestamp: "8:20 PM", media: { type: "video", thumbnail: THUMB } },
    { id: "m7", sender: "me",   text: "This scene was everything" },
    { id: "m8", sender: "them", text: "", timestamp: "8:45 PM", media: { type: "image", thumbnail: THUMB } },
    { id: "m9", sender: "them", text: "Did you see the new episode?" },
  ]),

  /* ── Megan (dm7) ── */
  dm7: withSentAt([
    { id: "m1", sender: "them", text: "Look at this 😂😂😂", timestamp: "1:00 PM" },
    { id: "m2", sender: "them", text: "", media: { type: "shared_post", thumbnail: THUMB, authorName: "memequeen", authorAvatar: POST_AVATAR } },
    { id: "m3", sender: "me",   text: "HAHAHA no way 🤣" },
    { id: "m4", sender: "me",   text: "", media: { type: "image", thumbnail: THUMB } },
    { id: "m5", sender: "me",   text: "This is even funnier", timestamp: "1:15 PM" },
    { id: "m6", sender: "them", text: "☠️☠️" },
    { id: "m7", sender: "them", text: "", timestamp: "1:30 PM", media: { type: "video", thumbnail: THUMB } },
    { id: "m8", sender: "them", text: "Omg that's so funny lol 😂" },
  ]),

  /* ── Joanna (dm8) ── */
  dm8: withSentAt([
    { id: "m1", sender: "me",   text: "Hey! Are we still meeting tmr?", timestamp: "6:00 PM" },
    { id: "m2", sender: "them", text: "Yess! Can't wait 💕" },
    { id: "m3", sender: "them", text: "", media: { type: "image", thumbnail: THUMB } },
    { id: "m4", sender: "them", text: "I got a new outfit for it!" },
    { id: "m5", sender: "me",   text: "Cuteee! Look at what I found", timestamp: "6:30 PM" },
    { id: "m6", sender: "me",   text: "", media: { type: "shared_post", thumbnail: THUMB, authorName: "fashionista", authorAvatar: POST_AVATAR } },
    { id: "m7", sender: "them", text: "Omg I need that" },
    { id: "m8", sender: "them", text: "", timestamp: "7:00 PM", media: { type: "video", thumbnail: THUMB } },
    { id: "m9", sender: "them", text: "Are we still meeting tmr?", isSeen: false },
  ]),
};

/** Generic fallback conversation for contacts without specific messages */
function generateFallbackMessages(contactName: string): ChatMessage[] {
  return withSentAt([
    { id: "f1", sender: "them", text: `Hey! It's ${contactName} 👋`, timestamp: "2:30 PM" },
    { id: "f2", sender: "me",   text: "Hey! What's up?" },
    { id: "f3", sender: "them", text: "", media: { type: "shared_post", thumbnail: THUMB, authorName: contactName, authorAvatar: POST_AVATAR } },
    { id: "f4", sender: "them", text: "Check this out!" },
    { id: "f5", sender: "me",   text: "Wow that's cool!", timestamp: "2:45 PM" },
    { id: "f6", sender: "me",   text: "", media: { type: "video", thumbnail: THUMB } },
    { id: "f7", sender: "me",   text: "Sending you this video" },
    { id: "f8", sender: "them", text: "", timestamp: "3:00 PM", media: { type: "image", thumbnail: THUMB } },
    { id: "f9", sender: "them", text: "And here's a photo from today" },
    { id: "f10", sender: "me",  text: "Good to hear from you 😊", isSeen: true },
  ]);
}

/** Get initial messages for a given DM item */
export function getMessagesForContact(item: InboxDMItem): ChatMessage[] {
  return contactMessages[item.id] ?? generateFallbackMessages(item.title);
}
