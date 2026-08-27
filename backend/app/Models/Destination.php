<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Destination extends Model
{
    protected $fillable = ['name', 'subtitle', 'lat', 'lng', 'is_popular'];

    protected $casts = [
        'lat' => 'float',
        'lng' => 'float',
        'is_popular' => 'boolean',
    ];
}
