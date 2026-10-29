import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@contenthub/common';
import { GetAuthorStatsUseCase, GetTagStatsUseCase } from '../../application/stats.use-cases';
import { AuthorStatsResponseDto, StatsQueryDto, TagStatResponseDto } from './dto/item.dto';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(
    private readonly tagStats: GetTagStatsUseCase,
    private readonly authorStats: GetAuthorStatsUseCase,
  ) {}

  @Get('tags')
  @ApiOperation({ summary: 'Most used tags in published items ($unwind, $group, $sort, $limit)' })
  @ApiOkResponse({ type: [TagStatResponseDto] })
  tags(@Query() query: StatsQueryDto): Promise<TagStatResponseDto[]> {
    return this.tagStats.execute(query.limit);
  }

  @Get('authors')
  @ApiOperation({ summary: 'Top authors and totals in one aggregation ($group and $facet)' })
  @ApiOkResponse({ type: AuthorStatsResponseDto })
  authors(@Query() query: StatsQueryDto): Promise<AuthorStatsResponseDto> {
    return this.authorStats.execute(query.limit);
  }
}
