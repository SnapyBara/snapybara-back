# SnapyBara Backend API Documentation

## Overview
This document describes all the API endpoints available in the SnapyBara backend.

## Base URL
- Development: `http://localhost:3000`
- Production: `https://api.snapybara.com`

## Authentication
Most endpoints require authentication via Supabase JWT token.
Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### Points of Interest

#### Create Point
- **POST** `/points`
- **Auth Required**: Yes
- **Body**: 
  ```json
  {
    "name": "string",
    "description": "string",
    "latitude": number,
    "longitude": number,
    "category": "landscape|architecture|street_art|...",
    "isPublic": boolean,
    "tags": ["string"],
    "address": {
      "street": "string",
      "city": "string",
      "state": "string",
      "country": "string",
      "postalCode": "string"
    }
  }
  ```

#### Search Points
- **GET** `/points`
- **Query Parameters**:
  - `latitude`: number
  - `longitude`: number
  - `radius`: number (km)
  - `categories`: string (comma-separated)
  - `minRating`: number (1-5)
  - `hasPhotos`: boolean
  - `search`: string
  - `tags`: string (comma-separated)
  - `page`: number
  - `limit`: number
  - `sortBy`: distance|rating|recent|popular

#### Get Nearby Points
- **GET** `/points/nearby`
- **Query Parameters**:
  - `latitude`: number (required)
  - `longitude`: number (required)
  - `radius`: number (optional, default: 10km)

#### Get User Points
- **GET** `/points/user/:userId`

#### Get Point by ID
- **GET** `/points/:id`

#### Update Point
- **PATCH** `/points/:id`
- **Auth Required**: Yes
- **Body**: Same as create (all fields optional)

#### Delete Point
- **DELETE** `/points/:id`
- **Auth Required**: Yes

### Photos

#### Create Photo Entry
- **POST** `/photos`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "pointId": "string",
    "url": "string",
    "thumbnailUrl": "string",
    "caption": "string",
    "isPublic": boolean,
    "tags": ["string"]
  }
  ```

#### Upload Photo File
- **POST** `/photos/upload`
- **Auth Required**: Yes
- **Content-Type**: multipart/form-data
- **Form Data**:
  - `photo`: file
  - `pointId`: string
  - `caption`: string
  - `isPublic`: boolean
  - `tags`: array

#### Get Photos
- **GET** `/photos`
- **Query Parameters**:
  - `pointId`: string
  - `userId`: string
  - `page`: number
  - `limit`: number

#### Get Top Photos
- **GET** `/photos/top`
- **Query Parameters**:
  - `limit`: number

#### Get Recent Photos
- **GET** `/photos/recent`
- **Query Parameters**:
  - `limit`: number

#### Toggle Like
- **POST** `/photos/:id/like`
- **Auth Required**: Yes

### Reviews

#### Create Review
- **POST** `/reviews`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "pointId": "string",
    "rating": number (1-5),
    "comment": "string",
    "pros": ["string"],
    "cons": ["string"],
    "bestTime": "morning|afternoon|evening|night|golden_hour|blue_hour",
    "difficulty": "easy|moderate|hard",
    "crowdLevel": "empty|quiet|moderate|busy|crowded",
    "photos": ["string"],
    "visitDetails": {
      "visitDate": "date",
      "duration": number,
      "weather": "string",
      "parkingAvailable": boolean,
      "entranceFee": number
    }
  }
  ```

#### Get Reviews
- **GET** `/reviews`
- **Query Parameters**:
  - `pointId`: string
  - `userId`: string
  - `page`: number
  - `limit`: number

#### Get Point Statistics
- **GET** `/reviews/point/:pointId/statistics`

#### Toggle Helpful
- **POST** `/reviews/:id/helpful`
- **Auth Required**: Yes

### Collections

#### Create Collection
- **POST** `/collections`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "name": "string",
    "description": "string",
    "isPublic": boolean,
    "coverPhotoUrl": "string",
    "tags": ["string"]
  }
  ```

#### Get Collections
- **GET** `/collections`
- **Query Parameters**:
  - `userId`: string
  - `isPublic`: boolean
  - `page`: number
  - `limit`: number

#### Get Collection by ID
- **GET** `/collections/:id`

#### Add Point to Collection
- **POST** `/collections/:id/points/:pointId`
- **Auth Required**: Yes

#### Remove Point from Collection
- **DELETE** `/collections/:id/points/:pointId`
- **Auth Required**: Yes

#### Toggle Follow Collection
- **POST** `/collections/:id/follow`
- **Auth Required**: Yes

### Notifications

#### Get User Notifications
- **GET** `/notifications`
- **Auth Required**: Yes
- **Query Parameters**:
  - `isRead`: boolean
  - `type`: string
  - `page`: number
  - `limit`: number

#### Mark Notification as Read
- **PATCH** `/notifications/:id/read`
- **Auth Required**: Yes

#### Mark All as Read
- **POST** `/notifications/read-all`
- **Auth Required**: Yes

#### Delete Notification
- **DELETE** `/notifications/:id`
- **Auth Required**: Yes

#### Clear Old Notifications
- **POST** `/notifications/clear-old`
- **Auth Required**: Yes
- **Query Parameters**:
  - `daysToKeep`: number (default: 30)

### Statistics

#### Get User Statistics
- **GET** `/statistics/user/:userId`
- **Response**:
  ```json
  {
    "totalPhotos": number,
    "totalPoints": number,
    "totalReviews": number,
    "totalLikes": number,
    "level": number,
    "points": number,
    "rank": number,
    "recentActivity": []
  }
  ```

#### Get My Statistics
- **GET** `/statistics/me`
- **Auth Required**: Yes

#### Get Global Statistics
- **GET** `/statistics/global`
- **Response**:
  ```json
  {
    "totalUsers": number,
    "totalPoints": number,
    "totalPhotos": number,
    "totalReviews": number,
    "topCategories": [],
    "mostActiveUsers": [],
    "trendingPoints": []
  }
  ```

#### Get Leaderboard
- **GET** `/statistics/leaderboard`
- **Query Parameters**:
  - `limit`: number (default: 10)

### Search

#### Global Search
- **GET** `/search`
- **Query Parameters**:
  - `q`: string (search query)
  - `types`: string (comma-separated: points,photos,users,collections)
  - `limit`: number

#### Search in Area
- **GET** `/search/area`
- **Query Parameters**:
  - `north`: number
  - `south`: number
  - `east`: number
  - `west`: number
  - `categories`: string (comma-separated)
  - `minRating`: number

#### Get Search Suggestions
- **GET** `/search/suggestions`
- **Query Parameters**:
  - `q`: string (search query)

### Users

#### Get Current User Profile
- **GET** `/users/profile`
- **Auth Required**: Yes

#### Update User Profile
- **PATCH** `/users/profile`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "username": "string",
    "profilePicture": "string",
    "darkModeEnabled": boolean,
    "notificationsEnabled": boolean,
    "language": "fr|en|es",
    "privacySettings": "public|friends|private"
  }
  ```

#### Get User by ID
- **GET** `/users/:id`

### Authentication

#### Sign Up
- **POST** `/auth/signup`
- **Body**:
  ```json
  {
    "email": "string",
    "password": "string",
    "username": "string"
  }
  ```

#### Sign In
- **POST** `/auth/signin`
- **Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```

#### Google Sign In
- **POST** `/auth/google`
- **Body**:
  ```json
  {
    "idToken": "string"
  }
  ```

#### Sign Out
- **POST** `/auth/signout`
- **Auth Required**: Yes

#### Reset Password
- **POST** `/auth/reset-password`
- **Body**:
  ```json
  {
    "email": "string"
  }
  ```

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "timestamp": "2025-07-25T12:00:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "message": "Human-readable error description",
  "timestamp": "2025-07-25T12:00:00Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  },
  "timestamp": "2025-07-25T12:00:00Z"
}
```

## Rate Limiting

- Default: 100 requests per minute
- Upload endpoints: 10 requests per minute
- Authentication endpoints: 5 requests per minute

## File Upload Limits

- Maximum file size: 10MB
- Allowed formats: JPEG, PNG, WebP
- Photo dimensions: Max 4000x4000 pixels

## WebSocket Events (for real-time features)

### Connection
```javascript
const socket = io('wss://api.snapybara.com', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events
- `notification:new` - New notification for user
- `photo:liked` - Photo received a like
- `review:new` - New review on user's point
- `achievement:earned` - User earned an achievement

## Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests
- `500` - Internal Server Error

## Categories

Points of interest categories:
- `landscape`
- `architecture`
- `street_art`
- `wildlife`
- `sunset`
- `waterfall`
- `beach`
- `mountain`
- `forest`
- `urban`
- `historical`
- `religious`
- `other`

## Notification Types

- `new_photo_nearby`
- `review_on_point`
- `achievement_earned`
- `friend_request`
- `friend_request_accepted`
- `weekly_digest`
- `point_approved`
- `photo_liked`
- `new_follower`
- `mention`
- `comment_on_photo`
- `comment_on_review`
- `system`
