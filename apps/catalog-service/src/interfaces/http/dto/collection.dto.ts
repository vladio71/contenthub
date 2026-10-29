import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsMongoId, IsString, Length } from 'class-validator';
import { MAX_ITEMS_PER_REQUEST } from '../../../domain/collection';
import { ItemResponseDto } from './item.dto';

export class CreateCollectionDto {
  @ApiProperty({ example: 'Reading list' })
  @IsString()
  @Length(1, 80)
  name!: string;
}

export class AddItemsDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: MAX_ITEMS_PER_REQUEST })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS_PER_REQUEST)
  @IsMongoId({ each: true })
  itemIds!: string[];
}

export class CollectionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() ownerId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() itemCount!: number;
  @ApiProperty() createdAt!: string;
}

export class CollectionDetailResponseDto extends CollectionResponseDto {
  @ApiProperty({ type: [ItemResponseDto], description: 'In the order the items were added' }) items!: ItemResponseDto[];
}

export class CollectionPageResponseDto {
  @ApiProperty({ type: [CollectionResponseDto] }) items!: CollectionResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
