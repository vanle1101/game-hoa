import { defineConfig } from "drizzle-kit";
export default defineConfig({dialect:"postgresql",schema:["./src/server/schema.ts","./src/server/artifacts-schema.ts","./src/server/jobs-schema.ts"],out:"./drizzle",dbCredentials:{url:process.env.DATABASE_URL||"postgres://localhost/lifelevel"}});
