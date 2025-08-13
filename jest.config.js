module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.d.ts',
    '!**/test-*.ts',
    '!**/scripts/**',
    '!**/graphql/**',
    '!**/health/**',
    '!**/overpass/**',
    '!**/google-places/**',
    '!**/dto/**',
    '!**/entities/**',
    '!**/schemas/**',
    '!**/types/**',
    '!**/config/**',
    '!**/common/decorators/**',
    '!**/common/interceptors/**',
    '!**/common/middleware/**',
    '!**/auth/guards/simple-*.ts',
    '!**/auth/guards/supabase-jwt.guard.ts',
    '!**/auth/guards/supabase-auth.guard-fix.ts',
    '!**/auth/guards/auth.guard.ts',
    '!**/auth-simple.controller.ts',
    '!**/supabase-simple.service.ts',
    '!**/supabase.client.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
