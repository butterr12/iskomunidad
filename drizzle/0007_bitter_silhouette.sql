CREATE TABLE "user_follow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_privacy_setting" (
	"user_id" text PRIMARY KEY NOT NULL,
	"allow_follows_from" text DEFAULT 'everyone' NOT NULL,
	"allow_messages_from" text DEFAULT 'everyone' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_following_id_user_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_privacy_setting" ADD CONSTRAINT "user_privacy_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_follow_pair_idx" ON "user_follow" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE INDEX "user_follow_follower_idx" ON "user_follow" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "user_follow_following_idx" ON "user_follow" USING btree ("following_id");