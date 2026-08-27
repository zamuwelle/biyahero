<?php

namespace App\Console\Commands;

use App\Models\Trip;
use Illuminate\Console\Command;

/**
 * Drives the seeded fleet so a demo does not go stale.
 *
 * Seeded vehicles never ping again, and the client marks anything quieter than
 * two minutes as Stale — correct behaviour, but it makes a demo look broken
 * within two minutes of seeding. This walks each active trip along its route
 * polyline and refreshes last_ping_at, exactly as a real driver's app would.
 *
 * The set of simulated vehicles is snapshotted at startup, so any driver who
 * registers and starts broadcasting afterwards is never touched — their real
 * GPS always wins.
 */
class SimulateFleet extends Command
{
    protected $signature = 'biyahero:simulate
        {--interval=8 : Seconds between ticks, matching the driver ping interval}
        {--step=1 : Waypoints advanced per tick (~30 m each) — raise for a livelier demo}
        {--once : Run a single tick and exit}';

    protected $description = 'Move the seeded fleet along its routes and keep pings fresh';

    /** @var array<int> Vehicle ids this command is allowed to move. */
    private array $simulated = [];

    public function handle(): int
    {
        $interval = max(1, (int) $this->option('interval'));

        // Snapshot now: everything already on the road is demo data. Anything
        // that starts a trip later is a real phone and stays untouched.
        $this->simulated = Trip::query()->active()->pluck('vehicle_id')->all();

        if ($this->simulated === []) {
            $this->warn('No active trips to simulate. Run: php artisan migrate:fresh --seed');

            return self::FAILURE;
        }

        $this->info(sprintf('Simulating %d vehicle(s) every %ds. Ctrl+C to stop.', count($this->simulated), $interval));

        do {
            $moved = $this->tick();
            $this->line(sprintf('[%s] advanced %d vehicle(s)', now()->toTimeString(), $moved));

            if ($this->option('once')) {
                return self::SUCCESS;
            }

            sleep($interval);
        } while (true);
    }

    private function tick(): int
    {
        $trips = Trip::query()
            ->active()
            ->whereIn('vehicle_id', $this->simulated)
            ->with(['vehicle', 'route'])
            ->get();

        $moved = 0;

        foreach ($trips as $trip) {
            $vehicle = $trip->vehicle;
            $waypoints = $trip->route?->waypoints ?? [];

            if (! $vehicle || count($waypoints) < 2) {
                continue;
            }

            $index = $vehicle->current_waypoint_index ?? 0;
            $direction = $vehicle->direction === 'backward' ? -1 : 1;
            $step = max(1, (int) $this->option('step'));
            $next = $index + $direction * $step;

            // Bounce at the ends so vehicles shuttle the route rather than
            // running off it — and flip the TRIP around too, the way a real
            // jeepney starts a reverse run at the terminal. Without the flip a
            // returning vehicle still claims the far end as its destination,
            // and the navigation-style route line grows instead of shortening.
            if ($next >= count($waypoints) || $next < 0) {
                $direction *= -1;
                $next = max(0, min(count($waypoints) - 1, $index + $direction * $step));
                $this->turnAround($trip, $waypoints, $direction);
            }

            $point = $waypoints[$next] ?? $waypoints[0];

            $vehicle->update([
                'current_waypoint_index' => $next,
                'direction' => $direction === 1 ? 'forward' : 'backward',
                'live_lat' => $point['lat'] ?? null,
                'live_lng' => $point['lng'] ?? null,
                'last_ping_at' => now(),
            ]);

            $moved++;
        }

        return $moved;
    }

    /**
     * A reverse run at the terminal: destination and its exact point flip to
     * the end the vehicle is now actually heading toward, taken from the
     * route's "Start → End" label.
     */
    private function turnAround(Trip $trip, array $waypoints, int $direction): void
    {
        $parts = preg_split('/→|->/u', (string) $trip->route?->label);
        if (! $parts || count($parts) < 2) {
            return;
        }

        $name = trim($direction === 1 ? (string) end($parts) : (string) $parts[0]);
        $target = $direction === 1 ? end($waypoints) : $waypoints[0];

        if ($name === '' || ! is_array($target)) {
            return;
        }

        $trip->update([
            'destination' => $name,
            'dest_lat' => $target['lat'] ?? null,
            'dest_lng' => $target['lng'] ?? null,
        ]);
    }
}
