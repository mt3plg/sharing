import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { EmailModule } from '../email/email.module'; // Додано імпорт

@Module({
    imports: [
        forwardRef(() => UsersModule),
        ConversationsModule,
        EmailModule, // Додано EmailModule
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'yourSecretKey',
            signOptions: { expiresIn: '1h' },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, PrismaService, JwtStrategy],
    exports: [AuthService, JwtModule],
})
export class AuthModule {}