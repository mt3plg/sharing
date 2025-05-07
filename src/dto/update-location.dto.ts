import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateLocationDto {
    @ApiProperty({ example: 'Kyiv, Ukraine', description: 'The name of the location' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty({ example: 50.4501, description: 'The latitude of the location' })
    @IsNumber()
    @IsNotEmpty()
    latitude!: number;

    @ApiProperty({ example: 30.5234, description: 'The longitude of the location' })
    @IsNumber()
    @IsNotEmpty()
    longitude!: number;
}