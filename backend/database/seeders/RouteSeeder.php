<?php

namespace Database\Seeders;

use App\Models\Route;
use App\Services\RouteGeometry;
use Illuminate\Database\Seeder;

/**
 * Real Metro Manila corridors.
 *
 * Only the ANCHORS are hand-placed. The polyline the app draws is snapped to
 * real roads by OSRM at seed time, and the distance/duration come back from the
 * same call — so no number here is estimated or invented. If OSRM is
 * unreachable the seeder falls back to the anchors and flags road_matched=false,
 * which the UI can then be honest about.
 */
class RouteSeeder extends Seeder
{
    public function run(): void
    {
        $geometry = app(RouteGeometry::class);

        $routes = [
            [
                'name' => 'Buendia — Taft — Baclaran',
                'label' => 'Buendia → Baclaran',
                'control_points' => [
                    ['lat' => 14.5540, 'lng' => 120.9976], // Gil Puyat / Buendia LRT
                    ['lat' => 14.5455, 'lng' => 120.9969], // Taft Ave
                    ['lat' => 14.5340, 'lng' => 120.9967], // LRT-1 Baclaran
                ],
            ],
            [
                'name' => 'Quiapo — Taft — Baclaran',
                'label' => 'Quiapo → Baclaran',
                'control_points' => [
                    ['lat' => 14.5985, 'lng' => 120.9838], // Quiapo
                    ['lat' => 14.5636, 'lng' => 120.9944], // Taft Ave / Vito Cruz
                    ['lat' => 14.5340, 'lng' => 120.9967], // Baclaran
                ],
            ],
            [
                'name' => 'Monumento — EDSA — Cubao',
                'label' => 'Monumento → Cubao',
                'control_points' => [
                    ['lat' => 14.6549, 'lng' => 120.9838], // Monumento
                    ['lat' => 14.6570, 'lng' => 120.9928], // EDSA Balintawak
                    ['lat' => 14.6199, 'lng' => 121.0533], // Araneta City, Cubao
                ],
            ],
            [
                'name' => 'Ayala — EDSA — Guadalupe',
                'label' => 'Ayala → Guadalupe',
                'control_points' => [
                    ['lat' => 14.5507, 'lng' => 121.0281], // Ayala
                    ['lat' => 14.5665, 'lng' => 121.0454], // Guadalupe
                ],
            ],
            [
                'name' => 'Alabang — Skyway — Buendia',
                'label' => 'Alabang → Buendia',
                'control_points' => [
                    ['lat' => 14.4197, 'lng' => 121.0409], // Alabang
                    ['lat' => 14.4700, 'lng' => 121.0300], // Skyway / Sucat
                    ['lat' => 14.5540, 'lng' => 120.9976], // Buendia
                ],
            ],
        ];

        foreach ($routes as $route) {
            $snapped = $geometry->snapToRoads($route['control_points']);

            Route::create([
                'name' => $route['name'],
                'label' => $route['label'],
                'control_points' => $route['control_points'],
                'waypoints' => $snapped['waypoints'],
                'length_km' => $snapped['length_km'],
                'duration_min' => $snapped['duration_min'],
                'road_matched' => $snapped['matched'],
            ]);

            $this->command?->line(sprintf(
                '  %-24s %5.2f km  %3d min  %s',
                $route['label'],
                $snapped['length_km'],
                $snapped['duration_min'],
                $snapped['matched'] ? 'road-matched' : 'STRAIGHT-LINE FALLBACK'
            ));
        }
    }
}
