<?php

namespace Database\Seeders;

use App\Models\Route;
use App\Services\CorridorMatcher;
use Illuminate\Database\Seeder;

/**
 * Real Metro Manila corridors. The polylines matter more than usual here: the
 * commuter search is a 400 m corridor match against these waypoints, so a route
 * has to actually pass its destinations for the demo to behave.
 */
class RouteSeeder extends Seeder
{
    public function run(): void
    {
        $corridor = new CorridorMatcher;

        $routes = [
            [
                'name' => 'Buendia — Taft — Baclaran',
                'label' => 'Buendia → Baclaran',
                // Straight down Taft. Latitude descends the whole way — Vito Cruz
                // sits NORTH of Buendia, so it is not on this leg.
                'waypoints' => [
                    ['lat' => 14.5540, 'lng' => 120.9976], // Gil Puyat / Buendia LRT
                    ['lat' => 14.5498, 'lng' => 120.9971],
                    ['lat' => 14.5455, 'lng' => 120.9969],
                    ['lat' => 14.5415, 'lng' => 120.9968],
                    ['lat' => 14.5378, 'lng' => 120.9967],
                    ['lat' => 14.5340, 'lng' => 120.9967], // LRT-1 Baclaran
                ],
            ],
            [
                'name' => 'Quiapo — Taft — Baclaran',
                'label' => 'Quiapo → Baclaran',
                'waypoints' => [
                    ['lat' => 14.5985, 'lng' => 120.9838], // Quiapo
                    ['lat' => 14.5890, 'lng' => 120.9862],
                    ['lat' => 14.5790, 'lng' => 120.9896],
                    ['lat' => 14.5700, 'lng' => 120.9925],
                    ['lat' => 14.5636, 'lng' => 120.9944], // Taft Ave / Vito Cruz
                    ['lat' => 14.5540, 'lng' => 120.9958],
                    ['lat' => 14.5440, 'lng' => 120.9965],
                    ['lat' => 14.5340, 'lng' => 120.9967], // Baclaran
                ],
            ],
            [
                'name' => 'Monumento — EDSA — Cubao',
                'label' => 'Monumento → Cubao',
                'waypoints' => [
                    ['lat' => 14.6549, 'lng' => 120.9838], // Monumento
                    ['lat' => 14.6570, 'lng' => 120.9928], // EDSA Balintawak
                    ['lat' => 14.6520, 'lng' => 121.0080],
                    ['lat' => 14.6420, 'lng' => 121.0250],
                    ['lat' => 14.6320, 'lng' => 121.0390],
                    ['lat' => 14.6250, 'lng' => 121.0470],
                    ['lat' => 14.6199, 'lng' => 121.0533], // Araneta City, Cubao
                ],
            ],
            [
                'name' => 'Ayala — EDSA — Guadalupe',
                'label' => 'Ayala → Guadalupe',
                'waypoints' => [
                    ['lat' => 14.5507, 'lng' => 121.0281], // Ayala
                    ['lat' => 14.5545, 'lng' => 121.0330],
                    ['lat' => 14.5590, 'lng' => 121.0380],
                    ['lat' => 14.5630, 'lng' => 121.0420],
                    ['lat' => 14.5665, 'lng' => 121.0454], // Guadalupe
                ],
            ],
            [
                'name' => 'Alabang — Skyway — Buendia',
                'label' => 'Alabang → Buendia',
                'waypoints' => [
                    ['lat' => 14.4197, 'lng' => 121.0409], // Alabang
                    ['lat' => 14.4450, 'lng' => 121.0360],
                    ['lat' => 14.4700, 'lng' => 121.0300], // Skyway / Sucat
                    ['lat' => 14.5100, 'lng' => 121.0150],
                    ['lat' => 14.5400, 'lng' => 121.0020],
                    ['lat' => 14.5540, 'lng' => 120.9976], // Buendia
                ],
            ],
        ];

        foreach ($routes as $route) {
            Route::create([
                ...$route,
                'length_km' => $corridor->routeLengthKm($route['waypoints']),
            ]);
        }
    }
}
