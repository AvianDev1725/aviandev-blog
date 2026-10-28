CREATE TYPE "public"."ask_status" AS ENUM('answered', 'not_found', 'error');--> statement-breakpoint
CREATE TABLE "ask_events" (
	"id" text PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"visitor" text NOT NULL,
	"status" "ask_status" NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"helpful" boolean,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider" text DEFAULT 'groq' NOT NULL,
	"model" text DEFAULT 'llama-3.3-70b-versatile' NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"daily_limit" integer DEFAULT 800 NOT NULL,
	"per_reader_limit" integer DEFAULT 20 NOT NULL,
	"answer_length" text DEFAULT 'medium' NOT NULL,
	"creativity" integer DEFAULT 2 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_settings" ADD CONSTRAINT "assistant_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_events_created_idx" ON "ask_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ask_events_visitor_idx" ON "ask_events" USING btree ("visitor","created_at");