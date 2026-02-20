-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "input_tokens" INTEGER,
ADD COLUMN     "model" VARCHAR(50),
ADD COLUMN     "output_tokens" INTEGER;
