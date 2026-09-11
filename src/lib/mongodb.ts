/**
 * MongoDB connection helper with caching and index management.
 *
 * - `connectDB()` → Connects to MongoDB, reuses cached connection, and ensures indexes are synced.
 * - Caches connection and index sync state in `global.mongoose` to prevent multiple connections in dev.
 * - `cleanupStaleIndexes(conn)` → Drops outdated indexes (e.g., legacy `wallet`), unsets old fields (e.g., `refreshToken`), and syncs current schema indexes.
 * - Handles migrations automatically when schema changes.
 * - Logs warnings without failing on index cleanup errors.
 */
import mongoose from "mongoose";
import logger from "./logger";

const MONGODB_URI = process.env.MONGODB_URI!;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  indexesSynced: boolean;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || {
  conn: null,
  promise: null,
  indexesSynced: false,
};
if (!global.mongoose) global.mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    if (!cached.indexesSynced) {
      cached.indexesSynced = true;
      await cleanupStaleIndexes(cached.conn);
    }
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }

  try {
    cached.conn = await cached.promise;
    if (!cached.indexesSynced) {
      cached.indexesSynced = true;
      await cleanupStaleIndexes(cached.conn);
    }
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}

/**
 * Drop any stale indexes that don't match current schema.
 * Handles migrations:
 *   - wallet_1 → walletAddress_1
 *   - refreshToken field → refreshTokenHash (unset old field)
 */
async function cleanupStaleIndexes(conn: typeof mongoose) {
  try {
    const db = conn.connection.db;
    if (!db) return;

    const collections = await db.listCollections().toArray();
    const usersExists = collections.some((c) => c.name === "users");

    if (usersExists) {
      const usersCol = db.collection("users");
      const indexes = await usersCol.indexes();

      for (const idx of indexes) {
        if (idx.key && "wallet" in idx.key && idx.name !== "_id_") {
          await usersCol.dropIndex(idx.name!);
        }
      }
      await usersCol.updateMany(
        { refreshToken: { $exists: true } },
        { $unset: { refreshToken: "" } }
      );
    }

    await mongoose.syncIndexes();
  } catch (err) {
    logger.warn("[MongoDB] Index cleanup warning:", err);
  }
}
