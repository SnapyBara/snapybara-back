![SnapyBara_head.png](uploads/logo/SnapyBara_head.png)

# SnapyBara Backend

REST and GraphQL API backend for SnapyBara application, built with NestJS.

## 🚀 Tech Stack

### Core
- **Framework**: NestJS (Node.js)
- **Database**: MongoDB (via Mongoose)
- **Authentication**: Supabase Auth
- **Cache**: Redis
- **API**: REST API + GraphQL

### External Services
- **Google Maps API**: Geolocation and place data
- **Google Places API**: Detailed information about points of interest
- **Firebase Messaging**: Push notification system
- **Data.gouv.fr**: French public data
- **Overpass API**: OpenStreetMap data

### Tools & Monitoring
- **Sentry**: Error monitoring
- **Sharp**: Image processing and optimization
- **Swagger**: Interactive API documentation

## 📋 Prerequisites

- Node.js (v18+ recommended)
- MongoDB (v6.0+)
- Redis (v7.0+)
- Docker & Docker Compose (optional)

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone [your-repo]
cd snapybara-back
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment variables configuration
Copy the `.env.example` file to `.env` and configure the variables:

```bash
cp .env.example .env
```

Duplicate .env.examples 

### 4. Start with Docker (recommended)
```bash
# Start MongoDB and Redis
docker-compose up -d

# Start the application
npm run start:dev
```

## Available Commands

### Development
```bash
# Start in development mode
npm run start:dev

# Start in debug mode
npm run start:debug

# Production build
npm run build

# Start in production
npm run start:prod
```

### Testing
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### Linting & Formatting
```bash
# Check code
npm run lint

# Auto-fix
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

### Utility Scripts
```bash
# Import natural landmarks
npm run script:import-landmarks

# Test search functionality
npm run script:test-search

# Clear Overpass queue
npm run script:clear-queue
```




### Recommended indexes:
```javascript
// Points - for geospatial search
db.points.createIndex({ location: "2dsphere" })
db.points.createIndex({ categories: 1 })
db.points.createIndex({ createdBy: 1 })

// Photos
db.photos.createIndex({ pointId: 1 })
db.photos.createIndex({ userId: 1 })
```

## Deployment

### Production build
```bash
npm run build
```

### Production environment variables
Make sure to configure all necessary environment variables on your production server.

### With Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

## Debugging

### Logs
Logs are available in the `logs/` folder and in the console.

### Sentry
If configured, errors are automatically sent to Sentry.

### Debug mode
```bash
npm run start:debug
```
Then attach a debugger on port 9229.

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -m 'Add my feature'`
3. Push the branch: `git push origin feature/my-feature`
4. Create a Pull Request

## 📝 License

Proprietary - SnapyBara © 2024
