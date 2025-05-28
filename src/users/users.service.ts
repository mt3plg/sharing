import {
    Injectable,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    InternalServerErrorException,
    Logger,
  } from '@nestjs/common';
  import { PrismaService } from '../prisma.service';
  import { CreateUserDto } from '../dto/create-user.dto';
  import { UpdateUserDto } from '../dto/update-user.dto';
  import { UpdateLocationDto } from '../dto/update-location.dto';
  import { CreateReviewDto } from '../dto/create-review.dto';
  import { UserEntity } from '../entities/user.entity';
  import { join } from 'path';
  import { unlink } from 'fs/promises';
  import { AuthService } from '../auth/auth.service';
  import * as bcrypt from 'bcrypt';
  import { ConversationsService } from '../conversations/conversations.service';
  import { PaymentsService } from '../payments/payments.service';
  import { ConfirmCashPaymentDto } from '../payments/interfaces/interfaces_payment.interface';
  import { SearchUsersQueryDto } from './interfaces/search-users-query.dto';
  
  @Injectable()
  export class UsersService {
    private readonly logger = new Logger(UsersService.name);
  
    constructor(
      private readonly prisma: PrismaService,
      private readonly authService: AuthService,
      private readonly conversationsService: ConversationsService,
      private readonly paymentsService: PaymentsService,
    ) {}
  
    async create(createUserDto: CreateUserDto): Promise<UserEntity> {
      try {
        this.logger.log(`Creating user with email: ${createUserDto.email}`);
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        const user = await this.prisma.user.create({
          data: {
            ...createUserDto,
            password: hashedPassword,
            status: 'pending',
            verificationToken: createUserDto.verificationToken ?? null,
          },
        });
        this.logger.log(`User created with ID: ${user.id}`);
        return user;
      } catch (error) {
        this.logger.error(`Failed to create user: ${error}`, error);
        throw new BadRequestException(`Failed to create user: ${error}`);
      }
    }
  
    async findOne(id: string): Promise<UserEntity | null> {
      if (!id) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      this.logger.log(`Finding user with ID: ${id}`);
      try {
        const user = await this.prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            password: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            locationName: true,
            latitude: true,
            longitude: true,
            rating: true,
            driverTrips: true,
            passengerTrips: true,
            avatar: true,
            stripeCustomerId: true,
            stripeAccountId: true,
          },
        });
        if (!user) {
          this.logger.warn(`User with ID ${id} not found`);
          return null;
        }
        this.logger.log(`Found user with ID: ${id}`);
        return user;
      } catch (error) {
        this.logger.error(`Error fetching user with ID ${id}: ${error}`, error);
        throw new InternalServerErrorException(`Database query failed: ${error}`);
      }
    }
  
    async findMany(query: any): Promise<any> {
      try {
        this.logger.log(`Finding users with query: ${JSON.stringify(query)}`);
        const users = await this.prisma.user.findMany(query);
        this.logger.log(`Found ${users.length} users`);
        return users;
      } catch (error) {
        this.logger.error(`Error fetching users: ${error}`, error);
        throw new InternalServerErrorException(`Failed to fetch users: ${error}`);
      }
    }
  
    async findByEmail(email: string): Promise<UserEntity | null> {
      if (!email) {
        this.logger.error('Invalid email provided: undefined or null');
        throw new BadRequestException('Email is required');
      }
      try {
        this.logger.log(`Finding user by email: ${email}`);
        const user = await this.prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            password: true,
            status: true,
            verificationToken: true,
            createdAt: true,
            updatedAt: true,
            locationName: true,
            latitude: true,
            longitude: true,
            rating: true,
            driverTrips: true,
            passengerTrips: true,
            avatar: true,
            stripeCustomerId: true,
            stripeAccountId: true,
          },
        });
        if (!user) {
          this.logger.warn(`User with email ${email} not found`);
        }
        return user;
      } catch (error) {
        this.logger.error(`Error fetching user by email ${email}: ${error}`, error);
        throw new InternalServerErrorException(`Failed to fetch user by email: ${error}`);
      }
    }
  
    async update(id: string, updateUserDto: UpdateUserDto): Promise<UserEntity> {
      if (!id) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Updating user with ID: ${id}`);
        const user = await this.findOne(id);
        if (!user) {
          this.logger.warn(`User with ID ${id} not found`);
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        const updateData: any = { ...updateUserDto };
        if (updateUserDto.password) {
          updateData.password = await bcrypt.hash(updateUserDto.password, 10);
        }
        const updatedUser = await this.prisma.user.update({
          where: { id },
          data: updateData,
        });
        this.logger.log(`User with ID ${id} updated`);
        return updatedUser;
      } catch (error) {
        this.logger.error(`Error updating user with ID ${id}: ${error}`, error);
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to update user: ${error}`);
      }
    }
  
    async changePassword(
      id: string,
      email: string,
      currentPassword: string,
      newPassword: string,
      verificationCode: string,
    ): Promise<UserEntity> {
      if (!id || !email) {
        this.logger.error('Invalid input: ID or email missing');
        throw new BadRequestException('User ID and email are required');
      }
      try {
        this.logger.log(`Changing password for user with ID: ${id}`);
        const user = await this.findOne(id);
        if (!user) {
          this.logger.warn(`User with ID ${id} not found`);
          throw new NotFoundException(`User with ID ${id} not found`);
        }
  
        if (!user.password) {
          this.logger.error('User password not found');
          throw new BadRequestException('User password not found');
        }
  
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
          this.logger.warn('Invalid current password');
          throw new UnauthorizedException('Invalid current password');
        }
  
        await this.authService.verifyPasswordChangeCode(email, verificationCode);
  
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        const updatedUser = await this.prisma.user.update({
          where: { id },
          data: { password: hashedNewPassword },
        });
        this.logger.log(`Password changed for user with ID: ${id}`);
        return updatedUser;
      } catch (error) {
        this.logger.error(`Error changing password for user with ID ${id}: ${error}`, error);
        if (
          error instanceof NotFoundException ||
          error instanceof UnauthorizedException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to change password: ${error}`);
      }
    }
  
    async updateLocation(id: string, updateLocationDto: UpdateLocationDto): Promise<UserEntity> {
      if (!id) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Updating location for user with ID: ${id}`);
        const user = await this.findOne(id);
        if (!user) {
          this.logger.warn(`User with ID ${id} not found`);
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        const updatedUser = await this.prisma.user.update({
          where: { id },
          data: {
            locationName: updateLocationDto.name,
            latitude: updateLocationDto.latitude,
            longitude: updateLocationDto.longitude,
          },
        });
        this.logger.log(`Location updated for user with ID: ${id}`);
        return updatedUser;
      } catch (error) {
        this.logger.error(`Error updating location for user with ID ${id}: ${error}`, error);
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to update location: ${error}`);
      }
    }
  
    async updateAvatar(id: string, avatarPath: string): Promise<UserEntity> {
      if (!id) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Updating avatar for user with ID: ${id}`);
        const user = await this.findOne(id);
        if (!user) {
          this.logger.warn(`User with ID ${id} not found`);
          throw new NotFoundException(`User with ID ${id} not found`);
        }
  
        if (user.avatar && typeof user.avatar === 'string' && user.avatar !== 'undefined') {
          try {
            const filePath = join(process.cwd(), user.avatar);
            this.logger.log(`Attempting to delete old avatar at: ${filePath}`);
            await unlink(filePath);
            this.logger.log(`Deleted old avatar: ${user.avatar}`);
          } catch (err: any) {
            this.logger.error(`Failed to delete old avatar: ${err.message ?? err}`);
          }
        }
  
        const updatedUser = await this.prisma.user.update({
          where: { id },
          data: { avatar: avatarPath },
        });
        this.logger.log(`Avatar updated for user with ID: ${id}`);
        return updatedUser;
      } catch (error) {
        this.logger.error(`Error updating avatar for user with ID ${id}: ${error}`, error);
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to update avatar: ${error}`);
      }
    }
  
    async remove(id: string): Promise<void> {
      if (!id) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Removing user with ID: ${id}`);
        const user = await this.findOne(id);
        if (!user) {
          this.logger.warn(`User with ID ${id} not found`);
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        if (user.avatar && typeof user.avatar === 'string' && user.avatar !== 'undefined') {
          try {
            const filePath = join(process.cwd(), user.avatar);
            this.logger.log(`Attempting to delete avatar at: ${filePath}`);
            await unlink(filePath);
            this.logger.log(`Deleted avatar on user delete: ${user.avatar}`);
          } catch (err: any) {
            this.logger.error(`Failed to delete avatar on user delete: ${err.message ?? err}`);
          }
        }
        await this.prisma.user.delete({
          where: { id },
        });
        this.logger.log(`User with ID ${id} removed`);
      } catch (error) {
        this.logger.error(`Error removing user with ID ${id}: ${error}`, error);
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to remove user: ${error}`);
      }
    }
  
    async getUserProfile(userId: string, requesterId: string) {
      if (!userId || !requesterId) {
        this.logger.error('Invalid input: userId or requesterId missing');
        throw new BadRequestException('User ID and requester ID are required');
      }
      try {
        this.logger.log(`Fetching user profile for userId: ${userId}, requesterId: ${requesterId}`);
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            driverRides: true,
            passengerRides: true,
            reviewsReceived: {
              include: { author: { select: { id: true, name: true, avatar: true, rating: true } } },
            },
            friendsInitiated: { where: { friendId: requesterId } },
          },
        });
  
        if (!user) {
          this.logger.warn(`User with ID ${userId} not found`);
          throw new NotFoundException('User not found');
        }
  
        const trips = [
          ...user.driverRides.map((ride) => ({
            id: ride.id,
            date: ride.departureTime.toISOString().split('T')[0],
            route: `${ride.startLocation} - ${ride.endLocation}`,
            role: 'Driver',
          })),
          ...user.passengerRides.map((ride) => ({
            id: ride.id,
            date: ride.departureTime.toISOString().split('T')[0],
            route: `${ride.startLocation} - ${ride.endLocation}`,
            role: 'Passenger',
          })),
        ];
  
        this.logger.log(`User profile fetched for userId: ${userId}`);
        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            rating: user.rating ?? 0,
            trips,
            reviews: user.reviewsReceived.map((review) => ({
              id: review.id,
              author: {
                id: review.author.id,
                name: review.author.name,
                avatar: review.author.avatar,
                rating: review.author.rating ?? 0,
              },
              rating: review.rating,
              comment: review.comment,
              date: review.createdAt.toISOString().split('T')[0],
            })),
            isFriend: user.friendsInitiated.length > 0,
          },
        };
      } catch (error) {
        this.logger.error(`Error fetching user profile for userId ${userId}: ${error}`, error);
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch user profile: ${error}`);
      }
    }
  
    async createReview(userId: string, createReviewDto: CreateReviewDto, authorId: string) {
      if (!userId || !authorId) {
        this.logger.error('Invalid input: userId or authorId missing');
        throw new BadRequestException('User ID and author ID are required');
      }
      try {
        this.logger.log(`Creating review for userId: ${userId} by authorId: ${authorId}`);
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
  
        if (!user) {
          this.logger.warn(`User with ID ${userId} not found`);
          throw new NotFoundException('User not found');
        }
  
        const author = await this.prisma.user.findUnique({
          where: { id: authorId },
        });
  
        if (!author) {
          this.logger.warn(`Author with ID ${authorId} not found`);
          throw new NotFoundException('Author not found');
        }
  
        const sharedRideAsDriver = await this.prisma.ride.findFirst({
          where: {
            driverId: userId,
            passengerId: authorId,
            status: 'completed',
          },
        });
  
        const sharedRideAsPassenger = await this.prisma.ride.findFirst({
          where: {
            driverId: authorId,
            passengerId: userId,
            status: 'completed',
          },
        });
  
        if (!sharedRideAsDriver && !sharedRideAsPassenger) {
          this.logger.warn('No shared completed ride found for review');
          throw new BadRequestException('You can only leave a review for a user you have shared a completed ride with');
        }
  
        const existingReview = await this.prisma.review.findFirst({
          where: {
            userId,
            authorId,
          },
        });
  
        if (existingReview) {
          this.logger.warn('Review already exists for this user');
          throw new BadRequestException('You have already left a review for this user');
        }
  
        const review = await this.prisma.review.create({
          data: {
            userId,
            authorId,
            rating: createReviewDto.rating,
            comment: createReviewDto.comment,
          },
          include: { author: { select: { id: true, name: true, avatar: true, rating: true } } },
        });
  
        const reviews = await this.prisma.review.findMany({
          where: { userId },
        });
  
        const newRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        await this.prisma.user.update({
          where: { id: userId },
          data: { rating: newRating },
        });
  
        this.logger.log(`Review created for userId: ${userId}`);
        return {
          success: true,
          review: {
            id: review.id,
            author: {
              id: review.author.id,
              name: review.author.name,
              avatar: review.author.avatar,
              rating: review.author.rating ?? 0,
            },
            rating: review.rating,
            comment: review.comment,
            date: review.createdAt.toISOString().split('T')[0],
          },
        };
      } catch (error) {
        this.logger.error(`Error creating review for userId ${userId}: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to create review: ${error}`);
      }
    }
  
    async createFriendRequest(senderId: string, receiverId: string) {
      if (!senderId || !receiverId) {
        this.logger.error('Invalid input: senderId or receiverId missing');
        throw new BadRequestException('Sender ID and receiver ID are required');
      }
      this.logger.log(`Attempting to create friend request: senderId=${senderId}, receiverId=${receiverId}`);
  
      if (senderId === receiverId) {
        this.logger.warn('Sender and receiver are the same');
        throw new BadRequestException('Cannot send friend request to yourself');
      }
  
      try {
        this.logger.log('Checking for existing friend request');
        const existingRequest = await this.prisma.friendRequest.findFirst({
          where: {
            senderId,
            receiverId,
            status: 'pending',
          },
        });
  
        if (existingRequest) {
          this.logger.warn('Friend request already exists');
          throw new BadRequestException('Friend request already sent');
        }
  
        this.logger.log('Checking if users are already friends');
        const areFriends = await this.prisma.friend.findFirst({
          where: {
            OR: [
              { userId: senderId, friendId: receiverId },
              { userId: receiverId, friendId: senderId },
            ],
          },
        });
  
        if (areFriends) {
          this.logger.warn('Users are already friends');
          throw new BadRequestException('Users are already friends');
        }
  
        this.logger.log('Creating new friend request');
        const friendRequest = await this.prisma.friendRequest.create({
          data: {
            senderId,
            receiverId,
            status: 'pending',
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
            receiver: { select: { id: true, name: true, avatar: true } },
          },
        });
  
        // Create conversations for both users with category "Friends"
        const senderConversation = await this.conversationsService.create(
          {
            userId: receiverId, // Receiver as contact
          },
          senderId, // Sender as initiator
          'Friends',
        );
  
        const receiverConversation = await this.conversationsService.create(
          {
            userId: senderId, // Sender as contact
          },
          receiverId, // Receiver as initiator
          'Friends',
        );
  
        this.logger.log(
          `Friend request created: ${senderId} -> ${receiverId}, conversations: sender=${senderConversation.conversationId}, receiver=${receiverConversation.conversationId}`,
        );
        return { success: true, friendRequest };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to create friend request: ${errorMessage}`, errorStack);
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to create friend request: ${errorMessage}`);
      }
    }
  
    async getIncomingFriendRequests(userId: string) {
      if (!userId) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Fetching incoming friend requests for userId: ${userId}`);
        const requests = await this.prisma.friendRequest.findMany({
          where: {
            receiverId: userId,
            status: 'pending',
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
          },
        });
        this.logger.log(`Found ${requests.length} incoming friend requests for userId: ${userId}`);
        return { success: true, requests };
      } catch (error) {
        this.logger.error(`Error fetching incoming friend requests for userId ${userId}: ${error}`, error);
        throw new InternalServerErrorException(`Failed to fetch friend requests: ${error}`);
      }
    }
  
    async acceptFriendRequest(requestId: string, userId: string) {
      if (!requestId || !userId) {
        this.logger.error('Invalid input: requestId or userId missing');
        throw new BadRequestException('Request ID and user ID are required');
      }
      try {
        this.logger.log(`Accepting friend request with ID: ${requestId} for userId: ${userId}`);
        const friendRequest = await this.prisma.friendRequest.findUnique({
          where: { id: requestId },
        });
  
        if (!friendRequest) {
          this.logger.warn(`Friend request with ID ${requestId} not found`);
          throw new NotFoundException('Friend request not found');
        }
  
        if (friendRequest.receiverId !== userId) {
          this.logger.warn(`User ${userId} is not authorized to accept request ${requestId}`);
          throw new BadRequestException('You are not authorized to accept this request');
        }
  
        if (friendRequest.status !== 'pending') {
          this.logger.warn(`Friend request ${requestId} is not pending`);
          throw new BadRequestException('Friend request is not pending');
        }
  
        await this.prisma.$transaction([
          this.prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: 'accepted' },
          }),
          this.prisma.friend.create({
            data: {
              userId: friendRequest.senderId,
              friendId: friendRequest.receiverId,
            },
          }),
          this.prisma.friend.create({
            data: {
              userId: friendRequest.receiverId,
              friendId: friendRequest.senderId,
            },
          }),
        ]);
  
        this.logger.log(`Friend request accepted: ${requestId}`);
        return { success: true };
      } catch (error) {
        this.logger.error(`Error accepting friend request ${requestId}: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to accept friend request: ${error}`);
      }
    }
  
    async rejectFriendRequest(requestId: string, userId: string) {
      if (!requestId || !userId) {
        this.logger.error('Invalid input: requestId or userId missing');
        throw new BadRequestException('Request ID and user ID are required');
      }
      try {
        this.logger.log(`Rejecting friend request with ID: ${requestId} for userId: ${userId}`);
        const friendRequest = await this.prisma.friendRequest.findUnique({
          where: { id: requestId },
        });
  
        if (!friendRequest) {
          this.logger.warn(`Friend request with ID ${requestId} not found`);
          throw new NotFoundException('Friend request not found');
        }
  
        if (friendRequest.receiverId !== userId) {
          this.logger.warn(`User ${userId} is not authorized to reject request ${requestId}`);
          throw new BadRequestException('You are not authorized to reject this request');
        }
  
        if (friendRequest.status !== 'pending') {
          this.logger.warn(`Friend request ${requestId} is not pending`);
          throw new BadRequestException('Friend request is not pending');
        }
  
        await this.prisma.friendRequest.update({
          where: { id: requestId },
          data: { status: 'rejected' },
        });
  
        this.logger.log(`Friend request rejected: ${requestId}`);
        return { success: true };
      } catch (error) {
        this.logger.error(`Error rejecting friend request ${requestId}: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to reject friend request: ${error}`);
      }
    }
  
    async addFriend(userId: string, friendId: string) {
      if (!userId || !friendId) {
        this.logger.error('Invalid input: userId or friendId missing');
        throw new BadRequestException('User ID and friend ID are required');
      }
      try {
        this.logger.log(`Adding friend: userId=${userId}, friendId=${friendId}`);
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
  
        const friend = await this.prisma.user.findUnique({
          where: { id: friendId },
        });
  
        if (!user || !friend) {
          this.logger.warn('User or friend not found');
          throw new NotFoundException('User or friend not found');
        }
  
        if (userId === friendId) {
          this.logger.warn('Cannot add yourself as a friend');
          throw new BadRequestException('Cannot add yourself as a friend');
        }
  
        const existingFriendship = await this.prisma.friend.findFirst({
          where: {
            OR: [
              { userId, friendId },
              { userId: friendId, friendId: userId },
            ],
          },
        });
  
        if (existingFriendship) {
          this.logger.warn('Users are already friends');
          throw new BadRequestException('Users are already friends');
        }
  
        this.logger.warn('Use friend request system to add friends');
        throw new BadRequestException('Use friend request system to add friends');
      } catch (error) {
        this.logger.error(`Error adding friend for userId ${userId}: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to add friend: ${error}`);
      }
    }
  
    async removeFriend(userId: string, friendId: string) {
      if (!userId || !friendId) {
        this.logger.error('Invalid input: userId or friendId missing');
        throw new BadRequestException('User ID and friend ID are required');
      }
      this.logger.log(`Attempting to remove friend: userId=${userId}, friendId=${friendId}`);
  
      if (userId === friendId) {
        this.logger.warn('Cannot remove yourself as a friend');
        throw new BadRequestException('Cannot remove yourself as a friend');
      }
  
      try {
        const existingFriendship = await this.prisma.friend.findFirst({
          where: {
            OR: [
              { userId, friendId },
              { userId: friendId, friendId: userId },
            ],
          },
        });
  
        if (!existingFriendship) {
          this.logger.warn('Users are not friends');
          throw new NotFoundException('Users are not friends');
        }
  
        await this.prisma.$transaction([
          this.prisma.friend.deleteMany({
            where: {
              OR: [
                { userId, friendId },
                { userId: friendId, friendId: userId },
              ],
            },
          }),
        ]);
  
        this.logger.log(`Friendship removed: ${userId} <-> ${friendId}`);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to remove friend: ${errorMessage}`, errorStack);
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to remove friend: ${errorMessage}`);
      }
    }
  
    async getUserReviews(userId: string) {
      if (!userId) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Fetching reviews for userId: ${userId}`);
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            reviewsReceived: {
              include: { author: { select: { id: true, name: true, avatar: true, rating: true } } },
            },
          },
        });
  
        if (!user) {
          this.logger.warn(`User with ID ${userId} not found`);
          throw new NotFoundException('User not found');
        }
  
        this.logger.log(`Found ${user.reviewsReceived.length} reviews for userId: ${userId}`);
        return {
          success: true,
          reviews: user.reviewsReceived.map((review) => ({
            id: review.id,
            author: {
              id: review.author.id,
              name: review.author.name,
              avatar: review.author.avatar,
              rating: review.author.rating ?? 0,
            },
            rating: review.rating,
            comment: review.comment,
            date: review.createdAt.toISOString().split('T')[0],
          })),
        };
      } catch (error) {
        this.logger.error(`Error fetching reviews for userId ${userId}: ${error}`, error);
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to fetch reviews: ${error}`);
      }
    }
  
    async checkCanReview(userId: string, reviewerId: string) {
      if (!userId || !reviewerId) {
        this.logger.error('Invalid input: userId or reviewerId missing');
        throw new BadRequestException('User ID and reviewer ID are required');
      }
      try {
        this.logger.log(`Checking if reviewer ${reviewerId} can review user ${userId}`);
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
  
        if (!user) {
          this.logger.warn(`User with ID ${userId} not found`);
          throw new NotFoundException('User not found');
        }
  
        const reviewer = await this.prisma.user.findUnique({
          where: { id: reviewerId },
        });
  
        if (!reviewer) {
          this.logger.warn(`Reviewer with ID ${reviewerId} not found`);
          throw new NotFoundException('Reviewer not found');
        }
  
        const sharedRideAsDriver = await this.prisma.ride.findFirst({
          where: {
            driverId: userId,
            passengerId: reviewerId,
            status: 'completed',
          },
        });
  
        const sharedRideAsPassenger = await this.prisma.ride.findFirst({
          where: {
            driverId: reviewerId,
            passengerId: userId,
            status: 'completed',
          },
        });
  
        const hasSharedRide = !!(sharedRideAsDriver || sharedRideAsPassenger);
  
        const existingReview = await this.prisma.review.findFirst({
          where: {
            userId,
            authorId: reviewerId,
          },
        });
  
        this.logger.log(`Can review check for user ${userId} by reviewer ${reviewerId}: ${hasSharedRide && !existingReview}`);
        return {
          success: true,
          canReview: hasSharedRide && !existingReview,
        };
      } catch (error) {
        this.logger.error(`Error checking review eligibility for userId ${userId}: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to check review eligibility: ${error}`);
      }
    }
  
    async createBookingRequest(rideId: string, passengerId: string) {
      if (!rideId || !passengerId) {
        this.logger.error('Invalid input: rideId or passengerId missing');
        throw new BadRequestException('Ride ID and passenger ID are required');
      }
      try {
        this.logger.log(`Creating booking request for rideId: ${rideId}, passengerId: ${passengerId}`);
        const ride = await this.prisma.ride.findUnique({
          where: { id: rideId },
          include: { driver: true },
        });
  
        if (!ride) {
          this.logger.warn(`Ride with ID ${rideId} not found`);
          throw new NotFoundException('Ride not found');
        }
  
        const passenger = await this.prisma.user.findUnique({
          where: { id: passengerId },
          select: { id: true, name: true, avatar: true, rating: true },
        });
  
        if (!passenger) {
          this.logger.warn(`Passenger with ID ${passengerId} not found`);
          throw new NotFoundException('Passenger not found');
        }
  
        if (ride.status !== 'active') {
          this.logger.warn(`Ride ${rideId} is not available for booking`);
          throw new BadRequestException('Ride is not available for booking');
        }
  
        if (ride.availableSeats < 1) {
          this.logger.warn(`No available seats left for ride ${rideId}`);
          throw new BadRequestException('No available seats left');
        }
  
        const existingRequest = await this.prisma.bookingRequest.findFirst({
          where: {
            rideId,
            passengerId,
          },
        });
  
        if (existingRequest) {
          this.logger.warn(`Booking request already exists for ride ${rideId} and passenger ${passengerId}`);
          throw new BadRequestException('You have already sent a booking request for this ride');
        }
  
        const bookingRequest = await this.prisma.bookingRequest.create({
          data: {
            rideId,
            passengerId,
            status: 'pending',
          },
          include: {
            passenger: { select: { id: true, name: true, avatar: true, rating: true } },
          },
        });
  
        this.logger.log(`Booking request created for rideId: ${rideId}, passengerId: ${passengerId}`);
        return {
          success: true,
          bookingRequest: {
            id: bookingRequest.id,
            rideId: bookingRequest.rideId,
            passenger: {
              id: bookingRequest.passenger.id,
              name: bookingRequest.passenger.name,
              avatar: bookingRequest.passenger.avatar,
              rating: bookingRequest.passenger.rating ?? 0,
            },
            status: bookingRequest.status,
            createdAt: bookingRequest.createdAt.toISOString(),
          },
        };
      } catch (error) {
        this.logger.error(`Error creating booking request for rideId ${rideId}: ${error}`, error);
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to create booking request: ${error}`);
      }
    }
  
    async getBookingRequests(userId: string) {
      if (!userId) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Fetching booking requests for userId: ${userId}`);
        const driverRides = await this.prisma.ride.findMany({
          where: { driverId: userId },
          include: {
            bookingRequests: {
              include: {
                passenger: { select: { id: true, name: true, avatar: true, rating: true } },
              },
            },
          },
        });
  
        const passengerRequests = await this.prisma.bookingRequest.findMany({
          where: { passengerId: userId },
          include: {
            ride: {
              include: {
                driver: { select: { id: true, name: true, avatar: true, rating: true } },
              },
            },
            passenger: { select: { id: true, name: true, avatar: true, rating: true } },
          },
        });
  
        const formattedDriverRequests = driverRides.flatMap((ride) =>
          ride.bookingRequests.map((request) => ({
            id: request.id,
            rideId: ride.id,
            startLocation: ride.startLocation,
            endLocation: ride.endLocation,
            departureTime: ride.departureTime.toISOString(),
            availableSeats: ride.availableSeats,
            status: ride.status,
            passenger: {
              id: request.passenger.id,
              name: request.passenger.name,
              avatar: request.passenger.avatar,
              rating: request.passenger.rating ?? 0,
            },
            requestStatus: request.status,
            createdAt: request.createdAt.toISOString(),
          })),
        );
  
        const formattedPassengerRequests = passengerRequests.map((request) => ({
          id: request.id,
          rideId: request.rideId,
          startLocation: request.ride.startLocation,
          endLocation: request.ride.endLocation,
          departureTime: request.ride.departureTime.toISOString(),
          availableSeats: request.ride.availableSeats,
          status: request.ride.status,
          driver: {
            id: request.ride.driver.id,
            name: request.ride.driver.name,
            avatar: request.ride.driver.avatar,
            rating: request.ride.driver.rating ?? 0,
          },
          passenger: {
            id: request.passenger.id,
            name: request.passenger.name,
            avatar: request.passenger.avatar,
            rating: request.passenger.rating ?? 0,
          },
          requestStatus: request.status,
          createdAt: request.createdAt.toISOString(),
        }));
  
        const bookingRequests = [...formattedDriverRequests, ...formattedPassengerRequests];
        this.logger.log(`Found ${bookingRequests.length} booking requests for userId: ${userId}`);
        return {
          success: true,
          bookingRequests,
        };
      } catch (error) {
        this.logger.error(`Error fetching booking requests for userId ${userId}: ${error}`, error);
        throw new InternalServerErrorException(`Failed to fetch booking requests: ${error}`);
      }
    }
  
    async acceptBookingRequest(bookingRequestId: string, driverId: string) {
      if (!bookingRequestId || !driverId) {
        this.logger.error('Invalid input: bookingRequestId or driverId missing');
        throw new BadRequestException('Booking request ID and driver ID are required');
      }
      try {
        this.logger.log(`Accepting booking request ${bookingRequestId} by driver ${driverId}`);
        return await this.prisma.$transaction(async (prisma) => {
          const bookingRequest = await prisma.bookingRequest.findUnique({
            where: { id: bookingRequestId },
            include: { ride: { include: { driver: true } } },
          });
  
          if (!bookingRequest) {
            this.logger.warn(`Booking request ${bookingRequestId} not found`);
            throw new NotFoundException('Booking request not found');
          }
  
          if (bookingRequest.ride.driverId !== driverId) {
            this.logger.warn(`Driver ${driverId} not authorized for request ${bookingRequestId}`);
            throw new UnauthorizedException('You are not authorized to accept this booking request');
          }
  
          if (bookingRequest.status !== 'pending') {
            this.logger.warn(`Booking request ${bookingRequestId} is not pending`);
            throw new BadRequestException('Booking request is not in pending state');
          }
  
          if (bookingRequest.ride.availableSeats < 1) {
            this.logger.warn(`No available seats for ride ${bookingRequest.rideId}`);
            throw new BadRequestException('No available seats left');
          }
  
          await prisma.bookingRequest.update({
            where: { id: bookingRequestId },
            data: { status: 'accepted' },
          });
  
          const newAvailableSeats = bookingRequest.ride.availableSeats - 1;
          const newStatus = newAvailableSeats === 0 ? 'booked' : 'active';
  
          await prisma.ride.update({
            where: { id: bookingRequest.rideId },
            data: {
              availableSeats: newAvailableSeats,
              status: newStatus,
            },
          });
  
          if (newAvailableSeats === 0) {
            await prisma.bookingRequest.updateMany({
              where: {
                rideId: bookingRequest.rideId,
                status: 'pending',
              },
              data: { status: 'rejected' },
            });
          }
  
          // Create conversation between driver and passenger
          const driverPassengerConversation = await this.conversationsService.create(
            {
              rideId: bookingRequest.rideId,
              userId: bookingRequest.passengerId,
            },
            driverId,
            'Ride',
          );
  
          // Find all other passengers with accepted requests in this ride
          const otherPassengers = await prisma.bookingRequest.findMany({
            where: {
              rideId: bookingRequest.rideId,
              status: 'accepted',
              passengerId: { not: bookingRequest.passengerId },
            },
            select: {
              passengerId: true,
            },
          });
  
          // Create conversations between the new passenger and each other passenger
          for (const otherPassenger of otherPassengers) {
            // Conversation: new passenger -> other passenger
            await this.conversationsService.create(
              {
                rideId: bookingRequest.rideId,
                userId: otherPassenger.passengerId,
              },
              bookingRequest.passengerId,
              'RidePassenger',
            );
  
            // Conversation: other passenger -> new passenger
            await this.conversationsService.create(
              {
                rideId: bookingRequest.rideId,
                userId: bookingRequest.passengerId,
              },
              otherPassenger.passengerId,
              'RidePassenger',
            );
          }
  
          this.logger.log(
            `Created conversation: ${driverPassengerConversation.conversationId}, rideStatus=${newStatus}, availableSeats=${newAvailableSeats}`,
          );
  
          return { success: true };
        });
      } catch (error) {
        this.logger.error(`Error accepting booking request ${bookingRequestId}: ${error}`, error);
        if (
          error instanceof NotFoundException ||
          error instanceof UnauthorizedException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to accept booking request: ${error}`);
      }
    }
  
    async rejectBookingRequest(bookingRequestId: string, driverId: string) {
      if (!bookingRequestId || !driverId) {
        this.logger.error('Invalid input: bookingRequestId or driverId missing');
        throw new BadRequestException('Booking request ID and driver ID are required');
      }
      try {
        this.logger.log(`Rejecting booking request ${bookingRequestId} by driver ${driverId}`);
        const bookingRequest = await this.prisma.bookingRequest.findUnique({
          where: { id: bookingRequestId },
          include: { ride: true },
        });
  
        if (!bookingRequest) {
          this.logger.warn(`Booking request ${bookingRequestId} not found`);
          throw new NotFoundException('Booking request not found');
        }
  
        if (bookingRequest.ride.driverId !== driverId) {
          this.logger.warn(`Driver ${driverId} not authorized for request ${bookingRequestId}`);
          throw new UnauthorizedException('You are not authorized to reject this booking request');
        }
  
        if (bookingRequest.status !== 'pending') {
          this.logger.warn(`Booking request ${bookingRequestId} is not pending`);
          throw new BadRequestException('Booking request is not in pending state');
        }
  
        await this.prisma.bookingRequest.update({
          where: { id: bookingRequestId },
          data: { status: 'rejected' },
        });
  
        this.logger.log(`Booking request rejected: ${bookingRequestId}`);
        return { success: true };
      } catch (error) {
        this.logger.error(`Error rejecting booking request ${bookingRequestId}: ${error}`, error);
        if (
          error instanceof NotFoundException ||
          error instanceof UnauthorizedException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
        throw new InternalServerErrorException(`Failed to reject booking request: ${error}`);
      }
    }
  
    async confirmCashPayment(userId: string, confirmCashPaymentDto: ConfirmCashPaymentDto) {
      if (!userId || !confirmCashPaymentDto.paymentId) {
        this.logger.error('Invalid input: userId or paymentId missing');
        throw new BadRequestException('User ID and payment ID are required');
      }
      try {
        this.logger.log(`Driver ${userId} attempting to confirm cash payment ${confirmCashPaymentDto.paymentId}`);
        const result = await this.paymentsService.confirmCashPayment(userId, confirmCashPaymentDto);
        this.logger.log(`Cash payment confirmed for paymentId: ${confirmCashPaymentDto.paymentId}`);
        return result;
      } catch (error) {
        this.logger.error(`Error confirming cash payment for userId ${userId}: ${error}`, error);
        throw new InternalServerErrorException(`Failed to confirm cash payment: ${error}`);
      }
    }
  
    async getFriends(userId: string) {
      if (!userId) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Fetching friends for userId: ${userId}`);
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            friendsInitiated: {
              include: { friend: { select: { id: true, name: true, avatar: true } } },
            },
            friendsReceived: {
              include: { user: { select: { id: true, name: true, avatar: true } } },
            },
          },
        });
  
        if (!user) {
          this.logger.warn(`User with ID ${userId} not found`);
          throw new NotFoundException('User not found');
        }
  
        const friends = [
          ...user.friendsInitiated.map((f) => ({
            id: f.friend.id,
            name: f.friend.name,
            avatar: f.friend.avatar,
          })),
          ...user.friendsReceived.map((f) => ({
            id: f.user.id,
            name: f.user.name,
            avatar: f.user.avatar,
          })),
        ];
  
        this.logger.log(`Found ${friends.length} friends for userId: ${userId}`);
        return { success: true, friends };
      } catch (error) {
        this.logger.error(`Error fetching friends for userId ${userId}: ${error}`, error);
        throw new InternalServerErrorException(`Failed to fetch friends: ${error}`);
      }
    }
  
    async getFriendsList(userId: string) {
      if (!userId) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Fetching friends list for userId: ${userId}`);
        const conversations = await this.conversationsService.getConversationsByCategory(userId, 'Friends');
        const friends = conversations.map((conv) => ({
          id: conv.contact.id,
          name: conv.contact.name,
          avatar: conv.contact.avatar,
          conversationId: conv.id,
          lastMessage: conv.lastMessage
            ? {
                text: conv.lastMessage.text,
                timestamp: conv.lastMessage.timestamp,
              }
            : null,
          unreadMessages: conv.unreadMessages,
        }));
  
        const uniqueFriendsMap = new Map<string, typeof friends[0]>();
        friends.forEach((friend) => {
          if (!uniqueFriendsMap.has(friend.id)) {
            uniqueFriendsMap.set(friend.id, friend);
          }
        });
  
        const uniqueFriends = Array.from(uniqueFriendsMap.values());
        this.logger.log(`Found ${uniqueFriends.length} unique friends for userId: ${userId}`);
        return { success: true, friends: uniqueFriends };
      } catch (error) {
        this.logger.error(`Error fetching friends list for userId ${userId}: ${error}`, error);
        throw new InternalServerErrorException(`Failed to fetch friends list: ${error}`);
      }
    }
  
    async getPassengers(userId: string) {
      if (!userId) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Fetching passengers for userId: ${userId}`);
        const conversations = await this.conversationsService.getConversationsByCategory(userId, 'Ride');
  
        // Check if user is a driver
        const userIsDriver = conversations.some((conv) => conv.ride?.driverId === userId);
  
        if (userIsDriver) {
          // Return all passengers for the driver's rides
          const passengers = conversations
            .filter((conv) => conv.ride?.driverId === userId)
            .map((conv) => ({
              id: conv.contact.id,
              name: conv.contact.name,
              avatar: conv.contact.avatar,
              conversationId: conv.id,
              rideId: conv.rideId,
              lastMessage: conv.lastMessage
                ? {
                    text: conv.lastMessage.text,
                    timestamp: conv.lastMessage.timestamp,
                  }
                : null,
              unreadMessages: conv.unreadMessages,
            }));
  
          const uniquePassengersMap = new Map<string, typeof passengers[0]>();
          passengers.forEach((passenger) => {
            if (!uniquePassengersMap.has(passenger.id)) {
              uniquePassengersMap.set(passenger.id, passenger);
            }
          });
  
          const uniquePassengers = Array.from(uniquePassengersMap.values());
          this.logger.log(`Found ${uniquePassengers.length} passengers for userId: ${userId}`);
          return { success: true, passengers: uniquePassengers };
        } else {
          // Return other passengers in the same rides for a passenger
          const rideIds = conversations
            .filter((conv) => conv.rideId)
            .map((conv) => conv.rideId)
            .filter((rideId): rideId is string => rideId !== null);
  
          if (rideIds.length === 0) {
            this.logger.log(`No rides found for passenger ${userId}`);
            return { success: true, passengers: [] };
          }
  
          // Get all passengers in these rides, excluding the current user
          const bookingRequests = await this.prisma.bookingRequest.findMany({
            where: {
              rideId: { in: rideIds },
              status: 'accepted',
              passengerId: { not: userId },
            },
            include: {
              passenger: {
                select: { id: true, name: true, avatar: true },
              },
              ride: {
                include: {
                  driver: { select: { id: true } },
                },
              },
            },
          });
  
          const passengers = await Promise.all(
            bookingRequests.map(async (request) => {
              // Find conversation between current passenger and this passenger
              const conversation = await this.prisma.conversation.findFirst({
                where: {
                  rideId: request.rideId,
                  OR: [
                    { userId: userId, targetUserId: request.passengerId },
                    { userId: request.passengerId, targetUserId: userId },
                  ],
                  category: 'RidePassenger',
                },
                include: {
                  messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                  },
                },
              });
  
              const unreadMessages = conversation
                ? await this.prisma.message.count({
                    where: {
                      conversationId: conversation.id,
                      senderId: { not: userId },
                      read: false,
                    },
                  })
                : 0;
  
              return {
                id: request.passenger.id,
                name: request.passenger.name,
                avatar: request.passenger.avatar,
                conversationId: conversation?.id ?? null,
                rideId: request.rideId,
                lastMessage: conversation?.messages[0]
                  ? {
                      text: conversation.messages[0].content,
                      timestamp: conversation.messages[0].createdAt.toISOString(),
                    }
                  : null,
                unreadMessages,
              };
            }),
          );
  
          const uniquePassengersMap = new Map<string, typeof passengers[0]>();
          passengers.forEach((passenger) => {
            if (!uniquePassengersMap.has(passenger.id)) {
              uniquePassengersMap.set(passenger.id, passenger);
            }
          });
  
          const uniquePassengers = Array.from(uniquePassengersMap.values());
          this.logger.log(`Found ${uniquePassengers.length} passengers for userId: ${userId}`);
          return { success: true, passengers: uniquePassengers };
        }
      } catch (error) {
        this.logger.error(`Error fetching passengers for userId ${userId}: ${error}`, error);
        throw new InternalServerErrorException(`Failed to fetch passengers: ${error}`);
      }
    }
  
    async getDrivers(userId: string) {
      if (!userId) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(`Fetching drivers for userId: ${userId}`);
        const conversations = await this.conversationsService.getConversationsByCategory(userId, 'Ride');
  
        // Get rideIds for conversations with a rideId
        const rideIds = conversations
          .filter((conv) => conv.rideId)
          .map((conv) => conv.rideId)
          .filter((rideId): rideId is string => rideId !== null);
  
        if (rideIds.length === 0) {
          this.logger.log(`No rides found for user ${userId}`);
          return { success: true, drivers: [] };
        }
  
        // Check if user is a passenger with accepted booking requests
        const bookingRequests = await this.prisma.bookingRequest.findMany({
          where: {
            rideId: { in: rideIds },
            passengerId: userId,
            status: 'accepted',
          },
          include: {
            ride: {
              include: {
                driver: { select: { id: true, name: true, avatar: true } },
              },
            },
          },
        });
  
        const drivers = await Promise.all(
          bookingRequests.map(async (request) => {
            const conversation = conversations.find(
              (conv) =>
                conv.rideId === request.rideId &&
                conv.contact.id === request.ride.driver.id,
            );
  
            const unreadMessages = conversation
              ? await this.prisma.message.count({
                  where: {
                    conversationId: conversation.id,
                    senderId: { not: userId },
                    read: false,
                  },
                })
              : 0;
  
            return {
              id: request.ride.driver.id,
              name: request.ride.driver.name,
              avatar: request.ride.driver.avatar,
              conversationId: conversation?.id ?? null,
              rideId: request.rideId,
              lastMessage: conversation?.lastMessage
                ? {
                    text: conversation.lastMessage.text,
                    timestamp: conversation.lastMessage.timestamp,
                  }
                : null,
              unreadMessages,
            };
          }),
        );
  
        const uniqueDriversMap = new Map<string, typeof drivers[0]>();
        drivers.forEach((driver) => {
          if (!uniqueDriversMap.has(driver.id)) {
            uniqueDriversMap.set(driver.id, driver);
          }
        });
  
        const uniqueDrivers = Array.from(uniqueDriversMap.values());
        this.logger.log(`Found ${uniqueDrivers.length} drivers for userId: ${userId}`);
        return { success: true, drivers: uniqueDrivers };
      } catch (error) {
        this.logger.error(`Error fetching drivers for userId ${userId}: ${error}`, error);
        throw new InternalServerErrorException(`Failed to fetch drivers: ${error}`);
      }
    }
  
    async searchUsers(
      query: string,
      currentUserId: string,
      category?: string,
      limit: number = 10,
      offset: number = 0,
    ) {
      if (!currentUserId) {
        this.logger.error('Invalid user ID provided: undefined or null');
        throw new BadRequestException('User ID is required');
      }
      try {
        this.logger.log(
          `Searching users with query: ${query}, currentUserId: ${currentUserId}, category: ${category}, limit: ${limit}, offset: ${offset}`,
        );
  
        const currentUser = await this.findOne(currentUserId);
        if (!currentUser) {
          this.logger.warn(`Current user with ID ${currentUserId} not found`);
          throw new NotFoundException('Current user not found');
        }
  
        if (!query || query.trim() === '') {
          this.logger.log('Query is empty, returning empty list');
          return { success: true, users: [], total: 0 };
        }
  
        const users = await this.prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
            id: { not: currentUserId },
          },
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            rating: true,
          },
          take: limit,
          skip: offset,
        });
  
        const total = await this.prisma.user.count({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
            id: { not: currentUserId },
          },
        });
  
        const usersWithDetails = await Promise.all(
          users.map(async (user) => {
            const sharedRideAsDriver = await this.prisma.ride.findFirst({
              where: {
                driverId: user.id,
                passengerId: currentUserId,
              },
            });
  
            const sharedRideAsPassenger = await this.prisma.ride.findFirst({
              where: {
                driverId: currentUserId,
                passengerId: user.id,
              },
            });
  
            const areFriends = await this.prisma.friend.findFirst({
              where: {
                OR: [
                  { userId: currentUserId, friendId: user.id },
                  { userId: user.id, friendId: currentUserId },
                ],
              },
            });
  
            const conversation = await this.prisma.conversation.findFirst({
              where: {
                OR: [
                  { userId: user.id, ride: { driverId: currentUserId } },
                  { userId: currentUserId, ride: { driverId: user.id } },
                ],
              },
            });
  
            let userCategory = 'Others';
            if (areFriends) {
              userCategory = 'Friends';
            } else if (sharedRideAsDriver) {
              userCategory = 'Drivers';
            } else if (sharedRideAsPassenger) {
              userCategory = 'Passengers';
            }
  
            if (category && userCategory !== category && userCategory !== 'Others') {
              return null;
            }
  
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
              rating: user.rating ?? 0,
              category: userCategory,
              conversationId: conversation?.id ?? null,
              rideId: sharedRideAsDriver?.id ?? sharedRideAsPassenger?.id ?? null,
            };
          }),
        );
  
        const filteredUsers = usersWithDetails.filter((user) => user !== null);
        this.logger.log(`Found ${filteredUsers.length} users for search query`);
        return { success: true, users: filteredUsers, total };
      } catch (error) {
        this.logger.error(`Error searching users for userId ${currentUserId}: ${error}`, error);
        throw new InternalServerErrorException(`Failed to search users: ${error}`);
      }
    }
  }