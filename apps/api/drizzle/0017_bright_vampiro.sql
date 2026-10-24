CREATE TABLE "post_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"position" integer NOT NULL,
	"anchor" text NOT NULL,
	"heading" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(384)
);
--> statement-breakpoint
ALTER TABLE "post_sections" ADD CONSTRAINT "post_sections_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_sections_post_position_idx" ON "post_sections" USING btree ("post_id","position");--> statement-breakpoint
CREATE INDEX "post_sections_text_idx" ON "post_sections" USING gin (to_tsvector('english', "heading" || ' ' || "content"));--> statement-breakpoint
CREATE INDEX "post_sections_embedding_idx" ON "post_sections" USING hnsw ("embedding" vector_cosine_ops);