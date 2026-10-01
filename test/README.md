# E2E Tests

## Overview

This directory contains end-to-end tests for the Snapybara backend API. The tests use:
- Jest as the test runner
- Supertest for HTTP assertions
- MongoDB Memory Server for database testing
- Mock services for external dependencies (Supabase, Redis, etc.)

## Running Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run with watch mode
npm run test:e2e:watch

# Run with coverage
npm run test:e2e -- --coverage

# Run a specific test file
npm run test:e2e -- points.e2e-spec.ts
```

## Test Structure

- `app.e2e-spec.ts` - Basic application tests
- `points.e2e-spec.ts` - Points API endpoints tests
- `test-config.ts` - Mock services and configurations
- `test-auth.guard.ts` - Test authentication guard that bypasses Supabase

## Key Features

1. **In-Memory MongoDB**: Tests use MongoDB Memory Server to avoid external dependencies
2. **Mocked Services**: External services like Supabase and Redis are mocked
3. **Test Authentication**: A special TestAuthGuard bypasses real authentication for testing
4. **Automatic Cleanup**: Database and server instances are cleaned up after tests

## Environment Variables

The tests automatically set up required environment variables:
- `NODE_ENV=test`
- `MONGODB_URI` - Set to in-memory MongoDB instance
- `JWT_SECRET` and `SUPABASE_JWT_SECRET` - Test secrets
- Supabase URLs and keys - Mock values

## Writing New Tests

1. Import necessary modules and test utilities
2. Set up the test module with appropriate overrides
3. Use `request(app.getHttpServer())` to make HTTP requests
4. Clean up resources in `afterAll` hooks

Example:
```typescript
describe('New Feature (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Setup test module
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should test something', async () => {
    const response = await request(app.getHttpServer())
      .get('/endpoint')
      .expect(200);
    
    expect(response.body).toHaveProperty('expected');
  });
});
```

## Troubleshooting

1. **Timeout errors**: Increase timeout in `beforeAll` hooks or Jest config
2. **Connection errors**: Ensure MongoDB Memory Server is properly installed
3. **Authentication errors**: Check that TestAuthGuard is properly overriding SupabaseAuthGuard
4. **Module not found**: Run `npm install` to ensure all dependencies are installed

## CI/CD Integration

These tests are designed to run in CI/CD pipelines without external dependencies.
All required services are mocked or run in-memory.
