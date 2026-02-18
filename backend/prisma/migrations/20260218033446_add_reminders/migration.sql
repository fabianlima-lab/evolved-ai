/*
  Warnings:

  - You are about to drop the column `openclaw_agent_id` on the `agents` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "agents" DROP COLUMN "openclaw_agent_id";

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "agent_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "channel" VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminders_subscriber_id_status_due_at_idx" ON "reminders"("subscriber_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "reminders_status_due_at_idx" ON "reminders"("status", "due_at");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
