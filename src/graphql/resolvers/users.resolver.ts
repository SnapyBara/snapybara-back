import { Resolver, Query, Args } from '@nestjs/graphql';
import { UsersService } from '../../users/users.service';
import { User } from '../types/point.type';

@Resolver(() => User)
export class UsersResolver {
  constructor(private usersService: UsersService) {}

  @Query(() => User, { name: 'user' })
  async getUser(@Args('id') id: string) {
    return this.usersService.findById(id);
  }
}
