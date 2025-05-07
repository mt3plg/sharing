import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from './user.entity'; // Додаємо імпорт
import { ConversationEntity } from './conversation.entity'; // Додаємо імпорт

export class RideEntity {
    @ApiProperty({ description: 'The unique identifier of the ride' })
    id!: string;

    @ApiProperty({ description: 'The starting location of the ride' })
    startLocation!: string;

    @ApiProperty({ description: 'The destination of the ride' })
    endLocation!: string;

    @ApiProperty({ description: 'The departure time of the ride' })
    departureTime!: Date;

    @ApiProperty({ description: 'The number of available seats in the ride' })
    availableSeats!: number;

    @ApiProperty({ description: 'The driver of the ride' })
    driver!: UserEntity;

    @ApiProperty({ description: 'The passenger of the ride' })
    passenger?: UserEntity | null;

    @ApiProperty({ description: 'The creation date of the ride' })
    createdAt!: Date;

    @ApiProperty({ description: 'The last update date of the ride' })
    updatedAt!: Date;

    conversations?: ConversationEntity[];
}