<?php

namespace Database\Seeders;

use App\Models\Destination;
use Illuminate\Database\Seeder;

/**
 * The searchable places. These are matched against route polylines within a
 * 400 m corridor — they are NOT stops, and nothing here depends on where the
 * commuter is standing.
 */
class DestinationSeeder extends Seeder
{
    public function run(): void
    {
        $destinations = [
            ['name' => 'Baclaran', 'subtitle' => 'LRT-1 Baclaran Station', 'lat' => 14.5340, 'lng' => 120.9967, 'is_popular' => true],
            ['name' => 'Monumento', 'subtitle' => 'Caloocan · EDSA', 'lat' => 14.6549, 'lng' => 120.9838, 'is_popular' => true],
            ['name' => 'Cubao', 'subtitle' => 'Araneta City, Quezon City', 'lat' => 14.6199, 'lng' => 121.0533, 'is_popular' => true],
            ['name' => 'Taft Avenue', 'subtitle' => 'Vito Cruz, Manila', 'lat' => 14.5636, 'lng' => 120.9944, 'is_popular' => true],
            ['name' => 'Alabang', 'subtitle' => 'Muntinlupa', 'lat' => 14.4197, 'lng' => 121.0409, 'is_popular' => true],
            ['name' => 'Buendia', 'subtitle' => 'Gil Puyat, Makati', 'lat' => 14.5540, 'lng' => 120.9976, 'is_popular' => false],
            ['name' => 'Ayala', 'subtitle' => 'Makati CBD', 'lat' => 14.5507, 'lng' => 121.0281, 'is_popular' => false],
            ['name' => 'Guadalupe', 'subtitle' => 'EDSA, Makati', 'lat' => 14.5665, 'lng' => 121.0454, 'is_popular' => false],
            ['name' => 'Quiapo', 'subtitle' => 'Manila', 'lat' => 14.5985, 'lng' => 120.9838, 'is_popular' => false],
        ];

        foreach ($destinations as $destination) {
            Destination::create($destination);
        }
    }
}
