import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from './user.entity'; // Додаємо імпорт
import { RideEntity } from './ride.entity'; // Додаємо імпорт
import { MessageEntity } from './message.entity'; // Додаємо імпорт

export class ConversationEntity {
    @ApiProperty({ description: 'The unique identifier of the conversation' })
    id!: string;

    @ApiProperty({ description: 'The user associated with the conversation' })
    user!: UserEntity;

    @ApiProperty({ description: 'The ride associated with the conversation' })
    ride!: RideEntity;

    @ApiProperty({ description: 'The creation date of the conversation' })
    createdAt!: Date;

    @ApiProperty({ description: 'The last update date of the conversation' })
    updatedAt!: Date;

    @ApiProperty({ description: 'The messages in the conversation' })
    messages!: MessageEntity[];
}