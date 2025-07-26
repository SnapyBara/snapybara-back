import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  _id: string;

  @Field()
  supabaseId: string;

  @Field()
  email: string;

  @Field()
  username: string;

  @Field({ nullable: true })
  profilePicture?: string;

  @Field()
  dateJoined: Date;

  @Field(() => Int)
  level: number;

  @Field(() => Int)
  points: number;

  @Field(() => [String])
  achievements: string[];

  @Field()
  role: string;

  @Field()
  isActive: boolean;

  @Field(() => Int)
  photosUploaded: number;

  @Field(() => Int)
  pointsOfInterestCreated: number;

  @Field(() => Int)
  commentsWritten: number;

  @Field(() => Int)
  likesReceived: number;
}

@ObjectType()
export class GeoLocation {
  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;

  @Field(() => Float, { nullable: true })
  altitude?: number;

  @Field(() => Float, { nullable: true })
  accuracy?: number;
}

@ObjectType()
export class Photo {
  @Field(() => ID)
  _id: string;

  @Field()
  image: string;

  @Field()
  description: string;

  @Field(() => Int)
  likes: number;

  @Field()
  uploadDate: Date;

  @Field()
  uploadedBy: string;

  @Field({ nullable: true })
  pointOfInterest?: string;
}

@ObjectType()
export class Review {
  @Field(() => ID)
  _id: string;

  @Field()
  content: string;

  @Field(() => Int)
  rating: number;

  @Field()
  createdAt: Date;

  @Field()
  userId: string;
}

@ObjectType()
export class ReviewStatistics {
  @Field(() => Float)
  averageRating: number;

  @Field(() => Int)
  totalReviews: number;

  @Field(() => Int)
  ratingDistribution: number;
}

@ObjectType()
export class PointOfInterest {
  @Field(() => ID)
  _id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field()
  category: string;

  @Field(() => GeoLocation)
  location: GeoLocation;

  @Field()
  createdBy: string;

  @Field()
  dateAdded: Date;

  @Field()
  status: string;

  @Field(() => Float)
  rating: number;

  @Field(() => Int)
  visitCount: number;

  @Field(() => Int)
  viewCount: number;

  @Field(() => [Photo], { nullable: true })
  photos?: Photo[];

  @Field(() => [Review], { nullable: true })
  reviews?: Review[];

  @Field(() => ReviewStatistics, { nullable: true })
  statistics?: ReviewStatistics;
}
