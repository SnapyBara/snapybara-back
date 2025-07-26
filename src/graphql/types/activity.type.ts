import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class UserActivity {
  @Field(() => ID)
  id: string;

  @Field()
  type: string;

  @Field()
  userId: string;

  @Field()
  userName: string;

  @Field()
  timestamp: Date;

  @Field({ nullable: true })
  pointId?: string;

  @Field({ nullable: true })
  pointName?: string;

  @Field({ nullable: true })
  photoUrl?: string;

  @Field({ nullable: true })
  reviewText?: string;

  @Field({ nullable: true })
  rating?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}
