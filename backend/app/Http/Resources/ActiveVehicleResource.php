<?php

namespace App\Http\Resources;

use App\Models\Destination;
use App\Models\Trip;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Cache;

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
            'destination_position' => $this->destinationPosition($trip->destination),
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

    /**
     * Where the trip's destination sits on the map, so the app can pin it.
     *
     * Every vehicle in a poll repeats the same few destination names, so the
     * whole table is cached once. memo() layers request-lifetime memoization
     * over the store — without it, each of the ~12 resources in a poll would
     * issue its own cache-table SELECT.
     *
     * Trip destinations are free-typed by the driver, so after the exact
     * lowercased match this falls back to a contains match either way round
     * ("Taft" pins Taft Avenue; "Baclaran Terminal" pins Baclaran) — the same
     * two-tier leniency the trip-creation and search paths already use.
     *
     * @return array{lat: float, lng: float}|null
     */
    private function destinationPosition(?string $name): ?array
    {
        if ($name === null || $name === '') {
            return null;
        }

        // Plain arrays only — Eloquent models do not survive the cache store.
        $byName = Cache::memo()->remember(
            'destinations.by-name',
            300,
            fn () => Destination::query()
                ->get(['name', 'lat', 'lng'])
                ->mapWithKeys(fn (Destination $destination) => [
                    mb_strtolower($destination->name) => [
                        'lat' => (float) $destination->lat,
                        'lng' => (float) $destination->lng,
                    ],
                ])
                ->all()
        );

        $needle = mb_strtolower($name);

        if (isset($byName[$needle])) {
            return $byName[$needle];
        }

        foreach ($byName as $key => $position) {
            if (str_contains($key, $needle) || str_contains($needle, $key)) {
                return $position;
            }
        }

        return null;
    }
}
