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
