ALTER TABLE "community_post" ADD COLUMN "draft_source" text;
--> statement-breakpoint
ALTER TABLE "campus_event" ADD COLUMN "cover_image_key" text;
--> statement-breakpoint
UPDATE "community_post" SET "draft_source" = 'moderation' WHERE status = 'draft';
