CREATE TYPE "IngestionJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'INDEXED', 'FAILED', 'CANCELED');

CREATE TABLE "IngestionJob" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "documentId" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "size" INTEGER NOT NULL,
  "status" "IngestionJobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "stage" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IngestionJob_workspaceId_status_idx" ON "IngestionJob"("workspaceId", "status");
CREATE INDEX "IngestionJob_createdAt_idx" ON "IngestionJob"("createdAt");

ALTER TABLE "IngestionJob"
ADD CONSTRAINT "IngestionJob_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
