ALTER TABLE "posts" ADD COLUMN "seo_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "seo_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "share_image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "noindex" boolean DEFAULT false NOT NULL;