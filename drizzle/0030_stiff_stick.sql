CREATE TABLE "landmark_edit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landmark_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"changes" jsonb NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "place_category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "landmark" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "landmark_edit" ADD CONSTRAINT "landmark_edit_landmark_id_landmark_id_fk" FOREIGN KEY ("landmark_id") REFERENCES "public"."landmark"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landmark_edit" ADD CONSTRAINT "landmark_edit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landmark_edit" ADD CONSTRAINT "landmark_edit_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landmark" ADD CONSTRAINT "landmark_category_id_place_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."place_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "place_category" ("name", "slug", "icon", "color", "order") VALUES
  ('Restaurant', 'restaurant', 'utensils', '#ef4444', 1),
  ('Cafe', 'cafe', 'coffee', '#f97316', 2),
  ('Library', 'library', 'library', '#3b82f6', 3),
  ('Gym', 'gym', 'dumbbell', '#8b5cf6', 4),
  ('Park', 'park', 'trees', '#22c55e', 5),
  ('Chapel', 'chapel', 'church', '#a855f7', 6),
  ('Dormitory', 'dormitory', 'bed-double', '#6366f1', 7),
  ('Store', 'store', 'shopping-bag', '#ec4899', 8),
  ('Office', 'office', 'building-2', '#64748b', 9),
  ('Museum', 'museum', 'landmark', '#0ea5e9', 10),
  ('Sports Facility', 'sports-facility', 'trophy', '#f59e0b', 11),
  ('Parking', 'parking', 'car', '#78716c', 12),
  ('Health Center', 'health-center', 'heart-pulse', '#dc2626', 13),
  ('Bank / ATM', 'bank-atm', 'banknote', '#16a34a', 14),
  ('Food Stall', 'food-stall', 'sandwich', '#fb923c', 15),
  ('Auditorium', 'auditorium', 'presentation', '#7c3aed', 16),
  ('Laboratory', 'laboratory', 'flask-conical', '#06b6d4', 17),
  ('Garden', 'garden', 'flower-2', '#10b981', 18),
  ('Monument', 'monument', 'monument', '#e11d48', 19),
  ('Gate', 'gate', 'door-open', '#71717a', 20),
  ('Bus Stop', 'bus-stop', 'bus', '#0284c7', 21),
  ('Study Area', 'study-area', 'book-open', '#2563eb', 22),
  ('Canteen', 'canteen', 'soup', '#ea580c', 23),
  ('Event Venue', 'event-venue', 'calendar-days', '#16a34a', 24),
  ('Convenience Store', 'convenience-store', 'store', '#d946ef', 25),
  ('Print Shop', 'print-shop', 'printer', '#475569', 26),
  ('Water Refill', 'water-refill', 'droplets', '#0ea5e9', 27),
  ('Other', 'other', 'map-pin', '#6b7280', 28);--> statement-breakpoint
UPDATE "landmark" SET "category_id" = (SELECT "id" FROM "place_category" WHERE "slug" = 'monument') WHERE "category" = 'attraction';--> statement-breakpoint
UPDATE "landmark" SET "category_id" = (SELECT "id" FROM "place_category" WHERE "slug" = 'other') WHERE "category" = 'community';--> statement-breakpoint
UPDATE "landmark" SET "category_id" = (SELECT "id" FROM "place_category" WHERE "slug" = 'event-venue') WHERE "category" = 'event';