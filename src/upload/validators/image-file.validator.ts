import { FileValidator } from '@nestjs/common';

export class ImageFileValidator extends FileValidator {
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  private readonly allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

  constructor() {
    super({});
  }

  isValid(file: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    // Check for path traversal attempts
    if (this.hasPathTraversal(file.originalname)) {
      return false;
    }

    // Check for null bytes
    if (
      file.originalname.includes('\x00') ||
      file.originalname.includes('%00')
    ) {
      return false;
    }

    // Check MIME type
    const mimeTypeValid = this.allowedMimeTypes.includes(file.mimetype);

    // Check file extension
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const extensionValid = fileExtension
      ? this.allowedExtensions.includes(fileExtension)
      : false;

    // Both MIME type and extension must be valid
    return mimeTypeValid && extensionValid;
  }

  private hasPathTraversal(filename: string): boolean {
    // Check for common path traversal patterns
    const dangerousPatterns = [
      '..',
      '../',
      '..\\',
      '%2e%2e',
      '%252e%252e',
      '..;',
      '..\\',
    ];

    const lowerFilename = filename.toLowerCase();
    return dangerousPatterns.some((pattern) => lowerFilename.includes(pattern));
  }

  buildErrorMessage(): string {
    return `File validation failed. Allowed types: ${this.allowedExtensions.join(
      ', ',
    )}`;
  }
}
