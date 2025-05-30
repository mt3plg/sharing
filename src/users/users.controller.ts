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
  @ApiOperation({ summary: 'Create a new ride' })
  @ApiResponse({ status: 201, description: 'Ride successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createRideDto: CreateRideDto, @AuthUser() user: any) {
    return this.ridesService.create(createRideDto, user.id);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search rides' })
  @ApiResponse({ status: 200, description: 'Rides successfully found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async search(@Body() searchRideDto: SearchRideDto): Promise<{ success: boolean; rides: FilteredRide[]; total: number }> {
    return this.ridesService.search(searchRideDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all rides for the current user' })
  @ApiResponse({ status: 200, description: 'Rides successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@AuthUser() user: any) {
    return this.ridesService.findAll(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a ride by ID' })
  @ApiResponse({ status: 200, description: 'Ride successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
  async findOne(@Param('id') id: string) {
    return this.ridesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a ride by ID' })
  @ApiResponse({ status: 200, description: 'Ride successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
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
  @ApiOperation({ summary: 'Send a booking request for a ride' })
  @ApiResponse({ status: 200, description: 'Booking request successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
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
  @ApiOperation({ summary: 'Update ride status' })
  @ApiResponse({ status: 200, description: 'Ride status successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
  @ApiResponse({ status: 400, description: 'Invalid status' })
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
  @ApiOperation({ summary: 'Delete a ride by ID' })
  @ApiResponse({ status: 200, description: 'Ride successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
  async delete(@Param('id') id: string, @AuthUser() user: any) {
    return this.ridesService.delete(id, user.id);
  }
}