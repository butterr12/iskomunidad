CREATE TABLE "banner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"variant" text DEFAULT 'info' NOT NULL,
	"cta_label" text,
	"cta_url" text,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banner_dismissal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"banner_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "banner_dismissal" ADD CONSTRAINT "banner_dismissal_banner_id_banner_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."banner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banner_dismissal" ADD CONSTRAINT "banner_dismissal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "banner_dismissal_uq" ON "banner_dismissal" USING btree ("banner_id","user_id");