import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class UpdateUserDto {
    @ApiProperty({
        required: false,
        example: 'jane_doe@example.com',
        description: 'User email address'
    })
    @IsOptional()
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @Transform(({ value }) => value.toLowerCase())
    email?: string;

    @ApiProperty({
        required: false,
        example: 'janedoe',
        description: 'Username for the account'
    })
    @IsOptional()
    @IsString({ message: 'Username must be a string' })
    userName?: string;

    @ApiProperty({
        required: false,
        example: 'StrongPassword123!',
        description: 'User password (8-50 characters)'
    })
    @IsOptional()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(50, { message: 'Password cannot exceed 50 characters' })
    password?: string;
}
