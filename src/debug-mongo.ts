import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as mongoose from 'mongoose';

async function debugMongoConnection() {
  console.log('=== DEBUG MONGO CONNECTION ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Current working directory:', process.cwd());

  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);

  console.log('\n=== Configuration ===');
  console.log(
    'MONGODB_URI from ConfigService:',
    configService.get('MONGODB_URI'),
  );
  console.log('MONGODB_URI from process.env:', process.env.MONGODB_URI);

  console.log('\n=== Mongoose Connection ===');
  const connection = mongoose.connection;
  console.log('Connection state:', connection.readyState);
  console.log('Connection host:', connection.host);
  console.log('Connection name:', connection.name);

  // Obtenir l'URI de connexion de manière sûre
  const client = connection.getClient();
  if (client) {
    const options = client.options as any;
    if (options.url) {
      console.log(
        'Connection string:',
        options.url.replace(/:[^:@]+@/, ':****@'),
      );
    }
  }

  // Tester la connexion
  try {
    if (connection.db) {
      const collections = await connection.db.collections();
      console.log('\n=== Collections in database ===');
      collections.forEach((col) => {
        console.log('-', col.collectionName);
      });

      // Compter les users
      const User = connection.collection('users');
      const count = await User.countDocuments();
      console.log('\nNumber of users in database:', count);

      // Afficher quelques users
      const users = await User.find({}).limit(3).toArray();
      console.log('\nFirst 3 users:');
      users.forEach((user) => {
        console.log(`- ${user.username || user.email} (ID: ${user._id})`);
      });
    } else {
      console.log('Database connection not yet established');
    }
  } catch (error) {
    console.error('Error accessing database:', error);
  }

  await app.close();
  process.exit(0);
}

debugMongoConnection().catch(console.error);
