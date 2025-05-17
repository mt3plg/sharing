import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
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

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);
    constructor(
        private readonly prisma: PrismaService,
        private readonly authService: AuthService,
        private readonly conversationsService: ConversationsService,
    ) {}

    async create(createUserDto: CreateUserDto): Promise<UserEntity> {
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        return this.prisma.user.create({
            data: {
                ...createUserDto,
                password: hashedPassword,
                status: 'pending',
                verificationToken: createUserDto.verificationToken ?? null,
            },
        });
    }

    async findOne(id: string): Promise<UserEntity | null> {
        console.log('Finding user with ID:', id);
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
            },
        });
        if (!user) {
            console.log(`User with ID ${id} not found`);
            return null;
        }
        console.log('Found user:', user);
        return user;
    }

    async findMany(query: any): Promise<any> {
        return this.prisma.user.findMany(query);
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        return this.prisma.user.findUnique({
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
            },
        });
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<UserEntity> {
        const user = await this.findOne(id);
        if (!user) {
            throw new NotFoundException(`Користувача з ID ${id} не знайдено`);
        }
        const updateData: any = { ...updateUserDto };
        if (updateUserDto.password) {
            updateData.password = await bcrypt.hash(updateUserDto.password, 10);
        }
        return this.prisma.user.update({
            where: { id },
            data: updateData,
        });
    }

    async changePassword(id: string, email: string, currentPassword: string, newPassword: string, verificationCode: string): Promise<UserEntity> {
        const user = await this.findOne(id);
        if (!user) {
            throw new NotFoundException(`Користувача з ID ${id} не знайдено`);
        }

        if (!user.password) {
            throw new BadRequestException('Пароль користувача не знайдено');
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Невірний старий пароль');
        }

        await this.authService.verifyPasswordChangeCode(email, verificationCode);

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        return this.prisma.user.update({
            where: { id },
            data: { password: hashedNewPassword },
        });
    }

    async updateLocation(id: string, updateLocationDto: UpdateLocationDto): Promise<UserEntity> {
        const user = await this.findOne(id);
        if (!user) {
            throw new NotFoundException(`Користувача з ID ${id} не знайдено`);
        }
        return this.prisma.user.update({
            where: { id },
            data: {
                locationName: updateLocationDto.name,
                latitude: updateLocationDto.latitude,
                longitude: updateLocationDto.longitude,
            },
        });
    }

    async updateAvatar(id: string, avatarPath: string): Promise<UserEntity> {
        const user = await this.findOne(id);
        if (!user) {
            throw new NotFoundException(`Користувача з ID ${id} не знайдено`);
        }

        if (user.avatar && typeof user.avatar === 'string' && user.avatar !== 'undefined') {
            try {
                const filePath = join(process.cwd(), user.avatar);
                console.log('Attempting to delete old avatar at:', filePath);
                await unlink(filePath);
                console.log(`Deleted old avatar: ${user.avatar}`);
            } catch (err: any) {
                console.error(`Failed to delete old avatar: ${err.message ?? err}`);
            }
        }

        return this.prisma.user.update({
            where: { id },
            data: { avatar: avatarPath },
        });
    }

    async remove(id: string): Promise<void> {
        const user = await this.findOne(id);
        if (!user) {
            throw new NotFoundException(`Користувача з ID ${id} не знайдено`);
        }
        if (user.avatar && typeof user.avatar === 'string' && user.avatar !== 'undefined') {
            try {
                const filePath = join(process.cwd(), user.avatar);
                console.log('Attempting to delete avatar at:', filePath);
                await unlink(filePath);
                console.log(`Deleted avatar on user delete: ${user.avatar}`);
            } catch (err: any) {
                console.error(`Failed to delete avatar on user delete: ${err.message ?? err}`);
            }
        }
        await this.prisma.user.delete({
            where: { id },
        });
    }

    async getUserProfile(userId: string, requesterId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                driverRides: true,
                passengerRides: true,
                reviewsReceived: { include: { author: { select: { id: true, name: true, avatar: true, rating: true } } } },
                friendsInitiated: { where: { friendId: requesterId } },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const trips = [
            ...user.driverRides.map(ride => ({
                id: ride.id,
                date: ride.departureTime.toISOString().split('T')[0],
                route: `${ride.startLocation} - ${ride.endLocation}`,
                role: 'Driver',
            })),
            ...user.passengerRides.map(ride => ({
                id: ride.id,
                date: ride.departureTime.toISOString().split('T')[0],
                route: `${ride.startLocation} - ${ride.endLocation}`,
                role: 'Passenger',
            })),
        ];

        return {
            success: true,
            user: {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                rating: user.rating ?? 0,
                trips,
                reviews: user.reviewsReceived.map(review => ({
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
    }

    async createReview(userId: string, createReviewDto: CreateReviewDto, authorId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const author = await this.prisma.user.findUnique({
            where: { id: authorId },
        });

        if (!author) {
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
            throw new BadRequestException('You can only leave a review for a user you have shared a completed ride with');
        }

        const existingReview = await this.prisma.review.findFirst({
            where: {
                userId,
                authorId,
            },
        });

        if (existingReview) {
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
    }

    async createFriendRequest(senderId: string, receiverId: string) {
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

            this.logger.log(`Friend request created: ${senderId} -> ${receiverId}`);
            return { success: true, friendRequest };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Failed to create friend request: ${errorMessage}`, errorStack);
            throw new BadRequestException(`Failed to create friend request: ${errorMessage}`);
        }
    }

    async getIncomingFriendRequests(userId: string) {
        const requests = await this.prisma.friendRequest.findMany({
            where: {
                receiverId: userId,
                status: 'pending',
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true } },
            },
        });

        return { success: true, requests };
    }

    async acceptFriendRequest(requestId: string, userId: string) {
        const friendRequest = await this.prisma.friendRequest.findUnique({
            where: { id: requestId },
        });

        if (!friendRequest) {
            throw new NotFoundException('Friend request not found');
        }

        if (friendRequest.receiverId !== userId) {
            throw new BadRequestException('You are not authorized to accept this request');
        }

        if (friendRequest.status !== 'pending') {
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
    }

    async rejectFriendRequest(requestId: string, userId: string) {
        const friendRequest = await this.prisma.friendRequest.findUnique({
            where: { id: requestId },
        });

        if (!friendRequest) {
            throw new NotFoundException('Friend request not found');
        }

        if (friendRequest.receiverId !== userId) {
            throw new BadRequestException('You are not authorized to reject this request');
        }

        if (friendRequest.status !== 'pending') {
            throw new BadRequestException('Friend request is not pending');
        }

        await this.prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: 'rejected' },
        });

        this.logger.log(`Friend request rejected: ${requestId}`);
        return { success: true };
    }

    async addFriend(userId: string, friendId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        const friend = await this.prisma.user.findUnique({
            where: { id: friendId },
        });

        if (!user || !friend) {
            throw new NotFoundException('User or friend not found');
        }

        if (userId === friendId) {
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
            throw new BadRequestException('Users are already friends');
        }

        throw new BadRequestException('Use friend request system to add friends');
    }

    async removeFriend(userId: string, friendId: string) {
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
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Failed to remove friend: ${errorMessage}`, errorStack);
            throw new BadRequestException(`Failed to remove friend: ${errorMessage}`);
        }
    }

    async getUserReviews(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                reviewsReceived: { include: { author: { select: { id: true, name: true, avatar: true, rating: true } } } },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return {
            success: true,
            reviews: user.reviewsReceived.map(review => ({
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
    }

    async checkCanReview(userId: string, reviewerId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const reviewer = await this.prisma.user.findUnique({
            where: { id: reviewerId },
        });

        if (!reviewer) {
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

        return {
            success: true,
            canReview: hasSharedRide && !existingReview,
        };
    }

    async createBookingRequest(rideId: string, passengerId: string) {
        const ride = await this.prisma.ride.findUnique({
            where: { id: rideId },
            include: { driver: true },
        });

        if (!ride) {
            throw new NotFoundException('Ride not found');
        }

        const passenger = await this.prisma.user.findUnique({
            where: { id: passengerId },
            select: { id: true, name: true, avatar: true, rating: true },
        });

        if (!passenger) {
            throw new NotFoundException('Passenger not found');
        }

        if (ride.status !== 'active') {
            throw new BadRequestException('Ride is not available for booking');
        }

        if (ride.availableSeats < 1) {
            throw new BadRequestException('No available seats left');
        }

        const existingRequest = await this.prisma.bookingRequest.findFirst({
            where: {
                rideId,
                passengerId,
            },
        });

        if (existingRequest) {
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
    }

    async getBookingRequests(userId: string) {
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

        const formattedDriverRequests = driverRides.flatMap(ride =>
            ride.bookingRequests.map(request => ({
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
            }))
        );

        const formattedPassengerRequests = passengerRequests.map(request => ({
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

        return {
            success: true,
            bookingRequests,
        };
    }

    async acceptBookingRequest(bookingRequestId: string, driverId: string) {
        const bookingRequest = await this.prisma.bookingRequest.findUnique({
            where: { id: bookingRequestId },
            include: { ride: true },
        });

        if (!bookingRequest) {
            throw new NotFoundException('Booking request not found');
        }

        if (bookingRequest.ride.driverId !== driverId) {
            throw new UnauthorizedException('You are not authorized to accept this booking request');
        }

        if (bookingRequest.status !== 'pending') {
            throw new BadRequestException('Booking request is not in pending state');
        }

        if (bookingRequest.ride.availableSeats < 1) {
            throw new BadRequestException('No available seats left');
        }

        await this.prisma.bookingRequest.update({
            where: { id: bookingRequestId },
            data: { status: 'accepted' },
        });

        const newAvailableSeats = bookingRequest.ride.availableSeats - 1;

        const newStatus = newAvailableSeats === 0 ? 'booked' : 'active';

        await this.prisma.ride.update({
            where: { id: bookingRequest.rideId },
            data: {
                availableSeats: newAvailableSeats,
                passengerId: bookingRequest.passengerId,
                status: newStatus,
            },
        });

        if (newAvailableSeats === 0) {
            await this.prisma.bookingRequest.updateMany({
                where: {
                    rideId: bookingRequest.rideId,
                    status: 'pending',
                },
                data: { status: 'rejected' },
            });
        }

        // Create conversation for passenger with driver
        const passengerConversation = await this.conversationsService.create(
            {
                rideId: bookingRequest.rideId,
                userId: driverId, // Driver as the contact for passenger
            },
            bookingRequest.passengerId // Passenger initiates the conversation
        );

        // Create conversation for driver with passenger
        const driverConversation = await this.conversationsService.create(
            {
                rideId: bookingRequest.rideId,
                userId: bookingRequest.passengerId, // Passenger as the contact for driver
            },
            driverId // Driver initiates the conversation
        );

        this.logger.log(`Created conversations: passenger=${passengerConversation.conversationId}, driver=${driverConversation.conversationId}, rideStatus=${newStatus}, availableSeats=${newAvailableSeats}`);

        return { success: true };
    }

    async rejectBookingRequest(bookingRequestId: string, driverId: string) {
        const bookingRequest = await this.prisma.bookingRequest.findUnique({
            where: { id: bookingRequestId },
            include: { ride: true },
        });

        if (!bookingRequest) {
            throw new NotFoundException('Booking request not found');
        }

        if (bookingRequest.ride.driverId !== driverId) {
            throw new UnauthorizedException('You are not authorized to reject this booking request');
        }

        if (bookingRequest.status !== 'pending') {
            throw new BadRequestException('Booking request is not in pending state');
        }

        await this.prisma.bookingRequest.update({
            where: { id: bookingRequestId },
            data: { status: 'rejected' },
        });

        return { success: true };
    }

    async searchUsers(query: string, currentUserId: string, category?: string, limit: number = 10, offset: number = 0) {
        console.log(`Searching users with query: ${query}, currentUserId: ${currentUserId}, category: ${category}, limit: ${limit}, offset: ${offset}`);

        const currentUser = await this.findOne(currentUserId);
        if (!currentUser) {
            throw new NotFoundException('Current user not found');
        }

        if (!query || query.trim() === '') {
            console.log('Query is empty, returning empty list');
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

        const filteredUsers = usersWithDetails.filter(user => user !== null);

        console.log('Search results:', filteredUsers);
        return { success: true, users: filteredUsers, total };
    }

    async getFriends(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                friendsInitiated: { include: { friend: { select: { id: true, name: true, avatar: true } } } },
                friendsReceived: { include: { user: { select: { id: true, name: true, avatar: true } } } },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const friends = [
            ...user.friendsInitiated.map(f => ({
                id: f.friend.id,
                name: f.friend.name,
                avatar: f.friend.avatar,
            })),
            ...user.friendsReceived.map(f => ({
                id: f.user.id,
                name: f.user.name,
                avatar: f.user.avatar,
            })),
        ];

        return { success: true, friends };
    }

    async getFriendsList(userId: string) {
        this.logger.log(`Fetching friends list for userId: ${userId}`);
        const conversations = await this.conversationsService.getConversationsByCategory(userId, 'Friends');
        const friends = conversations.map(conv => ({
            id: conv.contact.id,
            name: conv.contact.name,
            avatar: conv.contact.avatar,
            conversationId: conv.id,
            lastMessage: conv.lastMessage ? {
                text: conv.lastMessage.text,
                timestamp: conv.lastMessage.timestamp,
            } : null,
            unreadMessages: conv.unreadMessages,
        }));

        // Унікалізуємо друзів за id
        const uniqueFriendsMap = new Map<string, typeof friends[0]>();
        friends.forEach(friend => {
            if (!uniqueFriendsMap.has(friend.id)) {
                uniqueFriendsMap.set(friend.id, friend);
            }
        });

        const uniqueFriends = Array.from(uniqueFriendsMap.values());
        this.logger.log(`Friends list for user ${userId}:`, uniqueFriends);
        return { success: true, friends: uniqueFriends };
    }

    async getPassengers(userId: string) {
        this.logger.log(`Fetching passengers for userId: ${userId}`);
        const conversations = await this.conversationsService.getConversationsByCategory(userId, 'Passengers');
        const passengers = conversations.map(conv => ({
            id: conv.contact.id,
            name: conv.contact.name,
            avatar: conv.contact.avatar,
            conversationId: conv.id,
            rideId: conv.rideId,
            lastMessage: conv.lastMessage ? {
                text: conv.lastMessage.text,
                timestamp: conv.lastMessage.timestamp,
            } : null,
            unreadMessages: conv.unreadMessages,
        }));

        // Унікалізуємо пасажирів за id
        const uniquePassengersMap = new Map<string, typeof passengers[0]>();
        passengers.forEach(passenger => {
            if (!uniquePassengersMap.has(passenger.id)) {
                uniquePassengersMap.set(passenger.id, passenger);
            }
        });

        const uniquePassengers = Array.from(uniquePassengersMap.values());
        this.logger.log(`Passengers for user ${userId}:`, uniquePassengers);
        return { success: true, passengers: uniquePassengers };
    }

    async getDrivers(userId: string) {
        this.logger.log(`Fetching drivers for userId: ${userId}`);
        const conversations = await this.conversationsService.getConversationsByCategory(userId, 'Drivers');
        const drivers = conversations.map(conv => ({
            id: conv.contact.id,
            name: conv.contact.name,
            avatar: conv.contact.avatar,
            conversationId: conv.id,
            rideId: conv.rideId,
            lastMessage: conv.lastMessage ? {
                text: conv.lastMessage.text,
                timestamp: conv.lastMessage.timestamp,
            } : null,
            unreadMessages: conv.unreadMessages,
        }));

        // Унікалізуємо водіїв за id
        const uniqueDriversMap = new Map<string, typeof drivers[0]>();
        drivers.forEach(driver => {
            if (!uniqueDriversMap.has(driver.id)) {
                uniqueDriversMap.set(driver.id, driver);
            }
        });

        const uniqueDrivers = Array.from(uniqueDriversMap.values());
        this.logger.log(`Drivers for user ${userId}:`, uniqueDrivers);
        return { success: true, drivers: uniqueDrivers };
    }
}