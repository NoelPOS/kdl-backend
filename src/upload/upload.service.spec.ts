import { BadRequestException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  let service: UploadService;
  const configService = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_S3_BUCKET_NAME: 'test-bucket',
      };
      return map[key];
    }),
  };
  const s3Send = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UploadService(configService as any);
    (service as any).s3Client = { send: s3Send };
    (service as any).bucketName = 'test-bucket';
  });

  it('TC-UPL-001: uploadFile throws when image exceeds 5MB', async () => {
    const tooLargeImage = Buffer.alloc(5 * 1024 * 1024 + 1);

    await expect(
      service.uploadFile(
        tooLargeImage,
        'big.jpg',
        'image/jpeg',
        'feedback/images',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('TC-UPL-002: uploadFile throws for disallowed MIME type', async () => {
    const file = Buffer.from('abc');

    await expect(
      service.uploadFile(file, 'tool.exe', 'application/exe', 'feedback/files'),
    ).rejects.toThrow(BadRequestException);
  });

  it('TC-UPL-003: uploadFile sends PutObjectCommand with expected fields', async () => {
    s3Send.mockResolvedValue({});
    const file = Buffer.from('hello');

    await service.uploadFile(file, 'photo.jpg', 'image/jpeg', 'feedback/images');

    const command = s3Send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe('test-bucket');
    expect(command.input.ContentType).toBe('image/jpeg');
    expect(command.input.Body).toBe(file);
    expect(command.input.Key).toMatch(/^feedback\/images\//);
  });

  it('TC-UPL-004: deleteFile sends DeleteObjectCommand with extracted key', async () => {
    s3Send.mockResolvedValue({});
    const fileUrl =
      'https://test-bucket.s3.us-east-1.amazonaws.com/feedback/images/abc.jpg';

    await service.deleteFile(fileUrl);

    const command = s3Send.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input.Bucket).toBe('test-bucket');
    expect(command.input.Key).toBe('feedback/images/abc.jpg');
  });
});
