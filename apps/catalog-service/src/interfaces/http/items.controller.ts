import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenClaims, CurrentUser, JwtAuthGuard, ParseObjectIdPipe } from '@contenthub/common';
import { CreateItemUseCase } from '../../application/create-item.use-case';
import { DeleteItemUseCase } from '../../application/delete-item.use-case';
import { GetItemBySlugUseCase } from '../../application/get-item-by-slug.use-case';
import { LikeItemUseCase } from '../../application/like-item.use-case';
import { ListItemsUseCase, Pagination } from '../../application/list-items.use-case';
import { PublishItemUseCase } from '../../application/publish-item.use-case';
import { UnlikeItemUseCase } from '../../application/unlike-item.use-case';
import { UpdateItemUseCase } from '../../application/update-item.use-case';
import { toItemListResponse, toItemResponse, toLikeResponse } from './catalog.mapper';
import { CreateItemDto, ItemListResponseDto, ItemResponseDto, LikeResponseDto, ListItemsQueryDto, UpdateItemDto } from './dto/item.dto';

@ApiTags('items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('items')
export class ItemsController {
  constructor(
    private readonly createItem: CreateItemUseCase,
    private readonly listItems: ListItemsUseCase,
    private readonly getItemBySlug: GetItemBySlugUseCase,
    private readonly updateItem: UpdateItemUseCase,
    private readonly deleteItem: DeleteItemUseCase,
    private readonly publishItem: PublishItemUseCase,
    private readonly likeItem: LikeItemUseCase,
    private readonly unlikeItem: UnlikeItemUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an item. It starts as a draft.' })
  @ApiCreatedResponse({ type: ItemResponseDto })
  async create(@CurrentUser() user: AccessTokenClaims, @Body() body: CreateItemDto): Promise<ItemResponseDto> {
    const item = await this.createItem.execute({ authorId: user.sub, title: body.title, body: body.body, tags: body.tags ?? [] });
    return toItemResponse(item);
  }

  @Get()
  @ApiOperation({ summary: 'List items with filters, sorting and offset or cursor pagination' })
  @ApiOkResponse({ type: ItemListResponseDto })
  async list(@CurrentUser() user: AccessTokenClaims, @Query() query: ListItemsQueryDto): Promise<ItemListResponseDto> {
    const pagination: Pagination =
      query.pagination === 'cursor' || query.cursor !== undefined
        ? { mode: 'cursor', cursor: query.cursor || null, pageSize: query.pageSize }
        : { mode: 'offset', page: query.page, pageSize: query.pageSize };

    const result = await this.listItems.execute({
      viewerId: user.sub,
      filters: {
        text: query.q?.trim() || undefined,
        tags: query.tags ?? [],
        tagMode: query.tagMode,
        authorId: query.authorId,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      sort: { field: query.sort, order: query.order },
      pagination,
    });
    return toItemListResponse(result);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Read one item by slug. Adds one view.' })
  @ApiOkResponse({ type: ItemResponseDto })
  async bySlug(@CurrentUser() user: AccessTokenClaims, @Param('slug') slug: string): Promise<ItemResponseDto> {
    return toItemResponse(await this.getItemBySlug.execute(slug, user.sub));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an item. Author only.' })
  @ApiOkResponse({ type: ItemResponseDto })
  async update(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: UpdateItemDto,
  ): Promise<ItemResponseDto> {
    const item = await this.updateItem.execute(id, user.sub, {
      title: body.title,
      body: body.body,
      tags: body.tags,
      archive: body.status === 'archived',
    });
    return toItemResponse(item);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an item and its likes. Author only.' })
  async remove(@CurrentUser() user: AccessTokenClaims, @Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.deleteItem.execute(id, user.sub);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish a draft. Author only.' })
  @ApiOkResponse({ type: ItemResponseDto })
  async publish(@CurrentUser() user: AccessTokenClaims, @Param('id', ParseObjectIdPipe) id: string): Promise<ItemResponseDto> {
    return toItemResponse(await this.publishItem.execute(id, user.sub));
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like an item. Runs in a transaction. A second like gives 409.' })
  @ApiCreatedResponse({ type: LikeResponseDto })
  async like(@CurrentUser() user: AccessTokenClaims, @Param('id', ParseObjectIdPipe) id: string): Promise<LikeResponseDto> {
    return toLikeResponse(await this.likeItem.execute(id, user.sub));
  }

  @Delete(':id/like')
  @ApiOperation({ summary: 'Remove my like. Runs in a transaction.' })
  @ApiOkResponse({ type: LikeResponseDto })
  async unlike(@CurrentUser() user: AccessTokenClaims, @Param('id', ParseObjectIdPipe) id: string): Promise<LikeResponseDto> {
    return toLikeResponse(await this.unlikeItem.execute(id, user.sub));
  }
}
