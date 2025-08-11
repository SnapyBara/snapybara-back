import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { plainToClass } from 'class-transformer';
import { SimpleJwtAuthGuard } from '../auth/guards/simple-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OwnerGuard } from '../auth/guards/owner.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(SimpleJwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ summary: 'Create a new user (public endpoint)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully created',
    type: UserResponseDto,
  })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return plainToClass(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get list of users (admin only)' })
  async findAll(@Query('limit') limit = 50, @Query('skip') skip = 0) {
    const users = await this.usersService.findAll(+limit, +skip);
    return users.map((user) =>
      plainToClass(UserResponseDto, user.toObject(), {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get('moderators')
  @Roles('admin')
  @ApiOperation({ summary: 'Get list of moderators and admins (admin only)' })
  async getModerators() {
    const users = await this.usersService.findByRole(['moderator', 'admin']);
    return users.map((user) =>
      plainToClass(UserResponseDto, user.toObject(), {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get('leaderboard')
  @Public()
  @ApiOperation({ summary: 'Get users leaderboard (public)' })
  async getLeaderboard(@Query('limit') limit = 10) {
    const users = await this.usersService.getLeaderboard(+limit);
    return users.map((user) =>
      plainToClass(UserResponseDto, user.toObject(), {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user profile retrieved successfully',
    type: UserResponseDto,
  })
  async getCurrentUser(@CurrentUser() currentUser: any) {
    const user = await this.usersService.findOne(currentUser.mongoId);
    return plainToClass(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  @Get('profile/:supabaseId')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Get user profile by Supabase ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
    type: UserResponseDto,
  })
  async getProfileBySupabaseId(@Param('supabaseId') supabaseId: string) {
    const user = await this.usersService.findBySupabaseId(supabaseId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return plainToClass(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return plainToClass(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  @Patch('me/profile')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 profile updates per minute
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile successfully updated',
    type: UserResponseDto,
  })
  async updateMyProfile(
    @CurrentUser() currentUser: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    try {
      // Check if username is unique (if provided)
      if (updateProfileDto.username) {
        const existingUser = await this.usersService.findByUsername(
          updateProfileDto.username,
        );
        if (
          existingUser &&
          existingUser._id?.toString() !== currentUser.mongoId
        ) {
          throw new HttpException(
            'Username already taken',
            HttpStatus.CONFLICT,
          );
        }
      }

      const user = await this.usersService.update(
        currentUser.mongoId,
        updateProfileDto,
      );
      return plainToClass(UserResponseDto, user.toObject(), {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update profile',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch(':id/profile')
  @UseGuards(OwnerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 profile updates per minute
  @ApiOperation({ summary: 'Update user profile information' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile successfully updated',
    type: UserResponseDto,
  })
  async updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    try {
      // Check if username is unique (if provided)
      if (updateProfileDto.username) {
        const existingUser = await this.usersService.findByUsername(
          updateProfileDto.username,
        );
        if (existingUser && existingUser._id?.toString() !== id) {
          throw new HttpException(
            'Username already taken',
            HttpStatus.CONFLICT,
          );
        }
      }

      const user = await this.usersService.update(id, updateProfileDto);
      return plainToClass(UserResponseDto, user.toObject(), {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update profile',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('me')
  @Throttle({ default: { limit: 1, ttl: 300000 } }) // 1 account deletion per 5 minutes
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User account successfully deleted',
  })
  async deleteMyAccount(@CurrentUser() currentUser: any) {
    try {
      await this.usersService.remove(currentUser.mongoId);
      return {
        success: true,
        message: 'User account successfully deleted',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to delete account',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  @UseGuards(OwnerGuard)
  @Throttle({ default: { limit: 1, ttl: 300000 } }) // 1 account deletion per 5 minutes
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User account successfully deleted',
  })
  async deleteAccount(@Param('id') id: string) {
    try {
      await this.usersService.remove(id);
      return {
        success: true,
        message: 'User account successfully deleted',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to delete account',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch(':id/deactivate')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Deactivate user account (soft delete)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User account successfully deactivated',
    type: UserResponseDto,
  })
  async deactivateAccount(@Param('id') id: string) {
    const user = await this.usersService.deactivate(id);
    return plainToClass(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/role')
  @Roles('admin')
  @ApiOperation({ summary: 'Update user role (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User role successfully updated',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only admins can update user roles',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async updateUserRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() currentUser: any,
  ) {
    // Prevent admin from changing their own role
    if (id === currentUser.mongoId) {
      throw new HttpException(
        'You cannot change your own role',
        HttpStatus.FORBIDDEN,
      );
    }

    const user = await this.usersService.updateRole(id, updateRoleDto.role);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    return plainToClass(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/points')
  @Roles('admin')
  @ApiOperation({ summary: 'Add points to user (admin only)' })
  async addPoints(@Param('id') id: string, @Body('points') points: number) {
    const user = await this.usersService.addPoints(id, points);
    return plainToClass(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/achievement')
  @Roles('admin')
  @ApiOperation({ summary: 'Add achievement to user (admin only)' })
  async addAchievement(
    @Param('id') id: string,
    @Body('achievementId') achievementId: string,
  ) {
    const user = await this.usersService.addAchievement(id, achievementId);
    return plainToClass(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  @Post('sync-supabase')
  @Public()
  @ApiOperation({ summary: 'Sync user with Supabase (webhook only)' })
  async syncWithSupabase(@Body() syncData: { supabaseUser: any }) {
    const user = await this.usersService.syncWithSupabase(
      syncData.supabaseUser,
    );
    return plainToClass(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });
  }
}
