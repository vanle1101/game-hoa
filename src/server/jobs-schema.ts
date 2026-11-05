import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { playerStates } from "./schema";

/** Durable work accepted by the API. A worker lease may expire after a crash. */
export const backgroundJobs = pgTable("background_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => playerStates.userId, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("queued"),
  idempotencyKey: text("idempotency_key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  payload: jsonb("payload").$type<{ prompt: string }>().notNull(),
  result: jsonb("result").$type<{ proposalId: string } | null>(),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  lockedBy: text("locked_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("background_jobs_owner_key").on(table.userId, table.idempotencyKey),
  index("background_jobs_ready").on(table.status, table.runAt, table.leaseUntil),
]);
