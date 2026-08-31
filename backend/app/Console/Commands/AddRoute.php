<?php

namespace App\Console\Commands;

use App\Models\Destination;
use App\Models\Route;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\RouteGeometry;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

/**
 * Creates a real, road-matched route anywhere — so the app can be demonstrated
 * in the area you are actually standing in, rather than only in the seeded
 * Metro Manila corridors.
 *
 * Example:
 *   php artisan biyahero:add-route "San Fernando → Apalit" \
 *       15.0286,120.6898 14.9510,120.7580 --destination=Apalit --vehicles=3
 */
class AddRoute extends Command
{
    protected $signature = 'biyahero:add-route
        {label : Human label, e.g. "San Fernando → Apalit"}
        {points* : Two or more lat,lng anchors along the route}
        {--destination= : Destination name commuters search for (defaults to the text after the arrow)}
        {--vehicles=2 : How many active demo vehicles to put on this route}
        {--type=jeepney : jeepney|ejeep|bus|uv_express}';

    protected $description = 'Add a road-matched route (and optional demo vehicles) anywhere';

    public function handle(RouteGeometry $geometry): int
    {
        $label = $this->argument('label');
        $type = $this->option('type');

        if (! in_array($type, ['jeepney', 'ejeep', 'bus', 'uv_express'], true)) {
            $this->error("Unknown vehicle type '{$type}'.");

            return self::FAILURE;
        }

        $controlPoints = [];
        foreach ($this->argument('points') as $raw) {
            $parts = array_map('trim', explode(',', $raw));

            if (count($parts) !== 2 || ! is_numeric($parts[0]) || ! is_numeric($parts[1])) {
                $this->error("Bad point '{$raw}' — expected lat,lng (e.g. 15.0286,120.6898).");

                return self::FAILURE;
            }

            $controlPoints[] = ['lat' => (float) $parts[0], 'lng' => (float) $parts[1]];
        }

        if (count($controlPoints) < 2) {
            $this->error('Need at least two points.');

            return self::FAILURE;
        }

        $this->line('Snapping to roads via OSRM…');
        $snapped = $geometry->snapToRoads($controlPoints);

        if (! $snapped['matched']) {
            $this->warn('OSRM unreachable — storing straight-line geometry. The drawn route will not follow roads.');
        }

        $route = Route::create([
            'name' => $label,
            'label' => $label,
            'control_points' => $controlPoints,
            'waypoints' => $snapped['waypoints'],
            'length_km' => $snapped['length_km'],
            'duration_min' => $snapped['duration_min'],
            'road_matched' => $snapped['matched'],
        ]);

        $this->info(sprintf(
            'Route #%d "%s" — %.2f km, %d min, %d points.',
            $route->id, $label, $snapped['length_km'], $snapped['duration_min'], count($snapped['waypoints'])
        ));

        // The destination is what a commuter types; default to the far end.
        $destinationName = $this->option('destination')
            ?: trim(last(preg_split('/→|->/u', $label)));

        $end = end($snapped['waypoints']);

        // Case-insensitive lookup, folded in PHP: every read path lowercases
        // names with mb_strtolower, so "baclaran" must reuse "Baclaran" — and
        // SQLite's LOWER() folds ASCII only, which would let "Parañaque" slip
        // past "PARAÑAQUE" and hijack the shared lowercased cache key.
        $destination = Destination::query()
            ->get()
            ->first(fn (Destination $existing) => mb_strtolower($existing->name) === mb_strtolower($destinationName))
            ?? Destination::create([
                'name' => $destinationName,
                'subtitle' => $label,
                'lat' => $end['lat'],
                'lng' => $end['lng'],
                'is_popular' => true,
            ]);

        // The vehicle payload caches the destination table for its map pins.
        Cache::forget('destinations.by-name');

        $this->info("Destination '{$destination->name}' ready at {$destination->lat}, {$destination->lng}.");

        $this->putVehiclesOnRoute($route, $type, (int) $this->option('vehicles'), $destination->name);

        return self::SUCCESS;
    }

    private function putVehiclesOnRoute(Route $route, string $type, int $count, string $destination): void
    {
        if ($count < 1) {
            return;
        }

        $waypoints = $route->waypoints;

        for ($i = 0; $i < $count; $i++) {
            $suffix = str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);

            $driver = User::create([
                'name' => 'Demo Driver '.($i + 1),
                'phone' => '+6391700'.$suffix,
                'license_hash' => Hash::make('DEMO-'.$suffix),
                'is_verified' => true,
                'verification_status' => 'approved',
                'approved_at' => now(),
            ]);

            // Spread them along the route rather than stacking at the start.
            $index = (int) round((count($waypoints) - 1) * (($i + 1) / ($count + 1)));
            $point = $waypoints[$index];

            $vehicle = Vehicle::create([
                'user_id' => $driver->id,
                'vehicle_code' => strtoupper(substr($type, 0, 4)).'-'.$suffix,
                'vehicle_type' => $type,
                'plate_number' => 'DEM '.$suffix,
                'route_id' => $route->id,
                'current_waypoint_index' => $index,
                'live_lat' => $point['lat'],
                'live_lng' => $point['lng'],
                'last_ping_at' => now(),
                // NOT the route label: the card says "Kasalukuyang nasa X",
                // which must name a street. The simulator reverse-geocodes a
                // real one as the vehicle moves.
                'current_street' => null,
            ]);

            Trip::create([
                'vehicle_id' => $vehicle->id,
                'route_id' => $route->id,
                'destination' => $destination,
                'capacity' => ['open', 'filling', 'full'][$i % 3],
                'started_at' => now()->subMinutes(5),
                'distance_km' => round($route->length_km * (($i + 1) / ($count + 1)), 2),
            ]);
        }

        $this->info("Put {$count} active {$type}(s) on the route heading to {$destination}.");
        $this->newLine();
        $this->line('Restart the simulator so it picks them up:  php artisan biyahero:simulate');
    }
}
