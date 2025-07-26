import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { PointsResolver } from './resolvers/points.resolver';
import { PhotosResolver } from './resolvers/photos.resolver';
import { UsersResolver } from './resolvers/users.resolver';
import { PointsModule } from '../points/points.module';
import { PhotosModule } from '../photos/photos.module';
import { UsersModule } from '../users/users.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { CollectionsModule } from '../collections/collections.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      playground: true,
      context: ({ req }) => ({ req }),
    }),
    PointsModule,
    PhotosModule,
    UsersModule,
    ReviewsModule,
    CollectionsModule,
  ],
  providers: [PointsResolver, PhotosResolver, UsersResolver],
})
export class GraphqlModule {}
