import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserDocument } from './schemas/user.schema';

describe('UsersService', () => {
  let service: UsersService;
  let model: any;

  const mockUser = {
    _id: '123',
    email: 'test@test.com',
    username: 'test',
    supabaseId: 'supabase123',
    points: 100,
    level: 1,
    achievements: [],
    isActive: true,
    dateJoined: new Date(),
    notificationsEnabled: true,
    darkModeEnabled: false,
    privacySettings: {},
    save: jest.fn(),
  } as unknown as UserDocument;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            findByIdAndDelete: jest.fn(),
            findOneAndUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    model = module.get(getModelToken(User.name));
  });

  describe('create', () => {
    it('should create a user', async () => {
      const saveMock = jest.fn().mockResolvedValue(mockUser);
      service['userModel'] = Object.assign(jest.fn(), {
        findOne: jest.fn().mockResolvedValue(null),
        prototype: { save: saveMock },
      }) as any;

      const result = await service.create(mockUser as any);
      expect(result).toEqual(mockUser);
      expect(service['userModel'].findOne).toHaveBeenCalled();
    });

    it('should throw ConflictException if exists', async () => {
      service['userModel'] = Object.assign(jest.fn(), {
        findOne: jest.fn().mockResolvedValue(mockUser),
      }) as any;

      await expect(service.create(mockUser as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return active users sorted by points', async () => {
      const execMock = jest.fn().mockResolvedValue([mockUser]);
      model.find.mockReturnValue({
        sort: () => ({ limit: () => ({ skip: () => ({ exec: execMock }) }) }),
      });
      const result = await service.findAll();
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findOne', () => {
    it('should return a user', async () => {
      model.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      const result = await service.findOne('123');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if not found', async () => {
      model.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findOne('123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      model.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      const result = await service.update('123', { username: 'new' } as any);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if not found', async () => {
      model.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.update('123', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addPoints', () => {
    it('should add points and update level', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue({ ...mockUser, achievements: [] } as any);
      jest.spyOn(service, 'update').mockResolvedValue(mockUser as any);
      const result = await service.addPoints('123', 50);
      expect(result).toEqual(mockUser);
    });
  });

  describe('addAchievement', () => {
    it('should add achievement if not already present', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue({ ...mockUser, achievements: [] } as any);
      jest.spyOn(service, 'update').mockResolvedValue(mockUser as any);
      const result = await service.addAchievement('123', 'ach1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateRole', () => {
    it('should update user role', async () => {
      model.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      const result = await service.updateRole('123', 'admin');
      expect(result).toEqual(mockUser);
    });
  });

  describe('remove', () => {
    it('should delete a user', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockUser as any);
      model.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      await service.remove('123');
      expect(model.findByIdAndDelete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if delete fails', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockUser as any);
      model.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.remove('123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('syncWithSupabase (upsert)', () => {
    it('should upsert-update existing user', async () => {
      const updated = { ...mockUser, email: 't@t.com' };
      model.findOneAndUpdate.mockResolvedValue(updated);
      const result = await service.syncWithSupabase({
        id: 'supabase123',
        email: 't@t.com',
        user_metadata: {},
      });
      expect(model.findOneAndUpdate).toHaveBeenCalled();
      expect(result).toEqual(updated as any);
    });

    it('should upsert-create new user', async () => {
      const created = {
        ...mockUser,
        _id: '456',
        supabaseId: 'new',
        username: 'unique',
      };
      model.findOneAndUpdate.mockResolvedValue(created);
      const result = await service.syncWithSupabase({
        id: 'new',
        email: 'new@t.com',
        user_metadata: {},
      });
      expect(model.findOneAndUpdate).toHaveBeenCalled();
      expect(result).toEqual(created as any);
    });
  });
});
