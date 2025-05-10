import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as dotenv from 'dotenv';
import * as cors from 'cors';
import * as express from 'express'; // Додаємо express для явного middleware

dotenv.config();

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Налаштування CORS для всіх запитів
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Явне налаштування статичних файлів із CORS
    app.use('/uploads', cors(), express.static(join(__dirname, '..', 'Uploads')));

    // Налаштування Swagger
    const config = new DocumentBuilder()
        .setTitle('Carpooling API')
        .setDescription('API for the Carpooling application')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    // Налаштування валідації
    app.useGlobalPipes(new ValidationPipe());

    // Отримуємо порт зі змінних середовища або використовуємо 3000 за замовчуванням
    const port = process.env.PORT || 3000;

    // Запускаємо сервер
    await app.listen(port);
    console.log(`Server is running on http://localhost:${port}`);
}
bootstrap();