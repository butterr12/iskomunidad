CREATE TABLE "user_flair" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"flair_id" text NOT NULL,
	"visible" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_flair" ADD CONSTRAINT "user_flair_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_flair_user_flair_idx" ON "user_flair" USING btree ("user_id","flair_id");--> statement-breakpoint
CREATE INDEX "user_flair_user_idx" ON "user_flair" USING btree ("user_id");