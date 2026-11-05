import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { HttpError } from "./errors";

let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

/** Shared application/worker pool. Never log the connection URL. */
export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new HttpError(503, "Chưa cấu hình cơ sở dữ liệu PostgreSQL.");
  if (!db) {
    const hostname = new URL(url).hostname;
    const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    db = drizzle(postgres(url, { max: 3, prepare: false, ssl: local ? false : "require" }), { schema });
  }
  return db;
}
