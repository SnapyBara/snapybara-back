import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import 'multer';

@Injectable()
export class FileIntegrityValidator {
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File size exceeds limit');
    }

    const magicNumbers = {
      'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2'],
      'image/png': ['89504e47'],
      'image/webp': ['52494646'],
    };

    const buffer = await fs.promises.readFile(file.path);
    const magic = buffer.toString('hex', 0, 4);

    const validMagic = Object.entries(magicNumbers).some(([type, magics]) => {
      return file.mimetype === type && magics.some((m) => magic.startsWith(m));
    });

    if (!validMagic) {
      throw new BadRequestException(
        'File content does not match declared type',
      );
    }
  }

  generateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }
}
