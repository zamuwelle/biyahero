<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RouteSeeder::class,
            DestinationSeeder::class,
            VehicleSeeder::class,
            TripSeeder::class,
        ]);
    }
}
