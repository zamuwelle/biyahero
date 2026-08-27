<?php

namespace Database\Seeders;

use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;

/**
 * Puts every seeded vehicle on an active run and gives it a live position.
 *
 * One vehicle (RMV 5520) is deliberately left with a two-hour-old ping so the
 * Stale treatment — dashed pin, "Huling nasa …", capacity forced to unknown —
 * is visible in the demo instead of only in the design.
 */
class TripSeeder extends Seeder
{
    public function run(): void
    {
        // plate => [destination, capacity, current street, waypoint index, minutes since ping]
        $runs = [
            'NCR 8842' => ['Baclaran', 'open', 'Taft Ave', 3, 0],
            'PLK 2290' => ['Baclaran', 'open', 'Buendia', 0, 0],
            'BCL 5521' => ['Baclaran', 'full', 'Vito Cruz', 4, 1],
            'QZN 1183' => ['Baclaran', 'filling', 'Taft Ave', 4, 0],
            'MLA 7734' => ['Baclaran', 'open', 'Quiapo', 1, 0],
            'DAN 4417' => ['Cubao', 'filling', 'EDSA Balintawak', 1, 0],
            'TXB 9931' => ['Cubao', 'full', 'Aurora Blvd', 5, 1],
            'MNT 3390' => ['Cubao', 'open', 'Monumento', 0, 0],
            'EJP 0142' => ['Guadalupe', 'open', 'Guadalupe', 4, 0],
            'AYL 6628' => ['Guadalupe', 'filling', 'Ayala', 0, 1],
            'RMV 5520' => ['Buendia', 'unknown', 'Skyway', 2, 120],
            'ALB 8802' => ['Buendia', 'open', 'Alabang', 0, 0],
        ];

        foreach ($runs as $plate => [$destination, $capacity, $street, $waypointIndex, $minutesAgo]) {
            $vehicle = Vehicle::where('plate_number', $plate)->with('route')->first();
            if (! $vehicle) {
                continue;
            }

            $waypoints = $vehicle->route?->waypoints ?? [];
            $point = $waypoints[$waypointIndex] ?? ($waypoints[0] ?? null);

            $vehicle->update([
                'current_waypoint_index' => $waypointIndex,
                'live_lat' => $point['lat'] ?? null,
                'live_lng' => $point['lng'] ?? null,
                'last_ping_at' => now()->subMinutes($minutesAgo),
                'current_street' => $street,
            ]);

            Trip::create([
                'vehicle_id' => $vehicle->id,
                'route_id' => $vehicle->route_id,
                'destination' => $destination,
                'capacity' => $capacity,
                'started_at' => now()->subMinutes(22),
                'distance_km' => 5.1,
            ]);
        }
    }
}
