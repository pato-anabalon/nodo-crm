-- DropIndex
DROP INDEX "Invitation_token_key";

-- AlterTable
ALTER TABLE "Invitation" DROP COLUMN "token",
ADD COLUMN     "hashedToken" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_hashedToken_key" ON "Invitation"("hashedToken");
