import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";
import { mkdirSync } from "fs";
import { dirname } from "path";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "file:./prisma/dev.db";

// Strip the "file:" prefix for better-sqlite3 (expects a plain path)
const dbPath = DATABASE_URL.replace(/^file:/, "");

// Ensure the directory exists — better-sqlite3 creates the file but not the directory.
mkdirSync(dirname(dbPath), { recursive: true });

const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
