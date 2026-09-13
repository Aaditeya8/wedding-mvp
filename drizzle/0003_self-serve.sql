CREATE TYPE "public"."family_source" AS ENUM('committee', 'import', 'guest');--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"kind" text NOT NULL,
	"link" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "diet" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "source" "family_source" DEFAULT 'committee' NOT NULL;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "bride_parents" text;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "groom_parents" text;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "hashtag" text;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "rsvp_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "rsvp_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "travel" jsonb;