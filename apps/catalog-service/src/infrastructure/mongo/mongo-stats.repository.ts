import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo } from 'mongoose';
import { AuthorStatsReport, StatsRepository, TagStat } from '../../domain/repositories/stats-repository';
import { ITEM_COLLECTION_NAME } from './collection-names';

interface TagRow {
  _id: string;
  items: number;
  likes: number;
}

interface AuthorRow {
  _id: string;
  items: number;
  likes: number;
  views: number;
}

interface AuthorFacetResult {
  top: AuthorRow[];
  totals: Array<{ authors: number; items: number; likes: number; views: number }>;
}

/** Reports written as native aggregation pipelines on the driver collection. No Mongoose model here. */
@Injectable()
export class MongoStatsRepository implements StatsRepository {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get items(): mongo.Collection {
    if (!this.connection.db) {
      throw new Error('MongoDB connection is not ready');
    }
    return this.connection.db.collection(ITEM_COLLECTION_NAME);
  }

  async topTags(limit: number): Promise<TagStat[]> {
    const rows = await this.items
      .aggregate<TagRow>([
        { $match: { status: 'published' } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', items: { $sum: 1 }, likes: { $sum: '$stats.likes' } } },
        { $sort: { items: -1, likes: -1, _id: 1 } },
        { $limit: limit },
      ])
      .toArray();
    return rows.map((row) => ({ tag: row._id, items: row.items, likes: row.likes }));
  }

  async authorStats(limit: number): Promise<AuthorStatsReport> {
    const [result] = await this.items
      .aggregate<AuthorFacetResult>([
        { $match: { status: 'published' } },
        {
          $group: {
            _id: '$authorId',
            items: { $sum: 1 },
            likes: { $sum: '$stats.likes' },
            views: { $sum: '$stats.views' },
          },
        },
        {
          // One pass over the grouped rows gives both the top list and the grand totals.
          $facet: {
            top: [{ $sort: { likes: -1, items: -1, _id: 1 } }, { $limit: limit }],
            totals: [
              {
                $group: {
                  _id: null,
                  authors: { $sum: 1 },
                  items: { $sum: '$items' },
                  likes: { $sum: '$likes' },
                  views: { $sum: '$views' },
                },
              },
            ],
          },
        },
      ])
      .toArray();

    const totals = result?.totals[0] ?? { authors: 0, items: 0, likes: 0, views: 0 };
    return {
      topAuthors: (result?.top ?? []).map((row) => ({ authorId: row._id, items: row.items, likes: row.likes, views: row.views })),
      totals: { authors: totals.authors, items: totals.items, likes: totals.likes, views: totals.views },
    };
  }
}
