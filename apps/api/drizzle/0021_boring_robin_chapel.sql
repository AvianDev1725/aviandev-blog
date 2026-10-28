ALTER TABLE "ask_events" ADD COLUMN "audience" text DEFAULT 'reader' NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_settings" ADD COLUMN "admin_enabled" boolean DEFAULT false NOT NULL;