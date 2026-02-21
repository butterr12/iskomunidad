ALTER TABLE "conversation" ADD COLUMN "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "deleted_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "delete_kind" text;
--> statement-breakpoint
ALTER TABLE "message_request" ADD COLUMN "resolved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "message_request_from_user_status_idx" ON "message_request" USING btree ("from_user_id","status");
--> statement-breakpoint
CREATE INDEX "message_request_status_resolved_idx" ON "message_request" USING btree ("status","resolved_at");
