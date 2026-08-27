<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    protected $fillable = [
        'name', 'label', 'waypoints', 'control_points',
        'length_km', 'duration_min', 'road_matched',
    ];

    protected $casts = [
        // `waypoints` is the dense, road-snapped polyline the app draws.
        // `control_points` are the hand-placed anchors it was built from.
        'waypoints' => 'array',
        'control_points' => 'array',
        'length_km' => 'float',
        'road_matched' => 'boolean',
    ];

    public function vehicles()
    {
        return $this->hasMany(Vehicle::class);
    }

    public function trips()
    {
        return $this->hasMany(Trip::class);
    }
}
