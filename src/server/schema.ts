import { pgTable, text, jsonb, timestamp, primaryKey, integer, index } from "drizzle-orm/pg-core";
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

/** Accepted mutations remain on the server until applied or explicitly rejected. */
export const commandIntents = pgTable("command_intents", {
  userId: text("user_id").notNull().references(() => playerStates.userId, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  key: text("key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("queued"),
  result: jsonb("result"),
  error: text("error"),
  errorStatus: integer("error_status"),
  attempts: integer("attempts").notNull().default(0),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  lockedBy: text("locked_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.userId, table.domain, table.key] }),
  index("command_intents_ready").on(table.status, table.runAt, table.leaseUntil),
  index("command_intents_owner_open").on(table.userId, table.domain, table.status),
]);
export const financeStates = pgTable("finance_states",{
  userId:text("user_id").primaryKey().references(()=>playerStates.userId,{onDelete:"cascade"}),
  state:jsonb("state").notNull(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
});
export const aiProposals = pgTable("ai_proposals",{
  id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>playerStates.userId,{onDelete:"cascade"}),
  proposal:jsonb("proposal").notNull(),status:text("status").notNull().default("pending"),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});

/** Account IDs are also player_states.user_id values; old guest rows stay intact. */
export const accounts = pgTable("accounts", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
});
export const authSessions = pgTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => accounts.userId, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
/** A guest save can be copied once and is retained for audit/recovery. */
export const guestClaims = pgTable("guest_claims", {
  guestUserId: text("guest_user_id").primaryKey().references(() => playerStates.userId),
  accountUserId: text("account_user_id").notNull().references(() => accounts.userId),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
});
