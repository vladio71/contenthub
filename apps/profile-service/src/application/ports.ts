export const AVATAR_STORAGE = Symbol('AVATAR_STORAGE');
export const CLOCK = Symbol('CLOCK');

/** Where avatar files live. The real adapter uses the local disk (a docker volume). */
export interface AvatarStorage {
  /** Stores the bytes under a new random name and returns that name. */
  save(content: Buffer, extension: string): Promise<string>;
  delete(file: string): Promise<void>;
}

export interface Clock {
  now(): Date;
}
