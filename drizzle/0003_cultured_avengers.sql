CREATE TABLE "command_intents" (
	"user_id" text NOT NULL,
	"domain" text NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"error_status" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_intents_user_id_domain_key_pk" PRIMARY KEY("user_id","domain","key")
);
--> statement-breakpoint
ALTER TABLE "command_intents" ADD CONSTRAINT "command_intents_user_id_player_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_states"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "command_intents_ready" ON "command_intents" USING btree ("status","run_at","lease_until");--> statement-breakpoint
CREATE INDEX "command_intents_owner_open" ON "command_intents" USING btree ("user_id","domain","status");