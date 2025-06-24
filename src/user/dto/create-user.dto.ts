import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateUserDto {
    @ApiProperty({
        example: 'jane_doe@example.com',
        description: 'User email address'
    })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @IsNotEmpty({ message: 'Email is required' })
    @Transform(({ value }) => value.toLowerCase())
    email: string;

    @ApiProperty({
        example: 'janedoe',
        description: 'Username for the account'
    })
    @IsNotEmpty({ message: 'Username is required' })
    @IsString({ message: 'Username must be a string' })
    userName: string;

    @ApiProperty({
        example: 'StrongPassword123!',
        description: 'User password (8-50 characters)'
    })
    @IsNotEmpty({ message: 'Password is required' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(50, { message: 'Password cannot exceed 50 characters' })
    password: string;
}
