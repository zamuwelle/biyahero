<?php

namespace Database\Seeders;

use App\Models\Route;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

/**
 * The provincial demo fleets: the Victoria–Tarlac corridor (where the team
 * actually lives and tests) and the two Angeles corridors passing the
 * Cloudstaff SkyClub hackathon venue. Kept OUT of DatabaseSeeder on purpose —
 * feature tests pin exact fleet counts against the Manila seed.
 *
 * Idempotent: routes already present (by label) are skipped, so it is safe
 * to run on every deploy:  php artisan db:seed --class=DemoFleetSeeder
 */
class DemoFleetSeeder extends Seeder
{
    private const ROUTES = [
        [
            'label' => "Victoria \u{2192} Tarlac City",
            'points' => ['15.57708,120.68125', '15.48612,120.58935'],
            'destination' => 'Tarlac City',
            'vehicles' => 3,
        ],
        [
            'label' => "Tarlac City \u{2192} Victoria",
            'points' => ['15.48612,120.58935', '15.57708,120.68125'],
            'destination' => 'Victoria',
            'vehicles' => 2,
        ],
        [
            'label' => "Nepo Mall \u{2192} Dau Terminal",
            'points' => ['15.13505,120.58855', '15.17820,120.58925'],
            'destination' => 'Dau Terminal',
            'vehicles' => 3,
        ],
        [
            'label' => "Holy Angel \u{2192} Marquee Mall",
            'points' => ['15.13252,120.59019', '15.16370,120.61020'],
            'destination' => 'Marquee Mall',
            'vehicles' => 2,
        ],
    ];

    public function run(): void
    {
        foreach (self::ROUTES as $route) {
            if (Route::query()->where('label', $route['label'])->exists()) {
                $this->command?->line("Skipping existing route: {$route['label']}");

                continue;
            }

            Artisan::call('biyahero:add-route', [
                'label' => $route['label'],
                'points' => $route['points'],
                '--destination' => $route['destination'],
                '--vehicles' => $route['vehicles'],
            ]);

            $this->command?->line("Created: {$route['label']} ({$route['vehicles']} vehicles)");
        }
    }
}
