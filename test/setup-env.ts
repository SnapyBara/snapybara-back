// Configuration des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/snapybara-test';
process.env.UPLOAD_PATH = './test-uploads';
process.env.BASE_URL = 'http://localhost:3000';
