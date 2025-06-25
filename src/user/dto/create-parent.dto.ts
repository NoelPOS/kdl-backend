import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateParentDto {
  @ApiProperty({
    example: 'Parent1',
    description: 'Parent name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({
    example: 'Parent@gmail.com',
    description: 'Parent email',
  })
  // @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Parent contact number',
  })
  // @IsPhoneNumber(null, { message: 'Invalid contact number format' })
  @IsNotEmpty({ message: 'Contact number is required' })
  contactNo: string;

  @ApiProperty({
    example: 'Parent_line_id',
    description: 'Parent line ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  lineId?: string;

  @ApiProperty({
    example: '123 Main St, City, Country',
    description: 'Parent address',
  })
  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  address: string;

  @ApiProperty({
    example: 'https://example.com',
    description: 'Parent profile picture',
  })
  @IsString()
  @IsOptional()
  profilePicture?: string;
}
