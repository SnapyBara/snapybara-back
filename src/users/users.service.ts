import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // ===== CRUD BASIQUE =====

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    try {
      const existingUser = await this.userModel.findOne({
        $or: [
          { email: createUserDto.email },
          { username: createUserDto.username },
          { supabaseId: createUserDto.supabaseId },
        ],
      });

      if (existingUser) {
        throw new ConflictException(
          'Utilisateur déjà existant (email, username ou supabaseId)',
        );
      }

      const createdUser = new this.userModel(createUserDto);
      const savedUser = await createdUser.save();

      this.logger.log(
        `User created: ${savedUser.username} (${savedUser.email})`,
      );
      return savedUser;
    } catch (error) {
      if (error.code === 11000) {
        // MongoDB duplicate key error
        throw new ConflictException('Utilisateur déjà existant');
      }
      throw error;
    }
  }

  async findAll(limit = 50, skip = 0): Promise<UserDocument[]> {
    return this.userModel
      .find({ isActive: true })
      .sort({ points: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
  }

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email, isActive: true }).exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username, isActive: true }).exec();
  }

  async findBySupabaseId(supabaseId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ supabaseId }).exec();
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        id,
        { ...updateUserDto, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return updatedUser;
  }

  async findById(id: string): Promise<User | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.userModel.findById(id).exec();
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);

    // TODO: Add cascade deletion for related data
    // - Delete user's photos
    // - Delete user's points of interest
    // - Delete user's comments
    // - Remove user from notifications
    // This should be implemented when photo/POI/comment services are created

    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User deleted: ${result.username} (${result.email})`);
  }

  // ===== GAMIFICATION =====

  async addPoints(id: string, points: number): Promise<UserDocument> {
    const user = await this.findOne(id);
    const newPoints = user.points + points;

    // Calculate new level based on updated points
    const newLevel = this.calculateLevel(newPoints);

    const updatedUser = await this.update(id, {
      points: newPoints,
      level: newLevel,
    });

    this.logger.log(
      `Points added to ${user.username}: +${points} (total: ${newPoints}, level: ${newLevel})`,
    );
    return updatedUser;
  }

  async addAchievement(
    id: string,
    achievementId: string,
  ): Promise<UserDocument> {
    const user = await this.findOne(id);
    if (!user.achievements.includes(achievementId)) {
      const updatedAchievements = [...user.achievements, achievementId];
      const updatedUser = await this.update(id, {
        achievements: updatedAchievements,
      });

      this.logger.log(
        `Achievement added to ${user.username}: ${achievementId}`,
      );
      return updatedUser;
    }
    return user;
  }

  async incrementPhotoCount(id: string): Promise<UserDocument> {
    const user = await this.findOne(id);
    return this.update(id, { photosUploaded: user.photosUploaded + 1 });
  }

  async incrementPOICount(id: string): Promise<UserDocument> {
    const user = await this.findOne(id);
    return this.update(id, {
      pointsOfInterestCreated: user.pointsOfInterestCreated + 1,
    });
  }

  async incrementCommentCount(id: string): Promise<UserDocument> {
    const user = await this.findOne(id);
    return this.update(id, { commentsWritten: user.commentsWritten + 1 });
  }

  async incrementLikesReceived(id: string): Promise<UserDocument> {
    const user = await this.findOne(id);
    return this.update(id, { likesReceived: user.likesReceived + 1 });
  }

  // ===== CLASSEMENTS =====

  async getLeaderboard(limit = 10): Promise<UserDocument[]> {
    return this.userModel
      .find({ isActive: true })
      .sort({ points: -1, level: -1 })
      .limit(limit)
      .exec();
  }

  async getUserRank(id: string): Promise<{ rank: number; total: number }> {
    const user = await this.findOne(id);
    const rank =
      (await this.userModel.countDocuments({
        isActive: true,
        $or: [
          { points: { $gt: user.points } },
          { points: user.points, level: { $gt: user.level } },
          { points: user.points, level: user.level, _id: { $lt: user._id } },
        ],
      })) + 1;

    const total = await this.userModel.countDocuments({ isActive: true });
    return { rank, total };
  }

  // ===== Manage statement =====

  async updateLastLogin(id: string): Promise<UserDocument> {
    return this.update(id, { lastLoginAt: new Date() });
  }

  async deactivate(id: string): Promise<UserDocument> {
    return this.update(id, { isActive: false } as UpdateUserDto);
  }

  async activate(id: string): Promise<UserDocument> {
    return this.update(id, { isActive: true } as UpdateUserDto);
  }

  async verifyEmail(id: string): Promise<UserDocument> {
    return this.update(id, { isEmailVerified: true } as UpdateUserDto);
  }

  // ===== SUPABASE SYNC =====

  async syncWithSupabase(supabaseUser: any): Promise<UserDocument> {
    const existingUser = await this.findBySupabaseId(supabaseUser.id);

    if (existingUser) {
      const updateData: Partial<UpdateUserDto> = {
        email: supabaseUser.email,
        lastLoginAt: new Date(),
      };

      if (supabaseUser.user_metadata?.avatar_url) {
        updateData.profilePicture = supabaseUser.user_metadata.avatar_url;
      }

      if (existingUser._id) {
        const updatedUser = await this.update(
          existingUser._id.toString(),
          updateData,
        );
        this.logger.log(`User synced: ${updatedUser.username}`);
        return updatedUser;
      } else {
        throw new Error('User ID is undefined');
      }
    } else {
      const username = await this.generateUniqueUsername(supabaseUser);

      const createData: CreateUserDto = {
        supabaseId: supabaseUser.id,
        email: supabaseUser.email,
        username,
        profilePicture: supabaseUser.user_metadata?.avatar_url,
        language: supabaseUser.user_metadata?.language || 'fr',
      };

      const newUser = await this.create(createData);

      if (newUser._id) {
        await this.giveWelcomeRewards(newUser._id.toString());
      }

      this.logger.log(`New user created from Supabase: ${newUser.username}`);
      return newUser;
    }
  }

  // ===== MÉTHODES UTILITAIRES =====

  private calculateLevel(points: number): number {
    // Niveau 1: 0-99 points, Niveau 2: 100-299, Niveau 3: 300-599, etc.
    if (points < 100) return 1;
    if (points < 300) return 2;
    if (points < 600) return 3;
    if (points < 1000) return 4;
    if (points < 1500) return 5;

    // Au-delà de 1500, chaque 500 points = +1 niveau
    return Math.floor((points - 1500) / 500) + 6;
  }

  private async generateUniqueUsername(supabaseUser: any): Promise<string> {
    let baseUsername = supabaseUser.user_metadata?.full_name
      ?.toLowerCase()
      ?.replace(/[^a-z0-9]/g, '')
      ?.substring(0, 15);

    if (!baseUsername) {
      // Fallback : use email part before @
      baseUsername = supabaseUser.email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }

    let username = baseUsername;
    let counter = 1;

    while (await this.findByUsername(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  private async giveWelcomeRewards(userId: string): Promise<void> {
    try {
      await this.addPoints(userId, 50);
      await this.addAchievement(userId, 'first_login');
      this.logger.log(`Welcome rewards given to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to give welcome rewards: ${error.message}`);
    }
  }
}
