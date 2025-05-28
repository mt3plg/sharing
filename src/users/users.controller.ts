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
    async getCurrentUser(@Request() req) {
      return this.usersService.findOne(req.user.sub);
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('me')
    @ApiOperation({ summary: 'Update current user profile' })
    @ApiResponse({ status: 200, description: 'User profile successfully updated.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
      return this.usersService.update(req.user.sub, updateUserDto);
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
      return this.usersService.changePassword(req.user.sub, req.user.email, currentPassword, newPassword, verificationCode);
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('me/location')
    @ApiOperation({ summary: 'Update current user location' })
    @ApiResponse({ status: 200, description: 'User location successfully updated.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async updateLocation(@Request() req, @Body() updateLocationDto: UpdateLocationDto) {
      return this.usersService.updateLocation(req.user.sub, updateLocationDto);
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
      if (!file) {
        throw new BadRequestException('File not uploaded');
      }
      if (!file.filename) {
        throw new BadRequestException('File upload failed: filename is undefined');
      }
      const avatarPath = `/Uploads/avatars/${file.filename}`;
      return this.usersService.updateAvatar(req.user.sub, avatarPath);
    }
  
    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get user profile by ID' })
    @ApiResponse({ status: 200, description: 'Returns user profile.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async getUserProfile(@Param('id') userId: string, @AuthUser() user: any) {
      return this.usersService.getUserProfile(userId, user.sub);
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
      return this.usersService.createReview(userId, createReviewDto, user.sub);
    }
  
    @Get('me/reviews')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user reviews' })
    @ApiResponse({ status: 200, description: 'Returns list of user reviews.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getUserReviews(@AuthUser() user: any) {
      return this.usersService.getUserReviews(user.sub);
    }
  
    @Post('friend-requests')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Send friend request' })
    @ApiResponse({ status: 201, description: 'Friend request successfully sent.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async sendFriendRequest(@AuthUser() user: any, @Body('receiverId') receiverId: string) {
      return this.usersService.createFriendRequest(user.sub, receiverId);
    }
  
    @Get('friend-requests/incoming')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get incoming friend requests' })
    @ApiResponse({ status: 200, description: 'Returns list of incoming friend requests.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getIncomingFriendRequests(@AuthUser() user: any) {
      return this.usersService.getIncomingFriendRequests(user.sub);
    }
  
    @Patch('friend-requests/:id/accept')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Accept friend request' })
    @ApiResponse({ status: 200, description: 'Friend request accepted.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async acceptFriendRequest(@Param('id') requestId: string, @AuthUser() user: any) {
      return this.usersService.acceptFriendRequest(requestId, user.sub);
    }
  
    @Patch('friend-requests/:id/reject')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reject friend request' })
    @ApiResponse({ status: 200, description: 'Friend request rejected.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async rejectFriendRequest(@Param('id') requestId: string, @AuthUser() user: any) {
      return this.usersService.rejectFriendRequest(requestId, user.sub);
    }
  
    @Get('me/friends')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user friends' })
    @ApiResponse({ status: 200, description: 'Returns list of friends.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getFriends(@AuthUser() user: any) {
      return this.usersService.getFriends(user.sub);
    }
  
    @Get('me/friends-list')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user friends list' })
    @ApiResponse({ status: 200, description: 'Returns list of friends.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getFriendsList(@AuthUser() user: any) {
      return this.usersService.getFriendsList(user.sub);
    }
  
    @Get('me/passengers')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get passengers for rides driven by the current user' })
    @ApiResponse({ status: 200, description: 'Returns list of passengers.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getPassengers(@AuthUser() user: any) {
      return this.usersService.getPassengers(user.sub);
    }
  
    @Get('me/drivers')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get drivers for rides where the current user was a passenger' })
    @ApiResponse({ status: 200, description: 'Returns list of drivers.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getDrivers(@AuthUser() user: any) {
      return this.usersService.getDrivers(user.sub);
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
      return this.usersService.removeFriend(user.sub, friendId);
    }
  
    @Get('search')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Search users by name or email with pagination and category filter' })
    @ApiResponse({ status: 200, description: 'Returns list of users.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async searchUsers(@Query() queryDto: SearchUsersQueryDto, @AuthUser() user: any) {
      return this.usersService.searchUsers(
        queryDto.query,
        user.sub,
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
      return this.usersService.createBookingRequest(rideId, user.sub);
    }
  
    @Get('me/booking-requests')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get booking requests for the driver' })
    @ApiResponse({ status: 200, description: 'Returns list of booking requests.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getBookingRequests(@AuthUser() user: any) {
      return this.usersService.getBookingRequests(user.sub);
    }
  
    @Post('booking-requests/:id/accept')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Accept a booking request' })
    @ApiResponse({ status: 200, description: 'Booking request accepted.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async acceptBookingRequest(@Param('id') bookingRequestId: string, @AuthUser() user: any) {
      return this.usersService.acceptBookingRequest(bookingRequestId, user.sub);
    }
  
    @Post('booking-requests/:id/reject')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reject a booking request' })
    @ApiResponse({ status: 200, description: 'Booking request rejected.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async rejectBookingRequest(@Param('id') bookingRequestId: string, @AuthUser() user: any) {
      return this.usersService.rejectBookingRequest(bookingRequestId, user.sub);
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
      return this.usersService.confirmCashPayment(user.sub, confirmCashPaymentDto);
    }
  }