import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Photo, PhotoDocument } from './schemas/photo.schema';
import { CreatePhotoDto, UploadPhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class PhotosService {
  constructor(
    @InjectModel(Photo.name)
    private photoModel: Model<PhotoDocument>,
    private uploadService: UploadService,
  ) {}

  async create(
    createPhotoDto: CreatePhotoDto,
    userId: string,
    session?: any,
  ): Promise<Photo> {
    const createdPhoto = new this.photoModel({
      ...createPhotoDto,
      userId: new Types.ObjectId(userId),
      pointId: new Types.ObjectId(createPhotoDto.pointId),
      status: 'pending',
    });
    return createdPhoto.save({ session });
  }

  async findAll(filters: {
    pointId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Photo[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...queryFilters } = filters;
    const skip = (page - 1) * limit;

    const query: any = { isActive: true, status: 'approved' };

    if (queryFilters.pointId) {
      query.pointId = new Types.ObjectId(queryFilters.pointId);
    }

    if (queryFilters.userId) {
      query.userId = new Types.ObjectId(queryFilters.userId);
    }

    const [data, total] = await Promise.all([
      this.photoModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username profilePicture')
        .populate('pointId', 'name category')
        .exec(),
      this.photoModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Photo> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid photo ID');
    }

    const photo = await this.photoModel
      .findById(id)
      .populate('userId', 'username profilePicture')
      .populate('pointId', 'name category latitude longitude')
      .exec();

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    await this.photoModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    return photo;
  }

  async update(
    id: string,
    updatePhotoDto: UpdatePhotoDto,
    userId: string,
  ): Promise<Photo> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid photo ID');
    }

    const photo = await this.photoModel.findById(id);
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // Check ownership
    if (photo.userId.toString() !== userId) {
      throw new BadRequestException('You can only update your own photos');
    }

    const updated = await this.photoModel
      .findByIdAndUpdate(
        id,
        { ...updatePhotoDto, updatedAt: new Date() },
        { new: true },
      )
      .populate('userId', 'username profilePicture')
      .populate('pointId', 'name category')
      .exec();

    if (!updated) {
      throw new NotFoundException('Photo not found');
    }

    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid photo ID');
    }

    const photo = await this.photoModel.findById(id);
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // Check ownership
    if (photo.userId.toString() !== userId) {
      throw new BadRequestException('You can only delete your own photos');
    }

    await this.photoModel.findByIdAndUpdate(id, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  async toggleLike(
    photoId: string,
    userId: string,
  ): Promise<{ liked: boolean; count: number }> {
    if (!Types.ObjectId.isValid(photoId)) {
      throw new BadRequestException('Invalid photo ID');
    }

    const photo = await this.photoModel.findById(photoId);
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const isLiked = photo.likedBy.some((id) => id.equals(userObjectId));

    if (isLiked) {
      await this.photoModel.findByIdAndUpdate(photoId, {
        $pull: { likedBy: userObjectId },
        $inc: { likesCount: -1 },
      });
      return { liked: false, count: photo.likesCount - 1 };
    } else {
      await this.photoModel.findByIdAndUpdate(photoId, {
        $addToSet: { likedBy: userObjectId },
        $inc: { likesCount: 1 },
      });
      return { liked: true, count: photo.likesCount + 1 };
    }
  }

  async getTopPhotos(limit: number = 10): Promise<Photo[]> {
    return this.photoModel
      .find({ isActive: true, status: 'approved', isPublic: true })
      .sort({ likesCount: -1, viewCount: -1 })
      .limit(limit)
      .populate('userId', 'username profilePicture')
      .populate('pointId', 'name category')
      .exec();
  }

  async getRecentPhotos(limit: number = 20): Promise<Photo[]> {
    return this.photoModel
      .find({ isActive: true, status: 'approved', isPublic: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'username profilePicture')
      .populate('pointId', 'name category')
      .exec();
  }

  async findByPoint(pointId: string): Promise<Photo[]> {
    if (!Types.ObjectId.isValid(pointId)) {
      throw new BadRequestException('Invalid point ID');
    }

    return this.photoModel
      .find({ 
        pointId: new Types.ObjectId(pointId),
        isActive: true,
        status: 'approved'
      })
      .sort({ createdAt: -1 })
      .populate('userId', 'username profilePicture')
      .exec();
  }

  async uploadPhoto(
    file: Express.Multer.File,
    uploadPhotoDto: UploadPhotoDto,
    userId: string,
  ): Promise<Photo> {
    // Upload the file
    const uploadedFile = await this.uploadService.uploadImage(file);

    // Create photo document
    const photoData = {
      url: uploadedFile.originalUrl,
      thumbnailUrl: uploadedFile.thumbnailUrl,
      mediumUrl: uploadedFile.mediumUrl,
      largeUrl: uploadedFile.largeUrl,
      filename: uploadedFile.filename,
      originalName: uploadedFile.originalName,
      size: uploadedFile.size,
      mimeType: uploadedFile.mimeType,
      width: uploadedFile.width,
      height: uploadedFile.height,
      pointId: uploadPhotoDto.pointId ? new Types.ObjectId(uploadPhotoDto.pointId) : undefined,
      caption: uploadPhotoDto.caption,
      tags: uploadPhotoDto.tags || [],
      isPublic: uploadPhotoDto.isPublic !== false,
      userId: new Types.ObjectId(userId),
      status: 'approved', // Auto-approve for now, can add moderation later
    };

    try {
      const createdPhoto = new this.photoModel(photoData);
      return await createdPhoto.save();
    } catch (error) {
      // If save fails, delete the uploaded files
      await this.uploadService.deleteImage(uploadedFile.filename);
      throw error;
    }
  }
}
