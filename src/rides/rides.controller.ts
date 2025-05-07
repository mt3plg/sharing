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
import { RidesService } from './rides.service';
import { CreateRideDto, SearchRideDto } from './interfaces/interfaces_ride.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/decorators/common_decorators_user.decorator';
import { FilteredRide } from './rides.service'; 

@ApiTags('rides')
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new ride' })
  @ApiResponse({ status: 201, description: 'Ride created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createRideDto: CreateRideDto, @AuthUser() user: any) {
    return this.ridesService.create(createRideDto, user.id);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search for rides' })
  @ApiResponse({ status: 200, description: 'Rides found successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async search(@Body() searchRideDto: SearchRideDto): Promise<{ success: boolean; rides: FilteredRide[] }> {
    return this.ridesService.search(searchRideDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all rides for the current user' })
  @ApiResponse({ status: 200, description: 'Rides retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@AuthUser() user: any) {
    return this.ridesService.findAll(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a ride by ID' })
  @ApiResponse({ status: 200, description: 'Ride retrieved successfully' })
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
  @ApiResponse({ status: 200, description: 'Ride updated successfully' })
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
  @ApiOperation({ summary: 'Book a ride' })
  @ApiResponse({ status: 200, description: 'Ride booked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
  async bookRide(
    @Param('id') id: string,
    @Body('passengerCount') passengerCount: number,
    @AuthUser() user: any,
  ) {
    return this.ridesService.bookRide(id, user.id, passengerCount);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the status of a ride' })
  @ApiResponse({ status: 200, description: 'Ride status updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
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
  @ApiResponse({ status: 200, description: 'Ride deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
  async delete(@Param('id') id: string, @AuthUser() user: any) {
    return this.ridesService.delete(id, user.id);
  }
}