ALTER TABLE "user" ADD COLUMN "inviter_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_inviter_id_idx" ON "user" ("inviter_id");
