import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RidesService, FilteredRide } from './rides.service';
import { CreateRideDto, SearchRideDto, BookRideDto } from './interfaces/interfaces_ride.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/decorators/common_decorators_user.decorator';

@ApiTags('rides')
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Створити нову поїздку' })
  @ApiResponse({ status: 201, description: 'Поїздка успішно створена' })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  @ApiResponse({ status: 400, description: 'Невірний запит' })
  async create(@Body() createRideDto: CreateRideDto, @AuthUser() user: any) {
    return this.ridesService.create(createRideDto, user.id);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Пошук поїздок' })
  @ApiResponse({ status: 200, description: 'Поїздки успішно знайдено' })
  @ApiResponse({ status: 400, description: 'Невірний запит' })
  async search(@Body() searchRideDto: SearchRideDto): Promise<{ success: boolean; rides: FilteredRide[]; total: number }> {
    return this.ridesService.search(searchRideDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отримати всі поїздки поточного користувача' })
  @ApiResponse({ status: 200, description: 'Поїздки успішно отримано' })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  async findAll(@AuthUser() user: any) {
    return this.ridesService.findAll(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отримати поїздку за ID' })
  @ApiResponse({ status: 200, description: 'Поїздка успішно отримана' })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  @ApiResponse({ status: 404, description: 'Поїздку не знайдено' })
  async findOne(@Param('id') id: string) {
    return this.ridesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Оновити поїздку за ID' })
  @ApiResponse({ status: 200, description: 'Поїздка успішно оновлена' })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  @ApiResponse({ status: 403, description: 'Заборонено' })
  @ApiResponse({ status: 404, description: 'Поїздку не знайдено' })
  async update(
    @Param('id') id: string,
    @Body() updateRideDto: Partial<CreateRideDto>,
    @AuthUser() user: any,
  ) {
    return this.ridesService.update(id, updateRideDto, user.id);
  }

  @Post(':id/book')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Надіслати запит на бронювання поїздки' })
  @ApiResponse({ status: 200, description: 'Запит на бронювання успішно створено' })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  @ApiResponse({ status: 404, description: 'Поїздку не знайдено' })
  @ApiResponse({ status: 400, description: 'Невірний запит' })
  async bookRide(
    @Param('id') id: string,
    @Body() bookRideDto: BookRideDto,
    @AuthUser() user: any,
  ) {
    return this.ridesService.bookRide(id, user.id, bookRideDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Оновити статус поїздки' })
  @ApiResponse({ status: 200, description: 'Статус поїздки успішно оновлено' })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  @ApiResponse({ status: 403, description: 'Заборонено' })
  @ApiResponse({ status: 404, description: 'Поїздку не знайдено' })
  @ApiResponse({ status: 400, description: 'Невірний статус' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @AuthUser() user: any,
  ) {
    return this.ridesService.updateStatus(id, status, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Видалити поїздку за ID' })
  @ApiResponse({ status: 200, description: 'Поїздка успішно видалена' })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  @ApiResponse({ status: 403, description: 'Заборонено' })
  @ApiResponse({ status: 404, description: 'Поїздку не знайдено' })
  async delete(@Param('id') id: string, @AuthUser() user: any) {
    return this.ridesService.delete(id, user.id);
  }
}