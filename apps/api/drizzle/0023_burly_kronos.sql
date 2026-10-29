CREATE TABLE "page_visits" (
	"id" text PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"post_id" integer,
	"visitor" text NOT NULL,
	"landing" boolean DEFAULT false NOT NULL,
	"returning" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'internal' NOT NULL,
	"referrer_host" text,
	"device" text DEFAULT 'desktop' NOT NULL,
	"signed_in" boolean DEFAULT false NOT NULL,
	"read_depth" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_visits" ADD CONSTRAINT "page_visits_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_visits_created_idx" ON "page_visits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "page_visits_post_idx" ON "page_visits" USING btree ("post_id","created_at");