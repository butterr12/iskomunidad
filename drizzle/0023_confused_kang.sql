ALTER TABLE "community_post" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "campus_event_tags_gin_idx" ON "campus_event" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "community_post_tags_gin_idx" ON "community_post" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "gig_listing_tags_gin_idx" ON "gig_listing" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "landmark_tags_gin_idx" ON "landmark" USING gin ("tags");