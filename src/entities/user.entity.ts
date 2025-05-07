import { ApiProperty } from '@nestjs/swagger';
import { RideEntity } from './ride.entity';
import { ConversationEntity } from './conversation.entity';
import { MessageEntity } from './message.entity';

export class UserEntity {
    @ApiProperty({ description: 'The unique identifier of the user' })
    id!: string;

    @ApiProperty({ description: 'The name of the user' })
    name!: string;

    @ApiProperty({ description: 'The email of the user' })
    email!: string;

    @ApiProperty({ description: 'The phone number of the user' })
    phone!: string;

    @ApiProperty({ description: 'The password of the user (hashed)' })
    password?: string;

    @ApiProperty({ description: 'The status of the user (e.g., pending, verified)' })
    status!: string;

    @ApiProperty({ description: 'The verification token for email verification' })
    verificationToken?: string | null;

    @ApiProperty({ description: 'The name of the user’s location' })
    locationName?: string | null;

    @ApiProperty({ description: 'The latitude of the user’s location' })
    latitude?: number | null;

    @ApiProperty({ description: 'The longitude of the user’s location' })
    longitude?: number | null;

    @ApiProperty({ description: 'The creation date of the user' })
    createdAt!: Date;

    @ApiProperty({ description: 'The last update date of the user' })
    updatedAt!: Date;

    @ApiProperty({ description: 'The avatar URL of the user', required: false })
    avatar?: string | null; // Додаємо поле avatar

    @ApiProperty({ type: [RideEntity], description: 'Rides where the user is the driver' })
    rides?: RideEntity[];

    @ApiProperty({ type: [RideEntity], description: 'Rides where the user is a passenger' })
    passengerRides?: RideEntity[];

    @ApiProperty({ type: [ConversationEntity], description: 'Conversations the user is part of' })
    conversations?: ConversationEntity[];

    @ApiProperty({ type: [MessageEntity], description: 'Messages sent by the user' })
    messages?: MessageEntity[];
}