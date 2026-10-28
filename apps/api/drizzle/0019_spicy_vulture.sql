ALTER TABLE "search_events" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "search_events" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_client_id_unique" UNIQUE("client_id");