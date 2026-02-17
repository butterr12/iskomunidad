CREATE TABLE "user_notification_setting" (
	"user_id" text PRIMARY KEY NOT NULL,
	"posts" boolean DEFAULT true NOT NULL,
	"events" boolean DEFAULT true NOT NULL,
	"gigs" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notification_setting" ADD CONSTRAINT "user_notification_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_notification_user_created_idx" ON "user_notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_notification_user_read_idx" ON "user_notification" USING btree ("user_id","is_read");