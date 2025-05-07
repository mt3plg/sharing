import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RidesModule } from './rides/rides.module';
import { ConversationsModule } from './conversations/conversations.module';
import { PrismaService } from './prisma.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot([
            {
                ttl: 60,
                limit: 100,
            },
        ]),
        AuthModule,
        UsersModule,
        RidesModule,
        ConversationsModule,
    ],
    providers: [PrismaService],
})
export class AppModule {}