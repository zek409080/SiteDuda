-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 1;
