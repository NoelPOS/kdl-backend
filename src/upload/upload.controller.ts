import {
  Controller,
  Post,
  Delete,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { UploadService } from './upload.service';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('feedback-media')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload images or videos for feedback',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadFeedbackMedia(
    @UploadedFiles() files: Array<Express.Multer.File>,
  ): Promise<{ urls: string[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Separate images and videos
    const images = files.filter((file) =>
      file.mimetype.startsWith('image/'),
    );
    const videos = files.filter((file) =>
      file.mimetype.startsWith('video/'),
    );

    const uploadPromises: Promise<string>[] = [];

    // Upload images
    if (images.length > 0) {
      const imagePromises = images.map((file) =>
        this.uploadService.uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          'feedback/images',
        ),
      );
      uploadPromises.push(...imagePromises);
    }

    // Upload videos
    if (videos.length > 0) {
      const videoPromises = videos.map((file) =>
        this.uploadService.uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          'feedback/videos',
        ),
      );
      uploadPromises.push(...videoPromises);
    }

    const urls = await Promise.all(uploadPromises);

    return { urls };
  }

  @Delete('feedback-media')
  @ApiBody({
    description: 'Delete a file from S3',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The S3 URL of the file to delete',
        },
      },
      required: ['url'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
  })
  async deleteFeedbackMedia(
    @Body('url') url: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!url) {
      throw new BadRequestException('URL is required');
    }

    await this.uploadService.deleteFile(url);

    return {
      success: true,
      message: 'File deleted successfully',
    };
  }
}
