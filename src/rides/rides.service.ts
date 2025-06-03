import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRideDto, SearchRideDto, BookRideDto } from './interfaces/interfaces_ride.interface';
import { EmailService } from '../email/email.service';
import { Client, DistanceMatrixRequest, TravelMode } from '@googlemaps/google-maps-services-js';
import { PaymentsService } from '../payments/payments.service';

export interface FilteredRide {
  id: string;
  driverId: string;
  driver: {
    id: string;
    name: string;
    avatar: string | null;
    rating: number | null;
  };
  passengerId: string | null;
  startLocation: string;
  startCoordsLat: number | null;
  startCoordsLng: number | null;
  endLocation: string;
  endCoordsLat: number | null;
  endCoordsLng: number | null;
  departureTime: Date;
  availableSeats: number;
  vehicleType: string | null;
  status: string;
  fare: number | null;
  distance: number | null;
  duration: number | null;
  paymentType: string | null;
  selectedCardId: string | null;
  createdAt: Date;
  updatedAt: Date;
  startDistance: number;
  endDistance: number;
  totalDistance: number;
}

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);
  private readonly googleMapsClient = new Client({});

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly paymentsService: PaymentsService,
  ) { }

  private async calculateDistanceAndDuration(startLocation: string, endLocation: string) {
    try {
      const request: DistanceMatrixRequest = {
        params: {
          origins: [startLocation],
          destinations: [endLocation],
          key: process.env.GOOGLE_MAPS_API_KEY!,
          mode: TravelMode.driving,
        },
      };

      const response = await this.googleMapsClient.distancematrix(request);
      const element = response.data.rows[0]?.elements[0];

      if (!element || element.status !== 'OK') {
        throw new Error('Failed to calculate distance or duration');
      }

      const distance = element.distance.value / 1000;
      const duration = Math.round(element.duration.value / 60);

      return { distance, duration };
    } catch (error) {
      this.logger.error(`Failed to calculate distance/duration: ${error}`);
      throw new BadRequestException('Failed to calculate distance or duration');
    }
  }

  private calculateFare(distance: number, duration: number): number {
    const ratePerKm = parseFloat(process.env.RATE_PER_KM || '0.50');
    const ratePerMinute = parseFloat(process.env.RATE_PER_MINUTE || '0.10');
    const fare = distance * ratePerKm + duration * ratePerMinute;
    return Math.round(fare * 100) / 100;
  }

  private async geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK') {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
      } else {
        throw new Error(`Geocoding failed for address: ${address}`);
      }
    } catch (error) {
      this.logger.error(`Geocoding error: ${error}`);
      throw new BadRequestException(`Failed to geocode address: ${address}`);
    }
  }

  private haversineDistance(coords1: { lat: number; lng: number }, coords2: { lat: number; lng: number }): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async notifyPassengers(rideId: string, message: string) {
    const bookingRequests = await this.prisma.bookingRequest.findMany({
      where: { rideId, status: 'accepted' },
      include: { passenger: { select: { email: true, name: true } } },
    });

    for (const request of bookingRequests) {
      try {
        await this.emailService.sendVerificationEmail(
          request.passenger.email,
          `Ride Update: ${message}`,
        );
        this.logger.log(`Notified passenger ${request.passenger.email}: ${message}`);
      } catch (error) {
        this.logger.error(`Failed to notify passenger ${request.passenger.email}: ${error}`);
      }
    }
  }

  async create(createRideDto: CreateRideDto, driverId: string) {
    const { startLocation, endLocation, departureTime, availableSeats, vehicleType, paymentType = 'both', selectedCard } = createRideDto;

    const driver = await this.prisma.user.findUnique({ where: { id: driverId } });
    if (!driver || driver.status !== 'active') {
      throw new BadRequestException('Invalid or inactive driver');
    }

    const now = new Date();
    const departure = new Date(departureTime);
    if (departure <= now) {
      throw new BadRequestException('Departure time must be in the future');
    }

    if (paymentType === 'card' && !selectedCard?.id) {
      throw new BadRequestException('Selected card is required for card payment type');
    }

    if (selectedCard?.id) {
      const card = await this.prisma.paymentMethod.findUnique({ where: { id: selectedCard.id } });
      if (!card || card.userId !== driverId) {
        throw new BadRequestException('Invalid or unauthorized payment method');
      }
    }

    const startCoords = await this.geocodeAddress(startLocation);
    const endCoords = await this.geocodeAddress(endLocation);

    const { distance, duration } = await this.calculateDistanceAndDuration(startLocation, endLocation);
    const fare = this.calculateFare(distance, duration);

    const ride = await this.prisma.ride.create({
      data: {
        driverId,
        startLocation,
        startCoordsLat: startCoords.lat,
        startCoordsLng: startCoords.lng,
        endLocation,
        endCoordsLat: endCoords.lat,
        endCoordsLng: endCoords.lng,
        departureTime: departure,
        availableSeats,
        vehicleType: vehicleType || 'Unknown',
        fare,
        distance,
        duration,
        paymentType,
        selectedCardId: paymentType === 'card' || paymentType === 'both' ? selectedCard?.id : null,
      },
      include: {
        driver: { select: { id: true, name: true, avatar: true, rating: true } },
        selectedCard: { select: { id: true, brand: true, last4: true } },
      },
    });

    this.logger.log(`Ride created: ${ride.id}, fare: ${fare}, distance: ${distance}km, duration: ${duration}min`);
    return { success: true, ride };
  }

  async findAll(userId: string) {
    const createdRides = await this.prisma.ride.findMany({
      where: { driverId: userId },
      include: {
        driver: { select: { id: true, name: true, avatar: true, rating: true } },
        bookingRequests: {
          include: {
            passenger: { select: { id: true, name: true, avatar: true, rating: true } },
          },
        },
        payments: true,
        selectedCard: { select: { id: true, brand: true, last4: true } },
      },
    });

    const bookedRides = await this.prisma.ride.findMany({
      where: {
        bookingRequests: {
          some: {
            passengerId: userId,
            status: { in: ['accepted', 'confirmed'] },
          },
        },
      },
      include: {
        driver: { select: { id: true, name: true, avatar: true, rating: true } },
        bookingRequests: {
          include: {
            passenger: { select: { id: true, name: true, avatar: true, rating: true } },
          },
        },
        payments: true,
        selectedCard: { select: { id: true, brand: true, last4: true } },
      },
    });

    const rides = [...createdRides, ...bookedRides].filter(
      (ride, index, self) => index === self.findIndex(r => r.id === ride.id)
    );

    return { success: true, rides };
  }

  async search(searchRideDto: SearchRideDto) {
    this.logger.log(`Search parameters: ${JSON.stringify(searchRideDto, null, 2)}`);

    const { startLocation, endLocation, departureTime, passengers, dateRange = 2, maxDistance = 10, startCoords, endCoords, limit = 10, offset = 0 } = searchRideDto;

    const userStartCoords = startCoords || (await this.geocodeAddress(startLocation));
    const userEndCoords = endCoords || (await this.geocodeAddress(endLocation));

    const departureDate = new Date(departureTime);
    departureDate.setHours(0, 0, 0, 0);
    const minDate = new Date(departureDate);
    minDate.setDate(departureDate.getDate() - dateRange);
    const maxDate = new Date(departureDate);
    maxDate.setDate(departureDate.getDate() + dateRange + 1);

    this.logger.log(`Date range: minDate=${minDate.toISOString()}, maxDate=${maxDate.toISOString()}`);

    const rides = await this.prisma.ride.findMany({
      where: {
        status: { in: ['active', 'booked'] },
        availableSeats: { gte: passengers },
        departureTime: {
          gte: minDate,
          lte: maxDate,
        },
      },
      include: {
        driver: { select: { id: true, name: true, avatar: true, rating: true } },
        selectedCard: { select: { id: true, brand: true, last4: true } },
      },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.ride.count({
      where: {
        status: { in: ['active', 'booked'] },
        availableSeats: { gte: passengers },
        departureTime: {
          gte: minDate,
          lte: maxDate,
        },
      },
    });

    this.logger.log(`Found ${rides.length} rides before filtering`);

    const filteredRides: FilteredRide[] = [];
    for (const ride of rides) {
      if (!ride.startCoordsLat || !ride.startCoordsLng || !ride.endCoordsLat || !ride.endCoordsLng) {
        this.logger.warn(`Ride ${ride.id} missing coordinates, including without distance filter`);
        filteredRides.push({
          ...ride,
          paymentType: ride.paymentType,
          selectedCardId: ride.selectedCardId,
          startDistance: 0,
          endDistance: 0,
          totalDistance: 0,
        });
        continue;
      }

      const rideStartCoords = { lat: ride.startCoordsLat, lng: ride.startCoordsLng };
      const rideEndCoords = { lat: ride.endCoordsLat, lng: ride.endCoordsLng };
      const startDistance = this.haversineDistance(userStartCoords, rideStartCoords);
      const endDistance = this.haversineDistance(userEndCoords, rideEndCoords);

      this.logger.log(`Ride ${ride.id}: startDistance=${startDistance.toFixed(2)} km, endDistance=${endDistance.toFixed(2)} km`);

      if (startDistance <= maxDistance && endDistance <= maxDistance) {
        filteredRides.push({
          ...ride,
          paymentType: ride.paymentType,
          selectedCardId: ride.selectedCardId,
          startDistance,
          endDistance,
          totalDistance: startDistance + endDistance,
        });
      } else {
        this.logger.log(`Ride ${ride.id} filtered out: startDistance=${startDistance.toFixed(2)} or endDistance=${endDistance.toFixed(2)} exceeds maxDistance ${maxDistance}`);
      }
    }

    filteredRides.sort((a, b) => a.totalDistance - b.totalDistance);

    this.logger.log(`Returning ${filteredRides.length} filtered rides`);
    return { success: true, rides: filteredRides, total };
  }

  async findOne(id: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id },
      include: {
        driver: { select: { id: true, name: true, avatar: true, rating: true } },
        payments: true,
        selectedCard: { select: { id: true, brand: true, last4: true } },
      },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    return { success: true, ride };
  }

  async update(id: string, updateRideDto: Partial<CreateRideDto>, userId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const ride = await prisma.ride.findUnique({
        where: { id },
        include: { driver: true },
      });

      if (!ride) {
        throw new NotFoundException('Ride not found');
      }

      if (ride.driverId !== userId) {
        throw new ForbiddenException('You are not authorized to update this ride');
      }

      if (ride.status === 'completed') {
        throw new BadRequestException('Cannot edit completed ride');
      }

      const now = new Date();
      const departureTime = new Date(ride.departureTime);
      const hoursUntilDeparture = (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDeparture < 24) {
        throw new BadRequestException('Cannot edit ride less than 24 hours before departure');
      }

      let startCoords = { lat: ride.startCoordsLat, lng: ride.startCoordsLng };
      let endCoords = { lat: ride.endCoordsLat, lng: ride.endCoordsLng };
      let distance = ride.distance;
      let duration = ride.duration;
      let fare = ride.fare;

      if (updateRideDto.startLocation || updateRideDto.endLocation) {
        const startLocation = updateRideDto.startLocation || ride.startLocation;
        const endLocation = updateRideDto.endLocation || ride.endLocation;
        startCoords = await this.geocodeAddress(startLocation);
        endCoords = await this.geocodeAddress(endLocation);
        const result = await this.calculateDistanceAndDuration(startLocation, endLocation);
        distance = result.distance;
        duration = result.duration;
        fare = this.calculateFare(distance, duration);
      }

      if (updateRideDto.paymentType === 'card' && !updateRideDto.selectedCard?.id) {
        throw new BadRequestException('Selected card is required for card payment type');
      }

      if (updateRideDto.selectedCard?.id) {
        const card = await this.prisma.paymentMethod.findUnique({ where: { id: updateRideDto.selectedCard.id } });
        if (!card || card.userId !== userId) {
          throw new BadRequestException('Invalid or unauthorized payment method');
        }
      }

      const updatedRide = await prisma.ride.update({
        where: { id },
        data: {
          startLocation: updateRideDto.startLocation || ride.startLocation,
          startCoordsLat: startCoords.lat,
          startCoordsLng: startCoords.lng,
          endLocation: updateRideDto.endLocation || ride.endLocation,
          endCoordsLat: endCoords.lat,
          endCoordsLng: endCoords.lng,
          departureTime: updateRideDto.departureTime ? new Date(updateRideDto.departureTime) : ride.departureTime,
          availableSeats: updateRideDto.availableSeats || ride.availableSeats,
          vehicleType: updateRideDto.vehicleType || ride.vehicleType,
          fare,
          distance,
          duration,
          paymentType: updateRideDto.paymentType || ride.paymentType,
          selectedCardId: updateRideDto.paymentType === 'card' || updateRideDto.paymentType === 'both' ? updateRideDto.selectedCard?.id : null,
        },
        include: {
          driver: { select: { id: true, name: true, avatar: true, rating: true } },
          selectedCard: { select: { id: true, brand: true, last4: true } },
        },
      });

      await this.notifyPassengers(id, `Ride ${ride.startLocation} → ${ride.endLocation} has been updated`);

      this.logger.log(`Ride updated: ${id}, fare: ${fare}, distance: ${distance}km, duration: ${duration}min`);
      return { success: true, ride: updatedRide };
    });
  }

  async bookRide(rideId: string, passengerId: string, bookRideDto: BookRideDto) {
    const { passengerCount } = bookRideDto;

    if (rideId !== bookRideDto.rideId) {
      throw new BadRequestException('Ride ID in URL does not match ride ID in body');
    }

    return this.prisma.$transaction(async (prisma) => {
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: { driver: true },
      });

      if (!ride) {
        throw new NotFoundException('Ride not found');
      }

      if (ride.status !== 'active') {
        throw new BadRequestException('Ride is not available for booking');
      }

      if (ride.availableSeats < passengerCount) {
        throw new BadRequestException(`Not enough available seats. Requested: ${passengerCount}, Available: ${ride.availableSeats}`);
      }

      if (ride.driverId === passengerId) {
        throw new BadRequestException('Driver cannot book their own ride');
      }

      const existingRequest = await prisma.bookingRequest.findFirst({
        where: { rideId, passengerId },
      });

      if (existingRequest) {
        throw new BadRequestException('You have already sent a booking request for this ride');
      }

      const bookingRequest = await prisma.bookingRequest.create({
        data: {
          rideId,
          passengerId,
          status: 'pending',
          passengerCount,
        },
        include: {
          passenger: { select: { id: true, name: true, avatar: true, rating: true } },
        },
      });

      const newAvailableSeats = ride.availableSeats - passengerCount;
      await prisma.ride.update({
        where: { id: rideId },
        data: {
          availableSeats: newAvailableSeats,
          status: newAvailableSeats === 0 ? 'booked' : 'active',
        },
      });

      this.logger.log(`Booking request created for ride ${rideId} by passenger ${passengerId} with ${passengerCount} passengers`);

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
          passengerCount: bookingRequest.passengerCount,
          status: bookingRequest.status,
          createdAt: bookingRequest.createdAt.toISOString(),
        },
      };
    });
  }

  async updateStatus(rideId: string, status: string, userId: string) {
    const validStatuses = ['active', 'booked', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      this.logger.error(`Invalid status: ${status} for ride ${rideId}`);
      throw new BadRequestException(`Invalid status: ${status}`);
    }
  
    return this.prisma.$transaction(async (prisma) => {
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: { payments: true, bookingRequests: { include: { passenger: true } } },
      });
  
      if (!ride) {
        this.logger.error(`Ride ${rideId} not found`);
        throw new NotFoundException('Ride not found');
      }
  
      if (ride.driverId !== userId) {
        this.logger.error(`User ${userId} is not authorized to update ride ${rideId}`);
        throw new ForbiddenException('You are not authorized to update this ride');
      }
  
      if (ride.status === 'completed' && status !== 'completed') {
        this.logger.error(`Cannot change status of completed ride ${rideId}`);
        throw new BadRequestException('Cannot change status of completed ride');
      }
  
      if (status === 'completed') {
        const acceptedBookings = ride.bookingRequests.filter(br => br.status === 'accepted');
        if (acceptedBookings.length === 0) {
          this.logger.error(`No accepted booking requests for ride ${rideId}`);
          throw new BadRequestException('No accepted booking requests for this ride');
        }
  
        // Перевірка платежів лише для цифрових методів оплати
        for (const booking of acceptedBookings) {
          const payment = ride.payments.find(p => p.userId === booking.passengerId);
          if (payment && payment.paymentMethod !== 'cash' && !payment.isPaid) {
            this.logger.error(`Payment for passenger ${booking.passengerId} is not completed for ride ${rideId}`);
            throw new BadRequestException(`Payment for passenger ${booking.passengerId} is not completed`);
          }
        }
      }
  
      const updatedRide = await prisma.ride.update({
        where: { id: rideId },
        data: { status },
        include: {
          driver: { select: { id: true, name: true, avatar: true, rating: true } },
          selectedCard: { select: { id: true, brand: true, last4: true } },
        },
      });
  
      await this.notifyPassengers(rideId, `Ride status changed to ${status}`);
  
      this.logger.log(`Ride ${rideId} status updated to ${status} by user ${userId}`);
      return { success: true, ride: updatedRide };
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const ride = await prisma.ride.findUnique({
        where: { id },
        include: {
          payments: true,
          bookingRequests: true,
        },
      });

      if (!ride) {
        this.logger.error(`Ride ${id} not found`);
        throw new NotFoundException('Ride not found');
      }

      if (ride.driverId !== userId) {
        this.logger.error(`User ${userId} is not authorized to delete ride ${id}`);
        throw new ForbiddenException('You are not authorized to delete this ride');
      }

      // Перевірка на активні платежі або підтверджені бронювання
      const hasPaidPayments = ride.payments.some(p => p.isPaid);
      const hasAcceptedBookings = ride.bookingRequests.some(br => br.status === 'accepted' || br.status === 'confirmed');
      if (hasPaidPayments || hasAcceptedBookings) {
        this.logger.error(`Ride ${id} cannot be deleted due to active payments or accepted bookings`);
        throw new BadRequestException('Cannot delete ride with active payments or accepted bookings');
      }

      try {
        // Видалення пов’язаних записів
        await prisma.payment.deleteMany({
          where: { rideId: id },
        });
        this.logger.log(`Deleted payments for ride ${id}`);

        await prisma.bookingRequest.deleteMany({
          where: { rideId: id },
        });
        this.logger.log(`Deleted booking requests for ride ${id}`);

        await prisma.conversation.deleteMany({
          where: { rideId: id },
        });
        this.logger.log(`Deleted conversations for ride ${id}`);

        // Повідомлення пасажирів
        await this.notifyPassengers(id, `Ride ${ride.startLocation} → ${ride.endLocation} has been cancelled`);

        // Видалення поїздки
        await prisma.ride.delete({
          where: { id },
        });

        this.logger.log(`Ride ${id} successfully deleted by user ${userId}`);
        return { success: true, message: 'Ride deleted successfully' };
      } catch (error) {
        this.logger.error(`Failed to delete ride ${id}: ${error}`);
        throw new BadRequestException(`Failed to delete ride: ${error}`);
      }
    });
  }
}