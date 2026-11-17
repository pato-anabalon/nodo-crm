-- AlterEnum
ALTER TYPE "JobActivityType" ADD VALUE 'CHAT_MESSAGES';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'JOB_CHAT_MENTION';

-- AlterTable
ALTER TABLE "JobFile" ADD COLUMN     "chatMessageId" TEXT;

-- CreateTable
CREATE TABLE "JobChatMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobChatMessage_companyId_jobId_createdAt_idx" ON "JobChatMessage"("companyId", "jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobFile_chatMessageId_idx" ON "JobFile"("chatMessageId");

-- AddForeignKey
ALTER TABLE "JobFile" ADD CONSTRAINT "JobFile_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "JobChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChatMessage" ADD CONSTRAINT "JobChatMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChatMessage" ADD CONSTRAINT "JobChatMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChatMessage" ADD CONSTRAINT "JobChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A file lives in one place: a folder, a post, a comment, a to-do or a chat message.
ALTER TABLE "JobFile" DROP CONSTRAINT "JobFile_one_home";
ALTER TABLE "JobFile" ADD CONSTRAINT "JobFile_one_home" CHECK (num_nonnulls("folderId", "postId", "commentId", "todoId", "chatMessageId") <= 1);
