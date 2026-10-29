import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../domain/errors';
import { USER_REPOSITORY, UserRepository } from '../domain/repositories/user-repository';
import { User } from '../domain/user';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    return user;
  }
}
