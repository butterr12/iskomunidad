CREATE TABLE "user_legal_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"consent_type" text DEFAULT 'signup' NOT NULL,
	"terms_version" text NOT NULL,
	"privacy_version" text NOT NULL,
	"legal_notice_version" text NOT NULL,
	"agreed_to_terms" boolean DEFAULT false NOT NULL,
	"agreed_to_privacy" boolean DEFAULT false NOT NULL,
	"age_attested" boolean DEFAULT false NOT NULL,
	"guardian_consent_attested" boolean DEFAULT false NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_legal_consent" ADD CONSTRAINT "user_legal_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_legal_consent_user_created_idx" ON "user_legal_consent" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_legal_consent_email_created_idx" ON "user_legal_consent" USING btree ("email","created_at");