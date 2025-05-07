import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class CreateUserDto {
    @ApiProperty({ example: 'John Doe', description: 'The name of the user' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty({ example: 'john.doe@example.com', description: 'The email of the user' })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({ example: '+380671234567', description: 'The phone number of the user' })
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @ApiProperty({ example: 'password123', description: 'The password of the user' })
    @IsString()
    @IsNotEmpty()
    password!: string;

    @ApiProperty({ example: '123456', description: 'The verification token for email verification', required: false })
    @IsString()
    @IsOptional()
    verificationToken?: string;
}