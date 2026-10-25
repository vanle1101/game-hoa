CREATE TABLE "ai_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_records" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_records_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "finance_states" (
	"user_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_states" (
	"user_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_user_id_player_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_states"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_records" ADD CONSTRAINT "command_records_user_id_player_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_states"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_states" ADD CONSTRAINT "finance_states_user_id_player_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_states"("user_id") ON DELETE cascade ON UPDATE no action;