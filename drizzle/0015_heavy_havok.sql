CREATE TABLE "abuse_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"triggered_rule" text,
	"current_count" integer,
	"limit_value" integer,
	"user_id_hash" text,
	"ip_hash" text,
	"device_hash" text,
	"mode" text DEFAULT 'enforce' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "abuse_event_action_created_idx" ON "abuse_event" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "abuse_event_decision_created_idx" ON "abuse_event" USING btree ("decision","created_at");--> statement-breakpoint
CREATE INDEX "abuse_event_user_id_hash_idx" ON "abuse_event" USING btree ("user_id_hash");--> statement-breakpoint
CREATE INDEX "abuse_event_created_idx" ON "abuse_event" USING btree ("created_at");