export const STATS_REPOSITORY = Symbol('STATS_REPOSITORY');

export interface TagStat {
  tag: string;
  items: number;
  likes: number;
}

export interface AuthorStat {
  authorId: string;
  items: number;
  likes: number;
  views: number;
}

export interface AuthorStatsReport {
  topAuthors: AuthorStat[];
  totals: { authors: number; items: number; likes: number; views: number };
}

/** Read-only reports over published items. */
export interface StatsRepository {
  topTags(limit: number): Promise<TagStat[]>;
  authorStats(limit: number): Promise<AuthorStatsReport>;
}
