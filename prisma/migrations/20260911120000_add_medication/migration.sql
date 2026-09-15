-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "commercialName" TEXT NOT NULL,
    "activeIngredient" TEXT NOT NULL,
    "dosageForm" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Medication_commercialName_dosageForm_key" ON "Medication"("commercialName", "dosageForm");

-- CreateIndex
CREATE INDEX "Medication_category_idx" ON "Medication"("category");

-- CreateIndex
CREATE INDEX "Medication_activeIngredient_idx" ON "Medication"("activeIngredient");

-- CreateIndex
CREATE INDEX "Medication_commercialName_idx" ON "Medication"("commercialName");
