import { Inject, Injectable } from '@nestjs/common';
import { buildOffsetPage, OffsetPage } from '@contenthub/common';
import { Profile } from '../domain/profile';
import { PROFILE_REPOSITORY, ProfileRepository } from '../domain/repositories/profile-repository';

export interface SearchProfilesInput {
  q?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class SearchProfilesUseCase {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(input: SearchProfilesInput): Promise<OffsetPage<Profile>> {
    const text = input.q?.trim() || undefined;
    const { profiles, total } = await this.profiles.search({ text, page: input.page, pageSize: input.pageSize });
    return buildOffsetPage(profiles, total, input.page, input.pageSize);
  }
}
