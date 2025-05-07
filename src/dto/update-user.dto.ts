import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsNumber } from 'class-validator';

export class UpdateUserDto {
    @ApiProperty({ example: 'John Doe', description: 'The name of the user', required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ example: 'john.doe@example.com', description: 'The email of the user', required: false })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty({ example: '+380671234567', description: 'The phone number of the user', required: false })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiProperty({ example: 'newpassword123', description: 'The new password of the user', required: false })
    @IsString()
    @IsOptional()
    password?: string;

    @ApiProperty({ example: 'verified', description: 'The status of the user', required: false })
    @IsString()
    @IsOptional()
    status?: string;

    @ApiProperty({ example: '123456', description: 'The verification token for email verification', required: false })
    @IsString()
    @IsOptional()
    verificationToken?: string;

    @ApiProperty({ example: 'Kyiv, Ukraine', description: 'The name of the user’s location', required: false })
    @IsString()
    @IsOptional()
    locationName?: string;

    @ApiProperty({ example: 50.4501, description: 'The latitude of the user’s location', required: false })
    @IsNumber()
    @IsOptional()
    latitude?: number;

    @ApiProperty({ example: 30.5234, description: 'The longitude of the user’s location', required: false })
    @IsNumber()
    @IsOptional()
    longitude?: number;
}