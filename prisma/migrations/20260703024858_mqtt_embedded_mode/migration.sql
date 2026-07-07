-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MqttConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brokerUrl" TEXT NOT NULL,
    "username" TEXT,
    "passwordEnc" TEXT,
    "topicPrefix" TEXT NOT NULL DEFAULT 'fully',
    "mode" TEXT NOT NULL DEFAULT 'external',
    "embeddedPort" INTEGER NOT NULL DEFAULT 1883
);
INSERT INTO "new_MqttConfig" ("brokerUrl", "id", "passwordEnc", "topicPrefix", "username") SELECT "brokerUrl", "id", "passwordEnc", "topicPrefix", "username" FROM "MqttConfig";
DROP TABLE "MqttConfig";
ALTER TABLE "new_MqttConfig" RENAME TO "MqttConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
