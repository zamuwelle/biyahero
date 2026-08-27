<?php

namespace App\Http\Resources;

use App\Models\Trip;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * What a commuter is allowed to see about a vehicle.
 *
 * Deliberately absent: distance_km and any ETA. The app never learns where the
 * commuter is, so both would be invented numbers. The card answers what the data
 * actually supports — where it is headed, which street it is on right now, how
 * full it is, and how old the last ping is.
 *
 * @property-read Trip $resource
 */
class ActiveVehicleResource extends JsonResource
{
    /** A ping older than this renders as Stale — dashed pin plus "last seen". */
    public const STALE_AFTER_SECONDS = 120;

    public function toArray(Request $request): array
    {
        $trip = $this->resource;
        $vehicle = $trip->vehicle;
        $driver = $vehicle->driver;

        $secondsSincePing = $vehicle->last_ping_at?->diffInSeconds(now());
        $isStale = $secondsSincePing === null || $secondsSincePing > self::STALE_AFTER_SECONDS;

        return [
            'id' => $vehicle->id,
            'trip_id' => $trip->id,
            'vehicle_code' => $vehicle->vehicle_code,
            'vehicle_type' => $vehicle->vehicle_type,
            'plate_number' => $vehicle->plate_number,
            'model' => $vehicle->model,
            'body_number' => $vehicle->body_number,

            'destination' => $trip->destination,
            'capacity' => $isStale ? 'unknown' : $trip->capacity,
            'current_street' => $vehicle->current_street,
            'position' => $vehicle->currentPosition(),

            'route' => [
                'id' => $trip->route?->id,
                'label' => $trip->route?->label ?? $trip->route?->name,
                'length_km' => $trip->route?->length_km,
                'waypoints' => $trip->route?->waypoints ?? [],
            ],

            'last_ping_at' => $vehicle->last_ping_at?->toIso8601String(),
            'minutes_since_ping' => $secondsSincePing === null ? null : (int) floor($secondsSincePing / 60),
            'is_stale' => $isStale,

            'driver' => $driver ? [
                'name' => $driver->shortName(),
                'is_verified' => (bool) $driver->is_verified,
                'years_on_route' => $driver->yearsOnRoute(),
            ] : null,
        ];
    }
}
