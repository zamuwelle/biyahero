<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

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

        $start = $waypoints[0];
        $end = $waypoints[count($waypoints) - 1];

        $away = fn (array $point) => ($point['lat'] - $target['lat']) ** 2 + ($point['lng'] - $target['lng']) ** 2;

        // Heading back toward the route's starting end: read it that way.
        return $away($start) < $away($end)
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

        $place = Destination::query()
            ->get()
            ->first(fn (Destination $d) => mb_strtolower($d->name) === mb_strtolower((string) $this->destination));

        return $place ? ['lat' => (float) $place->lat, 'lng' => (float) $place->lng] : null;
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
