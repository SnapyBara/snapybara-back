import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => AuthModule), // Utilisation de forwardRef pour éviter la dépendance circulaire
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Exporter le service pour l'utiliser dans AuthModule
})
export class UsersModule {}
