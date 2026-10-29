import { Inject, Injectable } from '@nestjs/common';
import { STATS_REPOSITORY, AuthorStatsReport, StatsRepository, TagStat } from '../domain/repositories/stats-repository';

@Injectable()
export class GetTagStatsUseCase {
  constructor(@Inject(STATS_REPOSITORY) private readonly stats: StatsRepository) {}

  execute(limit: number): Promise<TagStat[]> {
    return this.stats.topTags(limit);
  }
}

@Injectable()
export class GetAuthorStatsUseCase {
  constructor(@Inject(STATS_REPOSITORY) private readonly stats: StatsRepository) {}

  execute(limit: number): Promise<AuthorStatsReport> {
    return this.stats.authorStats(limit);
  }
}
