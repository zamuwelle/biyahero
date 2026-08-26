<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
	protected $fillable = [
		'user_id', 'vehicle_code', 'vehicle_type', 'plate_number', 'model',
		'occupancy', 'route_id', 'current_waypoint_index', 'direction',
		'live_lat', 'live_lng'
	];

	public function user()
	{
		return $this->belongsTo(User::class);
	}

	public function route()
	{
		return $this->belongsTo(Route::class);
	}

	public function currentPosition(): array
	{
		if ($this->live_lat !== null && $this->live_lng !== null) {
			return ['lat' => (float) $this->live_lat, 'lng' => (float) $this->live_lng];
		}

		$waypoints = $this->route?->waypoints;
		if (!empty($waypoints) && is_array($waypoints)) {
			return $waypoints[$this->current_waypoint_index] ?? $waypoints[0];
		}

		return ['lat' => 14.5995, 'lng' => 120.9842];
	}
}