import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { PrismaService } from '../prisma.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule], // Додаємо імпорт EmailModule
  controllers: [RidesController],
  providers: [RidesService, PrismaService],
})
export class RidesModule {}