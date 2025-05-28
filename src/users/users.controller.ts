import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    NotFoundException,
    HttpCode,
    HttpStatus,
    Query,
    InternalServerErrorException,
    UnauthorizedException,
    Logger,
  } from '@nestjs/common';
  import { UsersService } from './users.service';
  import { CreateUserDto } from '../dto/create-user.dto';
  import { UpdateUserDto } from '../dto/update-user.dto';
  import { UpdateLocationDto } from '../dto/update-location.dto';
  import { CreateReviewDto } from '../dto/create-review.dto';
  import { SearchUsersQueryDto } from './interfaces/search-users-query.dto';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../auth/jwt-auth.guard';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { AuthUser } from '../common/decorators/common_decorators_user.decorator';
  import { ConfirmCashPaymentDto } from '../payments/interfaces/interfaces_payment.interface';
  
  @ApiTags('users')
  @Controller('users')
  export class UsersController {
    private readonly logger = new Logger(UsersController.name);
  
    constructor(private readonly usersService: UsersService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new user' })
    @ApiResponse({ status: 201, description: 'User successfully created.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    create(@Body() createUserDto: CreateUserDto) {
      return this.usersService.create(createUserDto);
    }
  
    @UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Get('me')
@ApiOperation({ summary: 'Get current user data' })
@ApiResponse({ status: 200, description: 'Returns user data.' })
@ApiResponse({ status: 401, description: 'Unauthorized.' })
@ApiResponse({ status: 404, description: 'User not found.' })
@ApiResponse({ status: 500, description: 'Internal server error.' })
async getCurrentUser(@Request() req) {
  try {
    this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
    const userId = req.user?.id; // Змінено sub на id
    if (!userId) {
      this.logger.error('No user ID found in request');
      throw new UnauthorizedException('Invalid user authentication');
    }
    this.logger.log(`Fetching current user with ID: ${userId}`);
    const user = await this.usersService.findOne(userId);
    if (!user) {
      this.logger.warn(`User with ID ${userId} not found`);
      throw new NotFoundException('User not found');
    }
    return user;
  } catch (error) {
    this.logger.error(`Error fetching current user: ${error}`, error);
    if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
      throw error;
    }
    throw new InternalServerErrorException(`Failed to fetch current user: ${error}`);
  }
}
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('me')
    @ApiOperation({ summary: 'Update current user profile' })
    @ApiResponse({ status: 200, description: 'User profile successfully updated.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
      const userId = req.user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.update(userId, updateUserDto);
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('me/password')
    @ApiOperation({ summary: 'Change current user password' })
    @ApiResponse({ status: 200, description: 'Password successfully changed.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    async changePassword(
      @Request() req,
      @Body('currentPassword') currentPassword: string,
      @Body('newPassword') newPassword: string,
      @Body('verificationCode') verificationCode: string,
    ) {
      const userId = req.user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.changePassword(userId, req.user.email, currentPassword, newPassword, verificationCode);
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('me/location')
    @ApiOperation({ summary: 'Update current user location' })
    @ApiResponse({ status: 200, description: 'User location successfully updated.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async updateLocation(@Request() req, @Body() updateLocationDto: UpdateLocationDto) {
      const userId = req.user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.updateLocation(userId, updateLocationDto);
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('me/avatar')
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Upload current user avatar' })
    @ApiResponse({ status: 200, description: 'User avatar successfully uploaded.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    @UseInterceptors(FileInterceptor('avatar'))
    async uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
      const userId = req.user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      if (!file) {
        throw new BadRequestException('File not uploaded');
      }
      if (!file.filename) {
        throw new BadRequestException('File upload failed: filename is undefined');
      }
      const avatarPath = `/Uploads/avatars/${file.filename}`;
      return this.usersService.updateAvatar(userId, avatarPath);
    }
  
    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get user profile by ID' })
    @ApiResponse({ status: 200, description: 'Returns user profile.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async getUserProfile(@Param('id') userId: string, @AuthUser() user: any) {
      const requesterId = user?.sub;
      if (!requesterId) {
        this.logger.error('No requester ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.getUserProfile(userId, requesterId);
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Update user by ID' })
    @ApiResponse({ status: 200, description: 'User successfully updated.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
      return this.usersService.update(id, updateUserDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete user by ID' })
    @ApiResponse({ status: 200, description: 'User successfully deleted.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    remove(@Param('id') id: string) {
      return this.usersService.remove(id);
    }
  
    @Post(':id/reviews')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add review for a user' })
    @ApiResponse({ status: 201, description: 'Review successfully added.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async createReview(
      @Param('id') userId: string,
      @Body() createReviewDto: CreateReviewDto,
      @AuthUser() user: any,
    ) {
      const authorId = user?.sub;
      if (!authorId) {
        this.logger.error('No author ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.createReview(userId, createReviewDto, authorId);
    }
  
    @Get('me/reviews')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user reviews' })
    @ApiResponse({ status: 200, description: 'Returns list of user reviews.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getUserReviews(@AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.getUserReviews(userId);
    }
  
    @Post('friend-requests')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Send friend request' })
    @ApiResponse({ status: 201, description: 'Friend request successfully sent.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async sendFriendRequest(@AuthUser() user: any, @Body('receiverId') receiverId: string) {
      const senderId = user?.sub;
      if (!senderId) {
        this.logger.error('No sender ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.createFriendRequest(senderId, receiverId);
    }
  
    @Get('friend-requests/incoming')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get incoming friend requests' })
    @ApiResponse({ status: 200, description: 'Returns list of incoming friend requests.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getIncomingFriendRequests(@AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.getIncomingFriendRequests(userId);
    }
  
    @Patch('friend-requests/:id/accept')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Accept friend request' })
    @ApiResponse({ status: 200, description: 'Friend request accepted.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async acceptFriendRequest(@Param('id') requestId: string, @AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.acceptFriendRequest(requestId, userId);
    }
  
    @Patch('friend-requests/:id/reject')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reject friend request' })
    @ApiResponse({ status: 200, description: 'Friend request rejected.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async rejectFriendRequest(@Param('id') requestId: string, @AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.rejectFriendRequest(requestId, userId);
    }
  
    @Get('me/friends')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user friends' })
    @ApiResponse({ status: 200, description: 'Returns list of friends.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getFriends(@AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.getFriends(userId);
    }
  
    @Get('me/friends-list')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user friends list' })
    @ApiResponse({ status: 200, description: 'Returns list of friends.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getFriendsList(@AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.getFriendsList(userId);
    }
  
    @Get('me/passengers')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get passengers for rides driven by the current user' })
    @ApiResponse({ status: 200, description: 'Returns list of passengers.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getPassengers(@AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.getPassengers(userId);
    }
  
    @Get('me/drivers')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get drivers for rides where the current user was a passenger' })
    @ApiResponse({ status: 200, description: 'Returns list of drivers.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getDrivers(@AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.getDrivers(userId);
    }
  
    @Delete('friends/:friendId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove a friend' })
    @ApiResponse({ status: 200, description: 'Friendship successfully terminated.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 404, description: 'Users are not friends.' })
    async removeFriend(@Param('friendId') friendId: string, @AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.removeFriend(userId, friendId);
    }
  
    @Get('search')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Search users by name or email with pagination and category filter' })
    @ApiResponse({ status: 200, description: 'Returns list of users.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async searchUsers(@Query() queryDto: SearchUsersQueryDto, @AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.searchUsers(
        queryDto.query,
        userId,
        queryDto.category,
        queryDto.limit,
        queryDto.offset,
      );
    }
  
    @Post('me/booking-requests')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a booking request' })
    @ApiResponse({ status: 201, description: 'Booking request successfully created.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async createBookingRequest(@Body('rideId') rideId: string, @AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.createBookingRequest(rideId, userId);
    }
  
    @Get('me/booking-requests')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get booking requests for the driver' })
    @ApiResponse({ status: 200, description: 'Returns list of booking requests.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getBookingRequests(@AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.getBookingRequests(userId);
    }
  
    @Post('booking-requests/:id/accept')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Accept a booking request' })
    @ApiResponse({ status: 200, description: 'Booking request accepted.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async acceptBookingRequest(@Param('id') bookingRequestId: string, @AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.acceptBookingRequest(bookingRequestId, userId);
    }
  
    @Post('booking-requests/:id/reject')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reject a booking request' })
    @ApiResponse({ status: 200, description: 'Booking request rejected.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async rejectBookingRequest(@Param('id') bookingRequestId: string, @AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.rejectBookingRequest(bookingRequestId, userId);
    }
  
    @Post('confirm-cash-payment')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Confirm a cash payment by driver' })
    @ApiResponse({ status: 200, description: 'Cash payment confirmed' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async confirmCashPayment(@Body() confirmCashPaymentDto: ConfirmCashPaymentDto, @AuthUser() user: any) {
      const userId = user?.sub;
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new UnauthorizedException('Invalid user authentication');
      }
      return this.usersService.confirmCashPayment(userId, confirmCashPaymentDto);
    }
  }