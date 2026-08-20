<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    protected $fillable = ['name', 'waypoints'];

		protected $casts = [
        'waypoints' => 'array',
    ];

		public function vehicles()
		{
			return $this->hasMany(Vehicle::class);
		}
}
