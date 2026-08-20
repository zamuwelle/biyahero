<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    protected $fillable = [
        'vehicle_code', 'vehicle_type', 'route_id',
        'current_waypoint_index', 'direction',
    ];

    public function route()
    {
        return $this->belongsTo(Route::class);
    }

    // Resolves the vehicle's actual lat/lng from its route's waypoints
    public function currentPosition(): array
    {
        $waypoints = $this->route->waypoints;
        return $waypoints[$this->current_waypoint_index] ?? $waypoints[0];
    }
}