CREATE TABLE "cm_ban" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source_report_id" uuid,
	"reason" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"lifted_at" timestamp,
	"lifted_by" text
);
--> statement-breakpoint
ALTER TABLE "cm_ban" ADD CONSTRAINT "cm_ban_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_ban" ADD CONSTRAINT "cm_ban_source_report_id_cm_report_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."cm_report"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_ban" ADD CONSTRAINT "cm_ban_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_ban" ADD CONSTRAINT "cm_ban_lifted_by_user_id_fk" FOREIGN KEY ("lifted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cm_ban_user_active_idx" ON "cm_ban" USING btree ("user_id","lifted_at","expires_at");--> statement-breakpoint
CREATE INDEX "cm_ban_expires_idx" ON "cm_ban" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "cm_ban_report_idx" ON "cm_ban" USING btree ("source_report_id");
