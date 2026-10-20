CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" text NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;