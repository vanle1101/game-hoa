CREATE TABLE "accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guest_claims" (
	"guest_user_id" text PRIMARY KEY NOT NULL,
	"account_user_id" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_accounts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_claims" ADD CONSTRAINT "guest_claims_guest_user_id_player_states_user_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."player_states"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_claims" ADD CONSTRAINT "guest_claims_account_user_id_accounts_user_id_fk" FOREIGN KEY ("account_user_id") REFERENCES "public"."accounts"("user_id") ON DELETE no action ON UPDATE no action;