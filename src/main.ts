import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as dotenv from 'dotenv'; // Імпортуємо dotenv

// Завантажуємо змінні середовища з файлу .env
dotenv.config();

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

    // Налаштування статичного доступу до файлів
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    });

    // Отримуємо порт зі змінних середовища або використовуємо 3000 за замовчуванням
    const port = process.env.PORT || 3000;

    // Запускаємо сервер
    await app.listen(port);
    console.log(`Server is running on http://localhost:${port}`);
}
bootstrap();