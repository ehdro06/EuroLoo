-- CreateTable
CREATE TABLE "UploadGrant" (
    "id" SERIAL NOT NULL,
    "objectName" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "UploadGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadGrant_objectName_key" ON "UploadGrant"("objectName");

-- CreateIndex
CREATE INDEX "UploadGrant_createdAt_idx" ON "UploadGrant"("createdAt");

-- CreateIndex
CREATE INDEX "UploadGrant_userId_createdAt_idx" ON "UploadGrant"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UploadGrant" ADD CONSTRAINT "UploadGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
