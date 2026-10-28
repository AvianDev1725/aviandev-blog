CREATE TABLE "dismissed_searches" (
	"query" text PRIMARY KEY NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL,
	"dismissed_by" integer
);
--> statement-breakpoint
CREATE TABLE "search_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"result_count" integer NOT NULL,
	"topic" text,
	"opened_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dismissed_searches" ADD CONSTRAINT "dismissed_searches_dismissed_by_users_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_events_created_idx" ON "search_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_events_query_idx" ON "search_events" USING btree ("query");