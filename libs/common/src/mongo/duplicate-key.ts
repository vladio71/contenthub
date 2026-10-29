const DUPLICATE_KEY_CODE = 11000;

interface MongoErrorShape {
  code?: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, unknown>;
}

/**
 * If the error is a MongoDB duplicate key error, returns the names of the
 * fields of the violated unique index. Returns null for any other error.
 */
export function duplicateKeyFields(error: unknown): string[] | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const mongoError = error as MongoErrorShape;
  if (mongoError.code !== DUPLICATE_KEY_CODE) {
    return null;
  }
  return Object.keys(mongoError.keyPattern ?? mongoError.keyValue ?? {});
}
