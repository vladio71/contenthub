import { ClientSession, Connection } from 'mongoose';

/**
 * Runs `work` in a MongoDB transaction. withTransaction commits at the end,
 * aborts if `work` throws, and runs `work` again on transient errors such as write conflicts.
 * So `work` must be safe to repeat: only do database writes inside it.
 * Transactions need a replica set.
 */
export async function runInTransaction<T>(connection: Connection, work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await connection.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
