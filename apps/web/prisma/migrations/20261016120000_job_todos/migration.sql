-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobActivityType" ADD VALUE 'TODO_LIST_CREATED';
ALTER TYPE "JobActivityType" ADD VALUE 'TODO_ADDED';
ALTER TYPE "JobActivityType" ADD VALUE 'TODO_COMPLETED';
ALTER TYPE "JobActivityType" ADD VALUE 'TODO_REOPENED';
ALTER TYPE "JobActivityType" ADD VALUE 'TODO_COMMENTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'JOB_TODO_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'JOB_TODO_COMPLETED';

-- AlterTable
ALTER TABLE "JobComment" ADD COLUMN     "todoId" TEXT,
ADD COLUMN     "todoListId" TEXT;

-- AlterTable
ALTER TABLE "JobFile" ADD COLUMN     "todoId" TEXT;

-- CreateTable
CREATE TABLE "JobTodoList" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTodoList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTodo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startsOn" DATE,
    "dueOn" DATE,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdById" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTodoAssignee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTodoAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobTodoList_companyId_jobId_position_idx" ON "JobTodoList"("companyId", "jobId", "position");

-- CreateIndex
CREATE INDEX "JobTodo_companyId_listId_position_idx" ON "JobTodo"("companyId", "listId", "position");

-- CreateIndex
CREATE INDEX "JobTodo_companyId_jobId_dueOn_idx" ON "JobTodo"("companyId", "jobId", "dueOn");

-- CreateIndex
CREATE INDEX "JobTodoAssignee_companyId_userId_idx" ON "JobTodoAssignee"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "JobTodoAssignee_todoId_userId_key" ON "JobTodoAssignee"("todoId", "userId");

-- CreateIndex
CREATE INDEX "JobComment_todoId_idx" ON "JobComment"("todoId");

-- CreateIndex
CREATE INDEX "JobComment_todoListId_idx" ON "JobComment"("todoListId");

-- CreateIndex
CREATE INDEX "JobFile_todoId_idx" ON "JobFile"("todoId");

-- AddForeignKey
ALTER TABLE "JobFile" ADD CONSTRAINT "JobFile_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "JobTodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "JobTodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_todoListId_fkey" FOREIGN KEY ("todoListId") REFERENCES "JobTodoList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodoList" ADD CONSTRAINT "JobTodoList_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodoList" ADD CONSTRAINT "JobTodoList_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodoList" ADD CONSTRAINT "JobTodoList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodo" ADD CONSTRAINT "JobTodo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodo" ADD CONSTRAINT "JobTodo_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodo" ADD CONSTRAINT "JobTodo_listId_fkey" FOREIGN KEY ("listId") REFERENCES "JobTodoList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodo" ADD CONSTRAINT "JobTodo_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodo" ADD CONSTRAINT "JobTodo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodoAssignee" ADD CONSTRAINT "JobTodoAssignee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodoAssignee" ADD CONSTRAINT "JobTodoAssignee_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "JobTodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTodoAssignee" ADD CONSTRAINT "JobTodoAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A comment is about exactly one thing: a post, a to-do or a to-do list.
ALTER TABLE "JobComment" DROP CONSTRAINT "JobComment_one_subject";
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_one_subject" CHECK (num_nonnulls("postId", "todoId", "todoListId") = 1);

-- A file lives in one place: a folder, a post, a comment or a to-do — or the
-- top of Docs & Files when none is set.
ALTER TABLE "JobFile" DROP CONSTRAINT "JobFile_one_home";
ALTER TABLE "JobFile" ADD CONSTRAINT "JobFile_one_home" CHECK (num_nonnulls("folderId", "postId", "commentId", "todoId") <= 1);
