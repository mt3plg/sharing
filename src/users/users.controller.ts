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
    UnauthorizedException,
    InternalServerErrorException,
    HttpCode,
    HttpStatus,
    Query,
    Logger,
  } from '@nestjs/common';
  import { UsersService } from './users.service';
  import { CreateUserDto } from '../dto/create-user.dto';
  import { UpdateUserDto } from '../dto/update-user.dto';
  import { UpdateLocationDto } from '../dto/update-location.dto';
  import { CreateReviewDto } from '../dto/create-review.dto';
  import { SearchUsersQueryDto } from './interfaces/search-users-query.dto';
  import { ConfirmCashPaymentDto } from '../payments/interfaces/interfaces_payment.interface';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../auth/jwt-auth.guard';
  import { FileInterceptor } from '@nestjs/platform-express';
  
  @ApiTags('users')
  @Controller('users')
  export class UsersController {
    private readonly logger = new Logger(UsersController.name);
  
    constructor(private readonly usersService: UsersService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new user' })
    @ApiResponse({ status: 201, description: 'User successfully created.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    async create(@Body() createUserDto: CreateUserDto) {
      try {
        this.logger.log(`Creating user: ${JSON.stringify(createUserDto)}`);
        return await this.usersService.create(createUserDto);
      } catch (error) {
        this.logger.error(`Error creating user: ${error}`, error);
        throw error;
      }
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
        const userId = req.user?.id;
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
    @ApiResponse({ status: 404, description: 'User not found.' })
    async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Updating profile for user ID: ${userId}`);
        return await this.usersService.update(userId, updateUserDto);
      } catch (error) {
        this.logger.error(`Error updating profile: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to update profile: ${error}`);
      }
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
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Changing password for user ID: ${userId}`);
        return await this.usersService.changePassword(
          userId,
          req.user.email,
          currentPassword,
          newPassword,
          verificationCode,
        );
      } catch (error) {
        this.logger.error(`Error changing password: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to change password: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('me/location')
    @ApiOperation({ summary: 'Update current user location' })
    @ApiResponse({ status: 200, description: 'User location successfully updated.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async updateLocation(@Request() req, @Body() updateLocationDto: UpdateLocationDto) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Updating location for user ID: ${userId}`);
        return await this.usersService.updateLocation(userId, updateLocationDto);
      } catch (error) {
        this.logger.error(`Error updating location: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to update location: ${error}`);
      }
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
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        if (!file) {
          this.logger.error('No file uploaded');
          throw new BadRequestException('File not uploaded');
        }
        if (!file.filename) {
          this.logger.error('File upload failed: filename is undefined');
          throw new BadRequestException('File upload failed: filename is undefined');
        }
        const avatarPath = `/Uploads/avatars/${file.filename}`;
        this.logger.log(`Uploading avatar for user ID: ${userId}, path: ${avatarPath}`);
        return await this.usersService.updateAvatar(userId, avatarPath);
      } catch (error) {
        this.logger.error(`Error uploading avatar: ${error}`, error);
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to upload avatar: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get(':id')
    @ApiOperation({ summary: 'Get user profile by ID' })
    @ApiResponse({ status: 200, description: 'Returns user profile.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async getUserProfile(@Param('id') userId: string, @Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const requesterId = req.user?.id;
        if (!requesterId) {
          this.logger.error('No requester ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Fetching profile for user ID: ${userId} by requester ID: ${requesterId}`);
        return await this.usersService.getUserProfile(userId, requesterId);
      } catch (error) {
        this.logger.error(`Error fetching user profile: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch user profile: ${error}`);
      }
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Update user by ID' })
    @ApiResponse({ status: 200, description: 'User successfully updated.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
      try {
        this.logger.log(`Updating user ID: ${id}`);
        return await this.usersService.update(id, updateUserDto);
      } catch (error) {
        this.logger.error(`Error updating user: ${error}`, error);
        throw error;
      }
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete user by ID' })
    @ApiResponse({ status: 200, description: 'User successfully deleted.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async remove(@Param('id') id: string) {
      try {
        this.logger.log(`Deleting user ID: ${id}`);
        return await this.usersService.remove(id);
      } catch (error) {
        this.logger.error(`Error deleting user: ${error}`, error);
        throw error;
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post(':id/reviews')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add review for a user' })
    @ApiResponse({ status: 201, description: 'Review successfully added.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    async createReview(
      @Param('id') userId: string,
      @Body() createReviewDto: CreateReviewDto,
      @Request() req,
    ) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const authorId = req.user?.id;
        if (!authorId) {
          this.logger.error('No author ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Creating review for user ID: ${userId} by author ID: ${authorId}`);
        return await this.usersService.createReview(userId, createReviewDto, authorId);
      } catch (error) {
        this.logger.error(`Error creating review: ${error}`, error);
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to create review: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('me/reviews')
    @ApiOperation({ summary: 'Get current user reviews' })
    @ApiResponse({ status: 200, description: 'Returns list of user reviews.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async getUserReviews(@Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Fetching reviews for user with ID: ${userId}`);
        return await this.usersService.getUserReviews(userId);
      } catch (error) {
        this.logger.error(`Error fetching user reviews: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch user reviews: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('friend-requests')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Send friend request' })
    @ApiResponse({ status: 201, description: 'Friend request successfully sent.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    async sendFriendRequest(@Request() req, @Body('receiverId') receiverId: string) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const senderId = req.user?.id;
        if (!senderId) {
          this.logger.error('No sender ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Sending friend request from user ID: ${senderId} to receiver ID: ${receiverId}`);
        return await this.usersService.createFriendRequest(senderId, receiverId);
      } catch (error) {
        this.logger.error(`Error sending friend request: ${error}`, error);
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to send friend request: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('friend-requests/incoming')
    @ApiOperation({ summary: 'Get incoming friend requests' })
    @ApiResponse({ status: 200, description: 'Returns list of incoming friend requests.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getIncomingFriendRequests(@Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Fetching incoming friend requests for user ID: ${userId}`);
        return await this.usersService.getIncomingFriendRequests(userId);
      } catch (error) {
        this.logger.error(`Error fetching friend requests: ${error}`, error);
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch friend requests: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('friend-requests/:id/accept')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Accept friend request' })
    @ApiResponse({ status: 200, description: 'Friend request accepted.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 404, description: 'Friend request not found.' })
    async acceptFriendRequest(@Param('id') requestId: string, @Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Accepting friend request ID: ${requestId} for user ID: ${userId}`);
        return await this.usersService.acceptFriendRequest(requestId, userId);
      } catch (error) {
        this.logger.error(`Error accepting friend request: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to accept friend request: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('friend-requests/:id/reject')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reject friend request' })
    @ApiResponse({ status: 200, description: 'Friend request rejected.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 404, description: 'Friend request not found.' })
    async rejectFriendRequest(@Param('id') requestId: string, @Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Rejecting friend request ID: ${requestId} for user ID: ${userId}`);
        return await this.usersService.rejectFriendRequest(requestId, userId);
      } catch (error) {
        this.logger.error(`Error rejecting friend request: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to reject friend request: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('me/friends')
    @ApiOperation({ summary: 'Get current user friends' })
    @ApiResponse({ status: 200, description: 'Returns list of friends.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getFriends(@Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Fetching friends for user ID: ${userId}`);
        return await this.usersService.getFriends(userId);
      } catch (error) {
        this.logger.error(`Error fetching friends: ${error}`, error);
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch friends: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('me/friends-list')
    @ApiOperation({ summary: 'Get current user friends list' })
    @ApiResponse({ status: 200, description: 'Returns list of friends.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getFriendsList(@Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Fetching friends list for user ID: ${userId}`);
        return await this.usersService.getFriendsList(userId);
      } catch (error) {
        this.logger.error(`Error fetching friends list: ${error}`, error);
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch friends list: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('me/passengers')
    @ApiOperation({ summary: 'Get passengers for rides driven by the current user' })
    @ApiResponse({ status: 200, description: 'Returns list of passengers.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getPassengers(@Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Fetching passengers for user ID: ${userId}`);
        return await this.usersService.getPassengers(userId);
      } catch (error) {
        this.logger.error(`Error fetching passengers: ${error}`, error);
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch passengers: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('me/drivers')
    @ApiOperation({ summary: 'Get drivers for rides where the current user was a passenger' })
    @ApiResponse({ status: 200, description: 'Returns list of drivers.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getDrivers(@Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Fetching drivers for user ID: ${userId}`);
        return await this.usersService.getDrivers(userId);
      } catch (error) {
        this.logger.error(`Error fetching drivers: ${error}`, error);
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch drivers: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Delete('friends/:friendId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove a friend' })
    @ApiResponse({ status: 200, description: 'Friendship successfully terminated.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 404, description: 'Users are not friends.' })
    async removeFriend(@Param('friendId') friendId: string, @Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Removing friend ID: ${friendId} for user ID: ${userId}`);
        return await this.usersService.removeFriend(userId, friendId);
      } catch (error) {
        this.logger.error(`Error removing friend: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to remove friend: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('search')
    @ApiOperation({ summary: 'Search users by name or email with pagination and category filter' })
    @ApiResponse({ status: 200, description: 'Returns list of users.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async searchUsers(@Query() queryDto: SearchUsersQueryDto, @Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Searching users for user ID: ${userId}, query: ${JSON.stringify(queryDto)}`);
        return await this.usersService.searchUsers(
          queryDto.query,
          userId,
          queryDto.category,
          queryDto.limit,
          queryDto.offset,
        );
      } catch (error) {
        this.logger.error(`Error searching users: ${error}`, error);
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to search users: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('me/booking-requests')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a booking request' })
    @ApiResponse({ status: 201, description: 'Booking request successfully created.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    async createBookingRequest(@Body('rideId') rideId: string, @Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Creating booking request for user ID: ${userId}, ride ID: ${rideId}`);
        return await this.usersService.createBookingRequest(rideId, userId);
      } catch (error) {
        this.logger.error(`Error creating booking request: ${error}`, error);
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to create booking request: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('me/booking-requests')
    @ApiOperation({ summary: 'Get booking requests for the driver' })
    @ApiResponse({ status: 200, description: 'Returns list of booking requests.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getBookingRequests(@Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Fetching booking requests for user ID: ${userId}`);
        return await this.usersService.getBookingRequests(userId);
      } catch (error) {
        this.logger.error(`Error fetching booking requests: ${error}`, error);
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch booking requests: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('booking-requests/:id/accept')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Accept a booking request' })
    @ApiResponse({ status: 200, description: 'Booking request accepted.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 404, description: 'Booking request not found.' })
    async acceptBookingRequest(@Param('id') bookingRequestId: string, @Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Accepting booking request ID: ${bookingRequestId} for user ID: ${userId}`);
        return await this.usersService.acceptBookingRequest(bookingRequestId, userId);
      } catch (error) {
        this.logger.error(`Error accepting booking request: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to accept booking request: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('booking-requests/:id/reject')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reject a booking request' })
    @ApiResponse({ status: 200, description: 'Booking request rejected.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 404, description: 'Booking request not found.' })
    async rejectBookingRequest(@Param('id') bookingRequestId: string, @Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Rejecting booking request ID: ${bookingRequestId} for user ID: ${userId}`);
        return await this.usersService.rejectBookingRequest(bookingRequestId, userId);
      } catch (error) {
        this.logger.error(`Error rejecting booking request: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to reject booking request: ${error}`);
      }
    }
  
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('confirm-cash-payment')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Confirm a cash payment by driver' })
    @ApiResponse({ status: 200, description: 'Cash payment confirmed.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    async confirmCashPayment(@Body() confirmCashPaymentDto: ConfirmCashPaymentDto, @Request() req) {
      try {
        this.logger.log(`Request user: ${JSON.stringify(req.user)}`);
        const userId = req.user?.id;
        if (!userId) {
          this.logger.error('No user ID found in request');
          throw new UnauthorizedException('Invalid user authentication');
        }
        this.logger.log(`Confirming cash payment for user ID: ${userId}`);
        return await this.usersService.confirmCashPayment(userId, confirmCashPaymentDto);
      } catch (error) {
        this.logger.error(`Error confirming cash payment: ${error}`, error);
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to confirm cash payment: ${error}`);
      }
    }
  }