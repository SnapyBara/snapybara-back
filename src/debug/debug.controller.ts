import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '../auth/decorators/public.decorator';

interface ConnectionInfo {
  environment: {
    NODE_ENV: string | undefined;
    configuredUri: string | null;
    envFileUsed: string;
  };
  connection: {
    readyState: number;
    readyStateText: string;
    host: string;
    port: number;
    name: string;
    connectionString: string;
  };
  database: {
    name: string;
  };
  collections: string[];
  userCount: number;
  sampleUsers: any[];
}

@ApiTags('debug')
@Controller('debug')
export class DebugController {
  constructor(
    private configService: ConfigService,
    @InjectConnection() private connection: Connection,
  ) {}

  @Get('mongo-info')
  @Public()
  @ApiOperation({ summary: 'Get MongoDB connection info (development only)' })
  async getMongoInfo() {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Not available in production' };
    }

    try {
      // Obtenir l'URL de connexion de manière sûre
      let connectionString = 'not available';
      const client = this.connection.getClient();
      if (client) {
        const options = client.options as any;
        if (options.url) {
          connectionString = this.maskConnectionString(options.url);
        }
      }

      const connectionInfo: ConnectionInfo = {
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          configuredUri: this.maskConnectionString(
            this.configService.get('MONGODB_URI') || '',
          ),
          envFileUsed: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
        },
        connection: {
          readyState: this.connection.readyState,
          readyStateText: this.getReadyStateText(this.connection.readyState),
          host: this.connection.host,
          port: this.connection.port,
          name: this.connection.name,
          connectionString,
        },
        database: {
          name: this.connection.db?.databaseName || 'not connected',
        },
        collections: [],
        userCount: 0,
        sampleUsers: [],
      };

      // Vérifier que la base de données est connectée
      if (this.connection.db) {
        // Lister les collections
        const collections = await this.connection.db.collections();
        connectionInfo.collections = collections.map(
          (col) => col.collectionName,
        );

        // Compter les users
        const usersCollection = this.connection.collection('users');
        connectionInfo.userCount = await usersCollection.countDocuments();

        // Récupérer quelques users d'exemple
        const sampleUsers = await usersCollection
          .find({})
          .limit(3)
          .project({ username: 1, email: 1, createdAt: 1, supabaseId: 1 })
          .toArray();

        connectionInfo.sampleUsers = sampleUsers.map((user) => ({
          id: user._id,
          username: user.username,
          email: user.email ? user.email.substring(0, 3) + '***' : 'N/A',
          supabaseId: user.supabaseId
            ? user.supabaseId.substring(0, 8) + '***'
            : 'N/A',
          createdAt: user.createdAt,
        }));
      }

      return connectionInfo;
    } catch (error: any) {
      return {
        error: 'Failed to get MongoDB info',
        message: error.message,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          configuredUri: this.maskConnectionString(
            this.configService.get('MONGODB_URI') || '',
          ),
        },
      };
    }
  }

  @Get('test-connection')
  @Public()
  @ApiOperation({ summary: 'Test MongoDB connection' })
  async testConnection() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Not available in production' };
    }

    try {
      // Vérifier que la connexion est établie
      if (!this.connection.db) {
        return {
          status: 'disconnected',
          message: 'Database connection not established',
          readyState: this.connection.readyState,
          timestamp: new Date().toISOString(),
        };
      }

      // Tester la connexion avec un ping
      await this.connection.db.admin().ping();

      return {
        status: 'connected',
        database: this.connection.db.databaseName,
        host: this.connection.host,
        port: this.connection.port,
        isAtlas: this.connection.host?.includes('mongodb.net') || false,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private getReadyStateText(state: number): string {
    switch (state) {
      case 0:
        return 'disconnected';
      case 1:
        return 'connected';
      case 2:
        return 'connecting';
      case 3:
        return 'disconnecting';
      default:
        return 'unknown';
    }
  }

  private maskConnectionString(uri: string): string {
    if (!uri) return 'not configured';

    // Masquer le mot de passe dans l'URI
    return uri
      .replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://$1:****@')
      .replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://$1:****@');
  }
}
