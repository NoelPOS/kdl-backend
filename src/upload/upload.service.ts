import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
  }

  /**
   * Upload a file to S3
   * @param file - The file buffer to upload
   * @param filename - Original filename
   * @param mimetype - File MIME type
   * @param folder - S3 folder path (e.g., 'feedback/images')
   * @returns S3 URL of the uploaded file
   */
  async uploadFile(
    file: Buffer,
    filename: string,
    mimetype: string,
    folder: string = 'feedback',
  ): Promise<string> {
    // Validate file
    this.validateFile(file, mimetype);

    // Generate unique filename
    const fileExtension = filename.split('.').pop();
    const uniqueFilename = `${folder}/${randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: uniqueFilename,
      Body: file,
      ContentType: mimetype,
      // Note: ACL removed - use bucket policy for public access instead
    });

    try {
      await this.s3Client.send(command);
      
      // Return the S3 URL
      const region = this.configService.get<string>('AWS_REGION');
      return `https://${this.bucketName}.s3.${region}.amazonaws.com/${uniqueFilename}`;
    } catch (error) {
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload multiple files to S3
   * @param files - Array of files to upload
   * @param folder - S3 folder path
   * @returns Array of S3 URLs
   */
  async uploadMultipleFiles(
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
    folder: string = 'feedback',
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file.buffer, file.originalname, file.mimetype, folder),
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Delete a file from S3
   * @param fileUrl - The S3 URL of the file to delete
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract the key from the URL
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1); // Remove leading slash

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error(`Failed to delete file from S3: ${error.message}`);
      // Don't throw error, just log it (file might already be deleted)
    }
  }

  /**
   * Delete multiple files from S3
   * @param fileUrls - Array of S3 URLs to delete
   */
  async deleteMultipleFiles(fileUrls: string[]): Promise<void> {
    const deletePromises = fileUrls.map((url) => this.deleteFile(url));
    await Promise.all(deletePromises);
  }

  /**
   * Validate file size and type
   */
  private validateFile(file: Buffer, mimetype: string): void {
    const maxImageSize = 5 * 1024 * 1024; // 5MB
    const maxVideoSize = 50 * 1024 * 1024; // 50MB

    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

    const isImage = allowedImageTypes.includes(mimetype);
    const isVideo = allowedVideoTypes.includes(mimetype);

    if (!isImage && !isVideo) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${[...allowedImageTypes, ...allowedVideoTypes].join(', ')}`,
      );
    }

    if (isImage && file.length > maxImageSize) {
      throw new BadRequestException(
        `Image file size exceeds 5MB limit. Current size: ${(file.length / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    if (isVideo && file.length > maxVideoSize) {
      throw new BadRequestException(
        `Video file size exceeds 50MB limit. Current size: ${(file.length / 1024 / 1024).toFixed(2)}MB`,
      );
    }
  }
}
