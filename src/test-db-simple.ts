import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function testMongoDB() {
  const logger = new Logger('MongoDB-Test');
  
  try {
    logger.log('🚀 Testing MongoDB connection...');
    
    const app = await NestFactory.create(AppModule);
    logger.log('✅ Application created successfully');
    logger.log('✅ MongoDB connection established via Mongoose');
    
    await app.close();
    logger.log('🎉 MongoDB test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ MongoDB test failed:', error.message);
    process.exit(1);
  }
}

testMongoDB();
