import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ConversationsModule } from '../conversations/conversations.module'; // Додано імпорт

@Module({
    imports: [
        AuthModule,
        ConversationsModule, // Додано ConversationsModule
        MulterModule.register({
            storage: diskStorage({
                destination: './Uploads/avatars',
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    const ext = extname(file.originalname);
                    cb(null, `${uniqueSuffix}${ext}`);
                },
            }),
            fileFilter: (req, file, cb) => {
                const allowedTypes = /jpeg|jpg|png|gif/;
                const ext = extname(file.originalname).toLowerCase();
                const mimetype = allowedTypes.test(file.mimetype);
                if (mimetype && allowedTypes.test(ext)) {
                    return cb(null, true);
                }
                cb(new Error('Only images (jpeg, jpg, png, gif) are allowed'), false);
            },
            limits: { fileSize: 5 * 1024 * 1024 }, // Ліміт розміру файлу: 5MB
        }),
    ],
    controllers: [UsersController],
    providers: [UsersService, PrismaService],
    exports: [UsersService],
})
export class UsersModule {}