CREATE TABLE "cm_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cm_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sender_id" text,
	"body" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cm_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"allow_anon_queue" boolean DEFAULT true NOT NULL,
	"default_alias" text,
	"last_scope" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cm_queue_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"alias" text NOT NULL,
	"scope" text NOT NULL,
	"heartbeat_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cm_rematch_cooldown" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id_low" text NOT NULL,
	"user_id_high" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cm_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"reporter_id" text NOT NULL,
	"reported_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cm_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"ended_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cm_session_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"alias" text NOT NULL,
	"connect_requested" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cm_block" ADD CONSTRAINT "cm_block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_block" ADD CONSTRAINT "cm_block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_message" ADD CONSTRAINT "cm_message_session_id_cm_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cm_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_message" ADD CONSTRAINT "cm_message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_preference" ADD CONSTRAINT "cm_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_queue_entry" ADD CONSTRAINT "cm_queue_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_rematch_cooldown" ADD CONSTRAINT "cm_rematch_cooldown_user_id_low_user_id_fk" FOREIGN KEY ("user_id_low") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_rematch_cooldown" ADD CONSTRAINT "cm_rematch_cooldown_user_id_high_user_id_fk" FOREIGN KEY ("user_id_high") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_report" ADD CONSTRAINT "cm_report_session_id_cm_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cm_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_report" ADD CONSTRAINT "cm_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_report" ADD CONSTRAINT "cm_report_reported_user_id_user_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_report" ADD CONSTRAINT "cm_report_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_session_participant" ADD CONSTRAINT "cm_session_participant_session_id_cm_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cm_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_session_participant" ADD CONSTRAINT "cm_session_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cm_block_pair_idx" ON "cm_block" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "cm_block_blocker_idx" ON "cm_block" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX "cm_block_blocked_idx" ON "cm_block" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "cm_message_session_created_idx" ON "cm_message" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cm_queue_entry_user_idx" ON "cm_queue_entry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cm_queue_entry_scope_idx" ON "cm_queue_entry" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "cm_queue_entry_heartbeat_idx" ON "cm_queue_entry" USING btree ("heartbeat_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cm_rematch_cooldown_pair_idx" ON "cm_rematch_cooldown" USING btree ("user_id_low","user_id_high");--> statement-breakpoint
CREATE INDEX "cm_rematch_cooldown_expires_idx" ON "cm_rematch_cooldown" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cm_report_session_reporter_idx" ON "cm_report" USING btree ("session_id","reporter_id");--> statement-breakpoint
CREATE INDEX "cm_report_status_created_idx" ON "cm_report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "cm_report_reported_user_idx" ON "cm_report" USING btree ("reported_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cm_session_participant_session_user_idx" ON "cm_session_participant" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "cm_session_participant_user_idx" ON "cm_session_participant" USING btree ("user_id");