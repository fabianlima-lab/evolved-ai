-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "personality" VARCHAR(500),
ADD COLUMN     "trait_growth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trait_knows_you" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trait_reliability" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trait_warmth" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "description" VARCHAR(300),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_skills" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(50),
    "category" VARCHAR(30) NOT NULL DEFAULT 'productivity',
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "required_integration" VARCHAR(50),
    "source" VARCHAR(20) NOT NULL DEFAULT 'admin',
    "installed_by" VARCHAR(20) NOT NULL DEFAULT 'admin',
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_integrations" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(50),
    "benefits" JSONB,
    "setup_prompt" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_pages" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "page_type" VARCHAR(30) NOT NULL DEFAULT 'html',
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_events" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_intentions" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "feeling" VARCHAR(200) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'morning_briefing',
    "options_offered" JSONB,
    "was_custom" BOOLEAN NOT NULL DEFAULT false,
    "set_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_intentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(1000),
    "column" VARCHAR(20) NOT NULL DEFAULT 'backlog',
    "priority" VARCHAR(10) NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_subscriber_id_date_idx" ON "expenses"("subscriber_id", "date");

-- CreateIndex
CREATE INDEX "expenses_subscriber_id_category_idx" ON "expenses"("subscriber_id", "category");

-- CreateIndex
CREATE INDEX "agent_skills_subscriber_id_idx" ON "agent_skills"("subscriber_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_skills_agent_id_slug_key" ON "agent_skills"("agent_id", "slug");

-- CreateIndex
CREATE INDEX "agent_integrations_subscriber_id_idx" ON "agent_integrations"("subscriber_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_integrations_agent_id_slug_key" ON "agent_integrations"("agent_id", "slug");

-- CreateIndex
CREATE INDEX "agent_pages_subscriber_id_idx" ON "agent_pages"("subscriber_id");

-- CreateIndex
CREATE INDEX "agent_pages_agent_id_idx" ON "agent_pages"("agent_id");

-- CreateIndex
CREATE INDEX "agent_events_agent_id_created_at_idx" ON "agent_events"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_events_subscriber_id_created_at_idx" ON "agent_events"("subscriber_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_events_event_type_idx" ON "agent_events"("event_type");

-- CreateIndex
CREATE INDEX "daily_intentions_subscriber_id_date_idx" ON "daily_intentions"("subscriber_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_intentions_subscriber_id_date_key" ON "daily_intentions"("subscriber_id", "date");

-- CreateIndex
CREATE INDEX "tasks_subscriber_id_column_idx" ON "tasks"("subscriber_id", "column");

-- CreateIndex
CREATE INDEX "tasks_agent_id_column_idx" ON "tasks"("agent_id", "column");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_integrations" ADD CONSTRAINT "agent_integrations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_integrations" ADD CONSTRAINT "agent_integrations_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_pages" ADD CONSTRAINT "agent_pages_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_pages" ADD CONSTRAINT "agent_pages_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_intentions" ADD CONSTRAINT "daily_intentions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
