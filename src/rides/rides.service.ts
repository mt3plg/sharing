import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRideDto, SearchRideDto } from './interfaces/interfaces_ride.interface';
import axios from 'axios';

// Експортуємо інтерфейс для типізації відфільтрованих поїздок
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
  createdAt: Date;
  updatedAt: Date;
  startDistance: number;
  endDistance: number;
  totalDistance: number;
}

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(RidesService.name);
  // Функція для геокодування адреси
  private async geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
    const apiKey = process.env.GOOGLE_API_KEY || 'AIzaSyATQMZZLlcjmR9chpaKM-4YJXwZ9c5iPtk'; // Використовуйте змінну середовища
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    try {
      const response = await axios.get(url);
      const data = response.data;
      if (data.status === 'OK') {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
      } else {
        throw new Error(`Geocoding failed for address: ${address}`);
      }
    } catch (error: unknown) {
      // Приводимо error до типу Error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Geocoding error:', errorMessage);
      throw new BadRequestException(`Failed to geocode address: ${address}`);
    }
  }

  // Функція для обчислення відстані (haversine formula)
  private haversineDistance(coords1: { lat: number; lng: number }, coords2: { lat: number; lng: number }): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // Радіус Землі в кілометрах
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Відстань у кілометрах
  }

  async create(createRideDto: CreateRideDto, driverId: string) {
    const { startLocation, endLocation, departureTime, availableSeats, vehicleType } = createRideDto;

    // Геокодування адрес
    const startCoords = await this.geocodeAddress(startLocation);
    const endCoords = await this.geocodeAddress(endLocation);

    const ride = await this.prisma.ride.create({
      data: {
        driverId,
        startLocation,
        startCoordsLat: startCoords.lat,
        startCoordsLng: startCoords.lng,
        endLocation,
        endCoordsLat: endCoords.lat,
        endCoordsLng: endCoords.lng,
        departureTime: new Date(departureTime),
        availableSeats,
        vehicleType: vehicleType || 'Unknown', // Додаємо тип транспорту
      },
    });

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
      },
    });

    const rides = [...createdRides, ...bookedRides].filter(
      (ride, index, self) => index === self.findIndex(r => r.id === ride.id)
    );

    return { success: true, rides };
  }

  async search(searchRideDto: SearchRideDto) {
    this.logger.log(`Search parameters: ${JSON.stringify(searchRideDto, null, 2)}`);

    const { startLocation, endLocation, departureTime, passengers, dateRange = 2, maxDistance = 10, startCoords, endCoords } = searchRideDto;

    const userStartCoords = startCoords || (await this.geocodeAddress(startLocation));
    const userEndCoords = endCoords || (await this.geocodeAddress(endLocation));

    const departureDate = new Date(departureTime);
    const minDate = new Date(departureDate);
    minDate.setDate(departureDate.getDate() - dateRange);
    const maxDate = new Date(departureDate);
    maxDate.setDate(departureDate.getDate() + dateRange);

    this.logger.log(`Date range: minDate=${minDate.toISOString()}, maxDate=${maxDate.toISOString()}`);

    const rides = await this.prisma.ride.findMany({
        where: {
            status: { in: ['active', 'booked'] }, // Додано 'booked'
            availableSeats: { gte: passengers },
            departureTime: {
                gte: minDate,
                lte: maxDate,
            },
        },
        include: {
            driver: { select: { id: true, name: true, avatar: true, rating: true } },
        },
    });

    this.logger.log(`Found rides before filtering: ${JSON.stringify(rides, null, 2)}`);

    const filteredRides: FilteredRide[] = [];
    for (const ride of rides) {
        if (!ride.startCoordsLat || !ride.startCoordsLng || !ride.endCoordsLat || !ride.endCoordsLng) {
            this.logger.log(`Ride ${ride.id} filtered out: missing coordinates`);
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
                startDistance,
                endDistance,
                totalDistance: startDistance + endDistance,
            });
        } else {
            this.logger.log(`Ride ${ride.id} filtered out: startDistance=${startDistance.toFixed(2)} or endDistance=${endDistance.toFixed(2)} exceeds maxDistance ${maxDistance}`);
        }
    }

    this.logger.log(`Filtered rides: ${JSON.stringify(filteredRides, null, 2)}`);

    filteredRides.sort((a, b) => a.totalDistance - b.totalDistance);

    return { success: true, rides: filteredRides };
}

  async findOne(id: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id },
      include: { driver: { select: { id: true, name: true, avatar: true, rating: true } } },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    return { success: true, ride };
  }

  async update(id: string, updateRideDto: Partial<CreateRideDto>, userId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id },
      include: { driver: true },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== userId) {
      throw new ForbiddenException('You are not authorized to update this ride');
    }

    const now = new Date();
    const departureTime = new Date(ride.departureTime);
    const hoursUntilDeparture = (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilDeparture < 24) {
      throw new BadRequestException('Cannot edit ride less than 24 hours before departure');
    }

    // Якщо оновлюються локації, геокодуємо їх
    let startCoords = { lat: ride.startCoordsLat, lng: ride.startCoordsLng };
    let endCoords = { lat: ride.endCoordsLat, lng: ride.endCoordsLng };

    if (updateRideDto.startLocation) {
      startCoords = await this.geocodeAddress(updateRideDto.startLocation);
    }
    if (updateRideDto.endLocation) {
      endCoords = await this.geocodeAddress(updateRideDto.endLocation);
    }

    const updatedRide = await this.prisma.ride.update({
      where: { id },
      data: {
        ...updateRideDto,
        startLocation: updateRideDto.startLocation || ride.startLocation,
        startCoordsLat: startCoords.lat,
        startCoordsLng: startCoords.lng,
        endLocation: updateRideDto.endLocation || ride.endLocation,
        endCoordsLat: endCoords.lat,
        endCoordsLng: endCoords.lng,
        departureTime: updateRideDto.departureTime ? new Date(updateRideDto.departureTime) : ride.departureTime,
      },
      include: { driver: { select: { id: true, name: true, avatar: true, rating: true } } },
    });

    return { success: true, ride: updatedRide };
  }

  async bookRide(rideId: string, passengerId: string, passengerCount: number) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { driver: true },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.passengerId) {
      throw new BadRequestException('Ride already has a passenger');
    }

    if (ride.availableSeats < passengerCount) {
      throw new BadRequestException('Not enough available seats');
    }

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        passengerId,
        availableSeats: ride.availableSeats - passengerCount,
      },
      include: { driver: { select: { id: true, name: true, avatar: true, rating: true } } },
    });

    return { success: true, ride: updatedRide };
  }

  async updateStatus(rideId: string, status: string, userId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== userId) {
      throw new ForbiddenException('You are not authorized to update this ride');
    }

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: { status },
      include: { driver: { select: { id: true, name: true, avatar: true, rating: true } } },
    });

    return { success: true, ride: updatedRide };
  }

  async delete(rideId: string, userId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== userId) {
      throw new ForbiddenException('You are not authorized to delete this ride');
    }

    await this.prisma.ride.delete({
      where: { id: rideId },
    });

    return { success: true, message: 'Ride deleted successfully' };
  }
}