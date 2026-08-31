<?php

namespace Database\Seeders;

use App\Models\Destination;
use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;

/**
 * Puts every seeded vehicle on an active run, and writes the trip history that
 * the driver profile statistics are counted from.
 *
 * Nothing here states a figure the app then displays: distance on an active
 * trip is derived from how far along its polyline the vehicle actually is, and
 * "total trips" on the profile is a COUNT of the completed rows written below —
 * not a stored number.
 *
 * One vehicle (RMV 5520) is deliberately left with a two-hour-old ping so the
 * Stale treatment is visible in the demo instead of only in the design.
 */
class TripSeeder extends Seeder
{
    /** Completed runs written per year of tenure — a few trips a week. */
    private const TRIPS_PER_YEAR = 30;

    public function run(): void
    {
        // plate => [destination, capacity, current street, progress 0..1, minutes since ping]
        $runs = [
            'NCR 8842' => ['Baclaran', 'open', 'Taft Ave', 0.45, 0],
            'PLK 2290' => ['Baclaran', 'open', 'Buendia', 0.05, 0],
            'BCL 5521' => ['Baclaran', 'full', 'Vito Cruz', 0.62, 1],
            'QZN 1183' => ['Baclaran', 'filling', 'Taft Ave', 0.55, 0],
            'MLA 7734' => ['Baclaran', 'open', 'Quiapo', 0.12, 0],
            'DAN 4417' => ['Cubao', 'filling', 'EDSA Balintawak', 0.18, 0],
            'TXB 9931' => ['Cubao', 'full', 'Aurora Blvd', 0.78, 1],
            'MNT 3390' => ['Cubao', 'open', 'Monumento', 0.02, 0],
            'EJP 0142' => ['Guadalupe', 'open', 'Guadalupe', 0.88, 0],
            'AYL 6628' => ['Guadalupe', 'filling', 'Ayala', 0.08, 1],
            'RMV 5520' => ['Buendia', 'unknown', 'Skyway', 0.35, 120],
            'ALB 8802' => ['Buendia', 'open', 'Alabang', 0.04, 0],
        ];

        foreach ($runs as $plate => [$destination, $capacity, $street, $progress, $minutesAgo]) {
            $vehicle = Vehicle::where('plate_number', $plate)->with(['route', 'driver'])->first();
            if (! $vehicle) {
                continue;
            }

            $route = $vehicle->route;
            $waypoints = $route?->waypoints ?? [];
            if ($waypoints === []) {
                continue;
            }

            $index = (int) round($progress * (count($waypoints) - 1));
            $point = $waypoints[$index];

            $vehicle->update([
                'current_waypoint_index' => $index,
                'live_lat' => $point['lat'],
                'live_lng' => $point['lng'],
                'last_ping_at' => now()->subMinutes($minutesAgo),
                'current_street' => $street,
            ]);

            $elapsed = max(1, (int) round(($route->duration_min ?: 30) * $progress));

            // Pin the exact target so the app can mark it and can tell which
            // way along the corridor this run is going.
            $place = Destination::query()
                ->get()
                ->first(fn (Destination $d) => mb_strtolower($d->name) === mb_strtolower($destination));

            Trip::create([
                'vehicle_id' => $vehicle->id,
                'route_id' => $vehicle->route_id,
                'destination' => $destination,
                'dest_lat' => $place?->lat,
                'dest_lng' => $place?->lng,
                'capacity' => $capacity,
                'started_at' => now()->subMinutes($elapsed),
                // Distance actually covered so far, from the real route length.
                'distance_km' => round($route->length_km * $progress, 2),
            ]);

            $this->writeHistory($vehicle);
        }
    }

    /**
     * Completed runs backing the profile counters. The driver's tenure comes
     * from their backdated created_at, so the history spans a real period.
     */
    private function writeHistory(Vehicle $vehicle): void
    {
        $driver = $vehicle->driver;
        $route = $vehicle->route;

        if (! $driver || ! $route) {
            return;
        }

        $years = max(1, (int) $driver->created_at->diffInYears(now()));
        $count = $years * self::TRIPS_PER_YEAR;
        $spanDays = max(1, (int) $driver->created_at->diffInDays(now()));

        // A route label is "Start → End"; a DESTINATION is one of those ends.
        // Storing the whole label made history and the driver's route
        // shortcuts read "Buendia → Baclaran" as a place, and left the
        // direction of travel unknowable.
        $ends = array_map('trim', preg_split('/→|->/u', (string) ($route->label ?? '')) ?: []);
        $waypoints = $route->waypoints ?? [];
        $terminals = count($ends) === 2 && count($waypoints) >= 2
            ? [
                [$ends[1], $waypoints[count($waypoints) - 1]],
                [$ends[0], $waypoints[0]],
            ]
            : [[$route->label, null], [$route->label, null]];

        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            // Space the history evenly across the driver's tenure.
            $daysAgo = (int) round($spanDays * ($i / max(1, $count)));
            $started = now()->subDays($daysAgo)->setTime(6, 0)->addMinutes(($i % 12) * 45);
            $duration = max(5, $route->duration_min ?: 30);

            // Real jeepneys shuttle: alternate ends run by run.
            [$destination, $target] = $terminals[$i % 2];

            $rows[] = [
                'vehicle_id' => $vehicle->id,
                'route_id' => $route->id,
                'destination' => $destination,
                'dest_lat' => $target['lat'] ?? null,
                'dest_lng' => $target['lng'] ?? null,
                'capacity' => 'unknown',
                'started_at' => $started,
                'ended_at' => $started->copy()->addMinutes($duration),
                'distance_km' => $route->length_km,
                'created_at' => $started,
                'updated_at' => $started,
            ];
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            Trip::insert($chunk);
        }
    }
}
