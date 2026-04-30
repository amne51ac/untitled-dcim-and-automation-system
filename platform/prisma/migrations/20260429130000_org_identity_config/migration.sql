-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "identityConfig" JSONB NOT NULL DEFAULT '{}';
