<?php

namespace Database\Seeders;

use App\Models\Route;
use Illuminate\Database\Seeder;

class RouteSeeder extends Seeder
{
    public function run(): void
    {
        Route::create([
            'name' => 'Route 3',
            'waypoints' => [
                ['lat' => 14.6760, 'lng' => 121.0437],
                ['lat' => 14.6775, 'lng' => 121.0445],
                ['lat' => 14.6790, 'lng' => 121.0452],
                ['lat' => 14.6805, 'lng' => 121.0460],
                ['lat' => 14.6820, 'lng' => 121.0468],
                ['lat' => 14.6835, 'lng' => 121.0475],
                ['lat' => 14.6850, 'lng' => 121.0483],
            ],
        ]);

        Route::create([
            'name' => 'Route 7',
            'waypoints' => [
                ['lat' => 14.6600, 'lng' => 121.0300],
                ['lat' => 14.6620, 'lng' => 121.0320],
                ['lat' => 14.6640, 'lng' => 121.0340],
                ['lat' => 14.6660, 'lng' => 121.0360],
                ['lat' => 14.6680, 'lng' => 121.0380],
            ],
        ]);
    }
}