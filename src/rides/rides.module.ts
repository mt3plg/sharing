import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [RidesController],
  providers: [RidesService, PrismaService],
})
export class RidesModule {}