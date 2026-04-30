-- Per-org LLM settings + Copilot saved skills

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "llmConfig" JSONB NOT NULL DEFAULT '{}';

CREATE TYPE "CopilotSkillVisibility" AS ENUM ('PRIVATE', 'ORG');

CREATE TABLE "CopilotSkill" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "CopilotSkillVisibility" NOT NULL DEFAULT 'PRIVATE',
    "applicableResourceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotSkill_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CopilotSkill_organizationId_idx" ON "CopilotSkill"("organizationId");
CREATE INDEX "CopilotSkill_userId_idx" ON "CopilotSkill"("userId");

ALTER TABLE "CopilotSkill" ADD CONSTRAINT "CopilotSkill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopilotSkill" ADD CONSTRAINT "CopilotSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
