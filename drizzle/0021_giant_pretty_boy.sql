ALTER TABLE "campus_event" ADD COLUMN "external_links" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "community_post" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "community_post" ADD CONSTRAINT "community_post_event_id_campus_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."campus_event"("id") ON DELETE set null ON UPDATE no action;
