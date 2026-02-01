-- CreateTable
CREATE TABLE "Toilet" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Toilet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "toiletId" INTEGER NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Toilet_externalId_key" ON "Toilet"("externalId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_toiletId_fkey" FOREIGN KEY ("toiletId") REFERENCES "Toilet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
