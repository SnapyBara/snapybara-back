import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

@ApiTags('test')
@Controller('mongodb-test')
export class MongoDBTestController {
  constructor(@InjectConnection() private connection: Connection) {}

  @Get('status')
  @ApiOperation({ summary: 'Test MongoDB connection status' })
  @ApiResponse({ status: 200, description: 'MongoDB status' })
  async getMongoStatus() {
    try {
      const state = this.connection.readyState;
      const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
      };

      return {
        status: 'OK',
        mongodb: {
          state: states[state] || 'unknown',
          host: this.connection.host,
          name: this.connection.name,
          collections: Object.keys(this.connection.collections).length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('ping')
  @ApiOperation({ summary: 'Ping MongoDB' })
  @ApiResponse({ status: 200, description: 'MongoDB ping result' })
  async pingMongo() {
    try {
      if (this.connection.db) {
        const result = await this.connection.db.admin().ping();
        return {
          status: 'OK',
          ping: result,
          message: 'MongoDB is responding',
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          status: 'ERROR',
          error: 'Database connection not available',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
