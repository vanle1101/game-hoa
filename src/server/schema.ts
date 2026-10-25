import { pgTable, text, jsonb, timestamp, primaryKey, integer } from "drizzle-orm/pg-core";
import type { GameState } from "@/domain/types";

// One aggregate per owner serializes cross-domain game transactions. Finance is separate.
export const playerStates = pgTable("player_states", {
  userId: text("user_id").primaryKey(), state: jsonb("state").$type<GameState>().notNull(),
  revision: integer("revision").notNull().default(0), updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
});
export const commandRecords = pgTable("command_records", {
  userId: text("user_id").notNull().references(()=>playerStates.userId,{onDelete:"cascade"}),
  key: text("key").notNull(), fingerprint:text("fingerprint").notNull(), result:jsonb("result").notNull(), createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[primaryKey({columns:[t.userId,t.key]})]);
export const financeStates = pgTable("finance_states",{
  userId:text("user_id").primaryKey().references(()=>playerStates.userId,{onDelete:"cascade"}),
  state:jsonb("state").notNull(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
});
export const aiProposals = pgTable("ai_proposals",{
  id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>playerStates.userId,{onDelete:"cascade"}),
  proposal:jsonb("proposal").notNull(),status:text("status").notNull().default("pending"),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
