<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * One driver's declared run. The route lives here rather than on the vehicle,
 * because a PH driver picks a new destination every time they turn around.
 */
class Trip extends Model
{
    protected $fillable = ['vehicle_id', 'route_id', 'destination', 'dest_lat', 'dest_lng', 'capacity', 'started_at', 'ended_at', 'distance_km'];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'distance_km' => 'float',
    ];

    /**
     * The route label pointed the way this trip is actually running.
     *
     * A route is stored once ("Victoria → Tarlac City") but is driven in both
     * directions: a jeepney that turned around at the terminal is still on
     * that row while heading back. Printing the stored label then contradicts
     * the destination right above it, so the ends are swapped whenever this
     * trip is running the return leg.
     */
    public function orientedRouteLabel(): ?string
    {
        $label = $this->route?->label ?? $this->route?->name;
        $waypoints = $this->route?->waypoints ?? [];

        if ($label === null || count($waypoints) < 2) {
            return $label;
        }

        $parts = array_map('trim', preg_split('/→|->/u', $label) ?: []);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            return $label;
        }

        $target = $this->targetPoint();
        if ($target === null) {
            return $label;
        }

        // How far ALONG the polyline each point sits. Comparing to the two
        // endpoints instead mislabels any destination in the middle of the
        // corridor, which is most of them.
        $along = function (array $point) use ($waypoints): int {
            $best = 0;
            $bestDistance = INF;

            foreach ($waypoints as $index => $waypoint) {
                $distance = ($waypoint['lat'] - $point['lat']) ** 2 + ($waypoint['lng'] - $point['lng']) ** 2;
                if ($distance < $bestDistance) {
                    $bestDistance = $distance;
                    $best = $index;
                }
            }

            return $best;
        };

        $vehicle = $this->vehicle;
        $from = $vehicle?->live_lat !== null && $vehicle?->live_lng !== null
            ? ['lat' => (float) $vehicle->live_lat, 'lng' => (float) $vehicle->live_lng]
            : $waypoints[0];

        // Destination behind the vehicle along the stored direction means this
        // run is the return leg, so the label reads the other way.
        return $along($target) < $along($from)
            ? $parts[1].' → '.$parts[0]
            : $label;
    }

    /**
     * Where this trip is headed, as a point: its own stored target, else the
     * destinations table, else nothing.
     *
     * @return array{lat: float, lng: float}|null
     */
    private function targetPoint(): ?array
    {
        if ($this->dest_lat !== null && $this->dest_lng !== null) {
            return ['lat' => (float) $this->dest_lat, 'lng' => (float) $this->dest_lng];
        }

        // Memoised per request: this ran a full destinations SELECT for every
        // vehicle in a poll.
        $byName = Cache::memo()->remember(
            'destinations.by-name',
            300,
            fn () => Destination::query()
                ->get(['name', 'lat', 'lng'])
                ->mapWithKeys(fn (Destination $d) => [
                    mb_strtolower($d->name) => ['lat' => (float) $d->lat, 'lng' => (float) $d->lng],
                ])
                ->all()
        );

        $place = $byName[mb_strtolower((string) $this->destination)] ?? null;

        return $place;
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function route()
    {
        return $this->belongsTo(Route::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('ended_at');
    }

    public function elapsedMinutes(): int
    {
        return (int) $this->started_at->diffInMinutes($this->ended_at ?? now());
    }
}
