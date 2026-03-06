CREATE TABLE "match_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id_a" text NOT NULL,
	"user_id_b" text NOT NULL,
	"session_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"matched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_pic_swap" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"initiator_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"image_key_a" text,
	"image_key_b" text,
	"uploaded_at_a" timestamp,
	"uploaded_at_b" timestamp,
	"revealed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "match_profile_prompt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_prompt_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"prompt_text" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_swipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swiper_id" text NOT NULL,
	"target_id" text NOT NULL,
	"direction" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cm_session" ADD COLUMN "type" text DEFAULT 'anon_chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "cm_session" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "source" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "match_match" ADD CONSTRAINT "match_match_user_id_a_user_id_fk" FOREIGN KEY ("user_id_a") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_match" ADD CONSTRAINT "match_match_user_id_b_user_id_fk" FOREIGN KEY ("user_id_b") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_match" ADD CONSTRAINT "match_match_session_id_cm_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cm_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_pic_swap" ADD CONSTRAINT "match_pic_swap_session_id_cm_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cm_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_pic_swap" ADD CONSTRAINT "match_pic_swap_initiator_id_user_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_profile" ADD CONSTRAINT "match_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_profile_prompt" ADD CONSTRAINT "match_profile_prompt_profile_id_match_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."match_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_profile_prompt" ADD CONSTRAINT "match_profile_prompt_prompt_id_match_prompt_pool_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."match_prompt_pool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_swipe" ADD CONSTRAINT "match_swipe_swiper_id_user_id_fk" FOREIGN KEY ("swiper_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_swipe" ADD CONSTRAINT "match_swipe_target_id_user_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_match_pair_idx" ON "match_match" USING btree ("user_id_a","user_id_b");--> statement-breakpoint
CREATE INDEX "match_match_user_a_idx" ON "match_match" USING btree ("user_id_a");--> statement-breakpoint
CREATE INDEX "match_match_user_b_idx" ON "match_match" USING btree ("user_id_b");--> statement-breakpoint
CREATE INDEX "match_match_status_idx" ON "match_match" USING btree ("status");--> statement-breakpoint
CREATE INDEX "match_match_expires_idx" ON "match_match" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "match_profile_prompt_profile_idx" ON "match_profile_prompt" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_swipe_pair_idx" ON "match_swipe" USING btree ("swiper_id","target_id");--> statement-breakpoint
CREATE INDEX "match_swipe_target_idx" ON "match_swipe" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "match_swipe_swiper_created_idx" ON "match_swipe" USING btree ("swiper_id","created_at");
