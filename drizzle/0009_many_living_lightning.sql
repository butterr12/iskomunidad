CREATE TABLE "user_selected_border" (
	"user_id" text PRIMARY KEY NOT NULL,
	"border_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_unlocked_border" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"border_id" text NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_selected_border" ADD CONSTRAINT "user_selected_border_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_unlocked_border" ADD CONSTRAINT "user_unlocked_border_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_unlocked_border_user_border_idx" ON "user_unlocked_border" USING btree ("user_id","border_id");--> statement-breakpoint
CREATE INDEX "user_unlocked_border_user_idx" ON "user_unlocked_border" USING btree ("user_id");