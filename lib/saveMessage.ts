// lib/saveMessage.ts

import { PrismaClient } from "@prisma/client";

/* ─────────────────────────────────────────────
   Prisma singleton — prevents connection pool
   exhaustion during Next.js hot-reloads in dev
   ───────────────────────────────────────────── */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/* ─────────────────────────────────────────────
   Telegram type definitions (minimal — only
   the fields we actually read)
   ───────────────────────────────────────────── */
export interface TelegramUser {
  id:         number;
  is_bot?:    boolean;
  first_name?: string;
  username?:  string;
}

export interface TelegramChat {
  id:   number;
  type: string;
}

export interface TelegramPhotoSize {
  file_id:        string;
  file_unique_id: string;
  width:          number;
  height:         number;
  file_size?:     number;
}

export interface TelegramDocument {
  file_id:        string;
  file_unique_id: string;
  file_name?:     string;
  mime_type?:     string;
  file_size?:     number;
}

export interface TelegramMessage {
  message_id:  number;
  from?:       TelegramUser;
  chat:        TelegramChat;
  date:        number;             // Unix timestamp
  text?:       string;
  caption?:    string;             // captions on photos / documents
  photo?:      TelegramPhotoSize[];
  document?:   TelegramDocument;
}

export interface TelegramUpdate {
  update_id: number;
  message?:  TelegramMessage;
}

/* ─────────────────────────────────────────────
   Message type resolver
   ───────────────────────────────────────────── */
function resolveType(msg: TelegramMessage): string {
  if (msg.text)     return "text";
  if (msg.photo)    return "photo";
  if (msg.document) return "document";
  return "unknown";
}

/* ─────────────────────────────────────────────
   File ID extractor
   — photos: pick the highest-resolution size
   — documents: use document.file_id
   ───────────────────────────────────────────── */
function resolveFileId(msg: TelegramMessage): string | null {
  if (msg.photo && msg.photo.length > 0) {
    // Telegram returns array ordered by size — last = largest
    return msg.photo[msg.photo.length - 1].file_id;
  }
  if (msg.document) {
    return msg.document.file_id;
  }
  return null;
}

/* ─────────────────────────────────────────────
   saveMessage
   — upsert on messageId so duplicate webhook
     deliveries are idempotent
   ───────────────────────────────────────────── */
export interface SaveResult {
  action:  "created" | "skipped";
  id:      number;
  messageId: number;
}

export async function saveMessage(
  msg: TelegramMessage
): Promise<SaveResult> {
  const type      = resolveType(msg);
  const fileId    = resolveFileId(msg);
  const fileName  = msg.document?.file_name ?? null;
  const text      = msg.text ?? msg.caption ?? null;
  const userId    = msg.from?.id    ?? 0;
  const username  = msg.from?.username  ?? null;
  const Name = msg.from?.first_name ?? null;
  const createdAt = new Date(msg.date * 1000); // Unix → JS Date

  // upsert: insert if messageId is new, skip (no-op update) if duplicate
  const result = await prisma.message.upsert({
    where:  { messageId: msg.message_id },
    update: {},                             // duplicate → do nothing
    create: {
  messageId:  msg.message_id,
  chatId:     BigInt(msg.chat.id),
  userId:     BigInt(userId),
  username,

  text,
  type,
  fileId,
  fileName,

  createdAt,
},
  });

  // Prisma upsert always returns the record; detect create vs skip
  // by comparing savedAt ≈ now (within 2 s)
  const isNew = Date.now() - result.savedAt.getTime() < 2000;

  return {
    action:    isNew ? "created" : "skipped",
    id:        result.id,
    messageId: result.messageId,
  };
}