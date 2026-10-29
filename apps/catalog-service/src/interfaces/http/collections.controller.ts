import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenClaims, CurrentUser, JwtAuthGuard, PageQueryDto, ParseObjectIdPipe } from '@contenthub/common';
import { AddItemsToCollectionUseCase } from '../../application/add-items-to-collection.use-case';
import { CreateCollectionUseCase } from '../../application/create-collection.use-case';
import { GetCollectionUseCase } from '../../application/get-collection.use-case';
import { ListCollectionsUseCase } from '../../application/list-collections.use-case';
import { toCollectionDetail, toCollectionPage, toCollectionResponse } from './catalog.mapper';
import {
  AddItemsDto,
  CollectionDetailResponseDto,
  CollectionPageResponseDto,
  CollectionResponseDto,
  CreateCollectionDto,
} from './dto/collection.dto';

@ApiTags('collections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly createCollection: CreateCollectionUseCase,
    private readonly listCollections: ListCollectionsUseCase,
    private readonly addItems: AddItemsToCollectionUseCase,
    private readonly getCollection: GetCollectionUseCase,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: CollectionResponseDto })
  async create(@CurrentUser() user: AccessTokenClaims, @Body() body: CreateCollectionDto): Promise<CollectionResponseDto> {
    return toCollectionResponse(await this.createCollection.execute(user.sub, body.name));
  }

  @Get()
  @ApiOperation({ summary: 'My collections' })
  @ApiOkResponse({ type: CollectionPageResponseDto })
  async list(@CurrentUser() user: AccessTokenClaims, @Query() query: PageQueryDto): Promise<CollectionPageResponseDto> {
    return toCollectionPage(await this.listCollections.execute(user.sub, query.page, query.pageSize));
  }

  @Post(':id/items')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add up to 50 items in one transaction ($addToSet, so repeats are ignored)' })
  @ApiOkResponse({ type: CollectionResponseDto })
  async add(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: AddItemsDto,
  ): Promise<CollectionResponseDto> {
    return toCollectionResponse(await this.addItems.execute(id, user.sub, body.itemIds));
  }

  @Get(':id')
  @ApiOperation({ summary: 'A collection with its items, in the order they were added ($lookup)' })
  @ApiOkResponse({ type: CollectionDetailResponseDto })
  async byId(@CurrentUser() user: AccessTokenClaims, @Param('id', ParseObjectIdPipe) id: string): Promise<CollectionDetailResponseDto> {
    return toCollectionDetail(await this.getCollection.execute(id, user.sub));
  }
}
