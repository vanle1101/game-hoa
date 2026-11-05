import { integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { BuildingPlan } from "@/construction/types";
import { playerStates } from "./schema";

export const userPortraits = pgTable("user_portraits", {
  userId: text("user_id").notNull().references(() => playerStates.userId, { onDelete: "cascade" }),
  portraitKey: text("portrait_key").notNull(),
  dataUrl: text("data_url").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.userId, table.portraitKey] })]);

export const constructionDrafts = pgTable("construction_drafts", {
  userId: text("user_id").primaryKey().references(() => playerStates.userId, { onDelete: "cascade" }),
  plan: jsonb("plan").$type<BuildingPlan>().notNull(),
  baseRevision: integer("base_revision").notNull(),
  draftRevision: integer("draft_revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
