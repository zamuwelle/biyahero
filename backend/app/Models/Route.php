<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    protected $fillable = ['name', 'label', 'waypoints', 'length_km'];

    protected $casts = [
        'waypoints' => 'array',
        'length_km' => 'float',
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
