-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobActivityType" ADD VALUE 'POST_PUBLISHED';
ALTER TYPE "JobActivityType" ADD VALUE 'COMMENT_ADDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'JOB_POST';
ALTER TYPE "NotificationKind" ADD VALUE 'JOB_COMMENT';

-- AlterTable
ALTER TABLE "JobFile" ADD COLUMN     "commentId" TEXT,
ADD COLUMN     "postId" TEXT;

-- CreateTable
CREATE TABLE "JobPostCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT,
    "emoji" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPostCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobComment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "postId" TEXT,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPostCategory_companyId_position_idx" ON "JobPostCategory"("companyId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "JobPostCategory_companyId_key_key" ON "JobPostCategory"("companyId", "key");

-- CreateIndex
CREATE INDEX "JobPost_companyId_jobId_publishedAt_idx" ON "JobPost"("companyId", "jobId", "publishedAt");

-- CreateIndex
CREATE INDEX "JobComment_companyId_postId_createdAt_idx" ON "JobComment"("companyId", "postId", "createdAt");

-- CreateIndex
CREATE INDEX "JobFile_postId_idx" ON "JobFile"("postId");

-- CreateIndex
CREATE INDEX "JobFile_commentId_idx" ON "JobFile"("commentId");

-- AddForeignKey
ALTER TABLE "JobFile" ADD CONSTRAINT "JobFile_postId_fkey" FOREIGN KEY ("postId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFile" ADD CONSTRAINT "JobFile_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "JobComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostCategory" ADD CONSTRAINT "JobPostCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "JobPostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A comment hangs off exactly one thing. Only posts exist so far; to-dos and
-- events widen this as they arrive.
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_one_subject" CHECK (num_nonnulls("postId") = 1);

-- A file lives in at most one place: a folder, a post or a comment (none is the
-- top of Docs & Files).
ALTER TABLE "JobFile" ADD CONSTRAINT "JobFile_one_home" CHECK (num_nonnulls("folderId", "postId", "commentId") <= 1);

-- The five standard categories for every company already here. New companies
-- get them from `createCompanyWithOwner`. Stored by key, named on the way out.
INSERT INTO "JobPostCategory" ("id", "companyId", "key", "emoji", "position")
SELECT gen_random_uuid()::text, c."id", d."key", d."emoji", d."position"
FROM "Company" c
CROSS JOIN (VALUES
  ('ANNOUNCEMENT', '📢', 0),
  ('FYI', '✨', 1),
  ('HEARTBEAT', '❤️', 2),
  ('PITCH', '💡', 3),
  ('QUESTION', '❓', 4)
) AS d("key", "emoji", "position")
ON CONFLICT ("companyId", "key") DO NOTHING;
