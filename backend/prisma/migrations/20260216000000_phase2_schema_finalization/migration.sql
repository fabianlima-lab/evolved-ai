-- Phase 2: Schema Finalization Migration
-- Renames tables, adds new fields, drops legacy columns, enforces 1:1 agent model

-- ============================================================
-- 1. RENAME TABLES
-- ============================================================

ALTER TABLE "users" RENAME TO "subscribers";
ALTER TABLE "warriors" RENAME TO "agents";
-- "messages" table name stays the same

-- Drop warrior_templates (no longer needed — agents are created from SOUL.md)
DROP TABLE IF EXISTS "warrior_templates" CASCADE;

-- ============================================================
-- 2. SUBSCRIBERS: rename constraints & indexes, add new columns
-- ============================================================

-- Rename primary key constraint
ALTER TABLE "subscribers" RENAME CONSTRAINT "users_pkey" TO "subscribers_pkey";

-- Rename unique indexes
ALTER INDEX "users_email_key" RENAME TO "subscribers_email_key";
ALTER INDEX "users_google_id_key" RENAME TO "subscribers_google_id_key";
ALTER INDEX "users_password_reset_token_key" RENAME TO "subscribers_password_reset_token_key";

-- Add new subscriber columns
ALTER TABLE "subscribers" ADD COLUMN "name" VARCHAR(255);
ALTER TABLE "subscribers" ADD COLUMN "google_refresh_token" TEXT;
ALTER TABLE "subscribers" ADD COLUMN "google_access_token" TEXT;
ALTER TABLE "subscribers" ADD COLUMN "google_access_token_expiry" TIMESTAMP(3);
ALTER TABLE "subscribers" ADD COLUMN "google_scopes" VARCHAR(500);
ALTER TABLE "subscribers" ADD COLUMN "whatsapp_jid" VARCHAR(255);
ALTER TABLE "subscribers" ADD COLUMN "kajabi_contact_id" VARCHAR(255);
ALTER TABLE "subscribers" ADD COLUMN "kajabi_offer_id" VARCHAR(255);
ALTER TABLE "subscribers" ADD COLUMN "kajabi_purchase_date" TIMESTAMP(3);
ALTER TABLE "subscribers" ADD COLUMN "kajabi_cancel_date" TIMESTAMP(3);
ALTER TABLE "subscribers" ADD COLUMN "onboarding_complete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscribers" ADD COLUMN "onboarding_step" VARCHAR(30) NOT NULL DEFAULT 'pending';
ALTER TABLE "subscribers" ADD COLUMN "profile_data" JSONB;
ALTER TABLE "subscribers" ADD COLUMN "assistant_name" VARCHAR(100);

-- Add unique indexes for new columns
CREATE UNIQUE INDEX "subscribers_whatsapp_jid_key" ON "subscribers"("whatsapp_jid");
CREATE UNIQUE INDEX "subscribers_kajabi_contact_id_key" ON "subscribers"("kajabi_contact_id");

-- Backfill: mark existing users with goals as having completed onboarding
UPDATE "subscribers"
SET "onboarding_complete" = true, "onboarding_step" = 'complete'
WHERE "goals" IS NOT NULL AND "goals" != '';

-- Drop legacy Stripe columns
ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "stripe_customer_id";
ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "stripe_subscription_id";

-- Drop legacy channel columns (replaced by whatsapp_jid)
ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "channel";
ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "channel_id";
ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "channel_2";
ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "channel_2_id";

-- ============================================================
-- 3. AGENTS: restructure for single-agent model
-- ============================================================

-- Rename primary key constraint
ALTER TABLE "agents" RENAME CONSTRAINT "warriors_pkey" TO "agents_pkey";

-- Rename FK column: user_id → subscriber_id
ALTER TABLE "agents" RENAME COLUMN "user_id" TO "subscriber_id";

-- Drop old FK constraint
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "warriors_user_id_fkey";

-- Drop old template FK (warrior_templates no longer exist)
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "warriors_template_id_fkey";

-- Drop old index
DROP INDEX IF EXISTS "warriors_user_id_idx";

-- Add new agent columns
ALTER TABLE "agents" ADD COLUMN "name" VARCHAR(100);
ALTER TABLE "agents" ADD COLUMN "soul_md" TEXT;
ALTER TABLE "agents" ADD COLUMN "openclaw_agent_id" VARCHAR(255);

-- Backfill agent name from custom_name or template_id
UPDATE "agents" SET "name" = COALESCE("custom_name", "template_id", 'Assistant');

-- Make name NOT NULL after backfill
ALTER TABLE "agents" ALTER COLUMN "name" SET NOT NULL;

-- Drop legacy warrior columns
ALTER TABLE "agents" DROP COLUMN IF EXISTS "template_id";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "custom_name";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "warrior_class";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "tone";

-- Create unique index for 1:1 subscriber-agent model
CREATE UNIQUE INDEX "agents_subscriber_id_key" ON "agents"("subscriber_id");

-- Add new FK: agents.subscriber_id → subscribers.id
ALTER TABLE "agents" ADD CONSTRAINT "agents_subscriber_id_fkey"
  FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 4. MESSAGES: fix column types and add agent FK
-- ============================================================

-- Rename FK column: user_id → subscriber_id
ALTER TABLE "messages" RENAME COLUMN "user_id" TO "subscriber_id";

-- Rename direction → role
ALTER TABLE "messages" RENAME COLUMN "direction" TO "role";

-- Drop old FK constraint
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_user_id_fkey";

-- Drop old index
DROP INDEX IF EXISTS "messages_user_id_created_at_idx";

-- Rename warrior_id → agent_id (must happen before type conversion)
ALTER TABLE "messages" RENAME COLUMN "warrior_id" TO "agent_id";

-- Fix agent_id: VARCHAR(50) → UUID
-- First, delete orphaned messages whose agent_id doesn't match a valid agent
DELETE FROM "messages"
WHERE "agent_id" NOT IN (SELECT "id"::text FROM "agents");

-- Now convert the column
ALTER TABLE "messages" ALTER COLUMN "agent_id" TYPE UUID USING "agent_id"::uuid;

-- Widen role column to match schema (VARCHAR(20))
ALTER TABLE "messages" ALTER COLUMN "role" TYPE VARCHAR(20);

-- Add new FK constraints
ALTER TABLE "messages" ADD CONSTRAINT "messages_subscriber_id_fkey"
  FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate composite index with new column name
CREATE INDEX "messages_subscriber_id_created_at_idx" ON "messages"("subscriber_id", "created_at");
