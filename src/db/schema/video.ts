import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const videoFormat = pgEnum("video_format", [
  "144",
  "240",
  "360",
  "480",
  "720",
]);

export const videoStatus = pgEnum("video_status", [
  "PENDING",
  "UPLOADING",
  "PROCESSING",
  "READY",
  "FAILED",
]);

export const video = pgTable(
  "video",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    format: videoFormat("format").array(),
    size: integer("size").notNull(),
    s3Key: text("s3_key").notNull(),
    hlsIndexKey: text("hls_index_key").notNull(),
    status: videoStatus("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("video_userId_idx").on(table.userId)],
);

export const videoRelations = relations(video, ({ one }) => ({
  user: one(user, {
    fields: [video.userId],
    references: [user.id],
  }),
}));
