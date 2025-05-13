import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class UsersService {
    logger: any;
    constructor(
        private readonly prisma: PrismaService,
        private readonly authService: AuthService,
    ) {}

    async create(createUserDto: CreateUserDto): Promise<UserEntity> {
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        return this.prisma.user.create({
            data: {
                ...createUserDto,
                password: hashedPassword,
                status: 'pending',
                verificationToken: createUserDto.verificationToken || null,
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
                console.error(`Failed to delete old avatar: ${err.message || err}`);
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
                console.error(`Failed to delete avatar on user delete: ${err.message || err}`);
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
                rating: user.rating || 0,
                trips,
                reviews: user.reviewsReceived.map(review => ({
                    id: review.id,
                    author: {
                        id: review.author.id,
                        name: review.author.name,
                        avatar: review.author.avatar,
                        rating: review.author.rating || 0,
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
                    rating: review.author.rating || 0,
                },
                rating: review.rating,
                comment: review.comment,
                date: review.createdAt.toISOString().split('T')[0],
            },
        };
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

        const existingFriendship = await this.prisma.friend.findFirst({
            where: { userId, friendId },
        });

        if (existingFriendship) {
            throw new BadRequestException('Users are already friends');
        }

        await this.prisma.friend.create({
            data: {
                userId,
                friendId,
            },
        });

        return { success: true };
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
                    rating: review.author.rating || 0,
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
                    rating: bookingRequest.passenger.rating || 0,
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
                    rating: request.passenger.rating || 0,
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
                rating: request.ride.driver.rating || 0,
            },
            passenger: {
                id: request.passenger.id,
                name: request.passenger.name,
                avatar: request.passenger.avatar,
                rating: request.passenger.rating || 0,
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
    
        // Оновлюємо статус запиту на бронювання
        await this.prisma.bookingRequest.update({
            where: { id: bookingRequestId },
            data: { status: 'accepted' },
        });
    
        // Оновлюємо поїздку
        const updatedRide = await this.prisma.ride.update({
            where: { id: bookingRequest.rideId },
            data: {
                availableSeats: { decrement: 1 },
                passengerId: bookingRequest.passengerId,
                status: 'booked',
            },
        });
    
        // Відхиляємо інші запити, якщо немає місць
        if (updatedRide.availableSeats === 0) {
            await this.prisma.bookingRequest.updateMany({
                where: {
                    rideId: bookingRequest.rideId,
                    status: 'pending',
                },
                data: { status: 'rejected' },
            });
        }
    
        // Створюємо бесіду для пасажира (категорія "Drivers")
        const passengerConversation = await this.prisma.conversation.create({
            data: {
                id: `conv-${bookingRequestId}-passenger`,
                userId: bookingRequest.passengerId,
                rideId: bookingRequest.rideId,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    
        // Створюємо бесіду для водія (категорія "Passengers")
        const driverConversation = await this.prisma.conversation.create({
            data: {
                id: `conv-${bookingRequestId}-driver`,
                userId: driverId,
                rideId: bookingRequest.rideId,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    
        this.logger.log(`Created conversations: passenger=${passengerConversation.id}, driver=${driverConversation.id}`);
    
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
                    rating: user.rating || 0,
                    category: userCategory,
                    conversationId: conversation?.id || null,
                    rideId: sharedRideAsDriver?.id || sharedRideAsPassenger?.id || null,
                };
            }),
        );

        const filteredUsers = usersWithDetails.filter(user => user !== null);

        console.log('Search results:', filteredUsers);
        return { success: true, users: filteredUsers, total };
    }

    // users.service.ts
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
}