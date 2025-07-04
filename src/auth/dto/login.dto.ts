import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty( 
    {
      description: 'email should be a valid email',
      example: 'test@example.com',
      required: true,
      type: String,
      format: 'email',
      minLength: 3,
      maxLength: 50,
    }
  )
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @ApiProperty({ description: 'password should be at least 6 characters', minimum: 6, maximum: 30 })
  @IsNotEmpty()
  @MinLength(3, { message: 'password should be minimum 8 ' })
  @MaxLength(50, { message: 'password should be maximum 50 ' })
  password: string;
}
