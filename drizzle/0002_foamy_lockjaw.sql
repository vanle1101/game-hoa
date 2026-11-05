CREATE TABLE "construction_drafts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan" jsonb NOT NULL,
	"base_revision" integer NOT NULL,
	"draft_revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_portraits" (
	"user_id" text NOT NULL,
	"portrait_key" text NOT NULL,
	"data_url" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_portraits_user_id_portrait_key_pk" PRIMARY KEY("user_id","portrait_key")
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "construction_drafts" ADD CONSTRAINT "construction_drafts_user_id_player_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_states"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_portraits" ADD CONSTRAINT "user_portraits_user_id_player_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_states"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_user_id_player_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_states"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_owner_key" ON "background_jobs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "background_jobs_ready" ON "background_jobs" USING btree ("status","run_at","lease_until");