import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from './user.entity'; // Додаємо імпорт
import { ConversationEntity } from './conversation.entity'; // Додаємо імпорт

export class MessageEntity {
    @ApiProperty({ description: 'The unique identifier of the message' })
    id!: string;

    @ApiProperty({ description: 'The content of the message' })
    content!: string;

    @ApiProperty({ description: 'The sender of the message' })
    sender!: UserEntity;

    @ApiProperty({ description: 'The conversation the message belongs to' })
    conversation!: ConversationEntity;

    @ApiProperty({ description: 'The creation date of the message' })
    createdAt!: Date;
}