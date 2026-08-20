<?php

namespace Database\Seeders;

use App\Models\Route;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;

class VehicleSeeder extends Seeder
{
    public function run(): void
    {
        $route3 = Route::where('name', 'Route 3')->first();
        $route7 = Route::where('name', 'Route 7')->first();

        Vehicle::create([
            'vehicle_code' => 'JEEP-001',
            'vehicle_type' => 'jeepney',
            'route_id' => $route3->id,
            'current_waypoint_index' => 0, // start of route
            'direction' => 'forward',
        ]);

        Vehicle::create([
            'vehicle_code' => 'JEEP-002',
            'vehicle_type' => 'jeepney',
            'route_id' => $route3->id,
            'current_waypoint_index' => 3, // middle of route
            'direction' => 'forward',
        ]);

        Vehicle::create([
            'vehicle_code' => 'JEEP-003',
            'vehicle_type' => 'jeepney',
            'route_id' => $route3->id,
            'current_waypoint_index' => 6, // near end of route
            'direction' => 'backward',
        ]);

        Vehicle::create([
            'vehicle_code' => 'BUS-001',
            'vehicle_type' => 'bus',
            'route_id' => $route7->id,
            'current_waypoint_index' => 1,
            'direction' => 'forward',
        ]);
    }
}