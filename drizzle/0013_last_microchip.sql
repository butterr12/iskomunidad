ALTER TABLE "user" DROP CONSTRAINT "user_inviter_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "user_inviter_id_idx";