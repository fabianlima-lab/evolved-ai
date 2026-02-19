-- CreateTable
CREATE TABLE "memories" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "fact" VARCHAR(300) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'ai',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memories_subscriber_id_category_idx" ON "memories"("subscriber_id", "category");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
