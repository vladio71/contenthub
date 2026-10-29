import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, OffsetPage } from '@contenthub/common';
import { NotItemOwnerError } from '../domain/errors';
import { Item } from '../domain/item';
import { ITEM_REPOSITORY, ItemFilters, ItemRepository, ItemSort } from '../domain/repositories/item-repository';

export type Pagination = { mode: 'offset'; page: number; pageSize: number } | { mode: 'cursor'; cursor: string | null; pageSize: number };

export interface ListItemsInput {
  viewerId: string;
  filters: ItemFilters;
  sort: ItemSort;
  pagination: Pagination;
}

export type ListItemsResult = { mode: 'offset'; page: OffsetPage<Item> } | { mode: 'cursor'; page: CursorPage<Item> };

@Injectable()
export class ListItemsUseCase {
  constructor(@Inject(ITEM_REPOSITORY) private readonly items: ItemRepository) {}

  async execute(input: ListItemsInput): Promise<ListItemsResult> {
    const filters = this.applyVisibilityRule(input);
    const { sort, pagination } = input;

    if (pagination.mode === 'cursor') {
      const page = await this.items.listCursor({ filters, sort, pageSize: pagination.pageSize, cursor: pagination.cursor });
      return { mode: 'cursor', page };
    }
    const page = await this.items.listOffset({ filters, sort, page: pagination.page, pageSize: pagination.pageSize });
    return { mode: 'offset', page };
  }

  /** Everybody can list published items. Drafts and archived items are only for their author. */
  private applyVisibilityRule(input: ListItemsInput): ItemFilters {
    const { filters, viewerId } = input;
    if (filters.status === 'published') {
      return filters;
    }
    if (filters.authorId !== undefined && filters.authorId !== viewerId) {
      throw new NotItemOwnerError();
    }
    return { ...filters, authorId: viewerId };
  }
}
