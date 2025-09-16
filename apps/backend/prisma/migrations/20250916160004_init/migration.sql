-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "libraries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "locations" TEXT NOT NULL,
    "refreshProgress" REAL,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "overview" TEXT,
    "parentId" TEXT,
    "libraryId" TEXT NOT NULL,
    "path" TEXT,
    "pathHash" TEXT,
    "dateCreated" DATETIME NOT NULL,
    "dateModified" DATETIME,
    "year" INTEGER,
    "premiereDate" DATETIME,
    "endDate" DATETIME,
    "runTimeTicks" BIGINT,
    "runtimeMins" INTEGER,
    "indexNumber" INTEGER,
    "parentIndexNumber" INTEGER,
    "providerIds" TEXT NOT NULL DEFAULT '{}',
    "genres" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "studios" TEXT NOT NULL DEFAULT '[]',
    "hasArtwork" BOOLEAN NOT NULL DEFAULT false,
    "imageBlurHashes" TEXT,
    "suspectedMisclassification" BOOLEAN NOT NULL DEFAULT false,
    "misclassificationScore" REAL,
    "misclassificationReasons" TEXT,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "items_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "artwork_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "language" TEXT,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "artwork_candidates_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "person_info" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "type" TEXT NOT NULL,
    "personId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "person_info_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'manual',
    "rules" TEXT,
    "sortBy" TEXT,
    "sortOrder" TEXT DEFAULT 'asc',
    "itemLimit" INTEGER,
    "jellyfinId" TEXT,
    "lastBuiltAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "collection_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collection_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "collection_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" REAL NOT NULL DEFAULT 0.0,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "errorMessage" TEXT,
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT,
    "itemId" TEXT,
    "operation" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "requestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "operation_logs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "libraries_jellyfinId_key" ON "libraries"("jellyfinId");

-- CreateIndex
CREATE UNIQUE INDEX "items_jellyfinId_key" ON "items"("jellyfinId");

-- CreateIndex
CREATE INDEX "items_libraryId_idx" ON "items"("libraryId");

-- CreateIndex
CREATE INDEX "items_type_idx" ON "items"("type");

-- CreateIndex
CREATE INDEX "items_parentId_idx" ON "items"("parentId");

-- CreateIndex
CREATE INDEX "items_dateCreated_idx" ON "items"("dateCreated");

-- CreateIndex
CREATE INDEX "items_suspectedMisclassification_idx" ON "items"("suspectedMisclassification");

-- CreateIndex
CREATE INDEX "artwork_candidates_itemId_type_idx" ON "artwork_candidates"("itemId", "type");

-- CreateIndex
CREATE INDEX "artwork_candidates_source_idx" ON "artwork_candidates"("source");

-- CreateIndex
CREATE INDEX "person_info_itemId_idx" ON "person_info"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "collection_items_collectionId_itemId_key" ON "collection_items"("collectionId", "itemId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_type_idx" ON "jobs"("type");

-- CreateIndex
CREATE INDEX "jobs_createdAt_idx" ON "jobs"("createdAt");

-- CreateIndex
CREATE INDEX "operation_logs_jobId_idx" ON "operation_logs"("jobId");

-- CreateIndex
CREATE INDEX "operation_logs_itemId_idx" ON "operation_logs"("itemId");

-- CreateIndex
CREATE INDEX "operation_logs_operation_idx" ON "operation_logs"("operation");

-- CreateIndex
CREATE INDEX "operation_logs_createdAt_idx" ON "operation_logs"("createdAt");

-- CreateIndex
CREATE INDEX "provider_cache_expiresAt_idx" ON "provider_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "provider_cache_provider_cacheKey_key" ON "provider_cache"("provider", "cacheKey");
