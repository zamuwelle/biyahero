<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    protected $fillable = [
        'vehicle_code', 'vehicle_type', 'route_id',
        'current_waypoint_index', 'direction',
				'live_lat', 'live_lng'
    ];

    public function route()
    {
        return $this->belongsTo(Route::class);
    }

    // Resolves the vehicle's actual lat/lng from its route's waypoints
		public function currentPosition(): array
		{
			// If this vehicle has live GPS coords, use those instead of waypoint index
			if ($this->live_lat !== null && $this->live_lng !== null) {
					return ['lat' => (float) $this->live_lat, 'lng' => (float) $this->live_lng];
			}

			$waypoints = $this->route->waypoints;
			return $waypoints[$this->current_waypoint_index] ?? $waypoints[0];
		}
}