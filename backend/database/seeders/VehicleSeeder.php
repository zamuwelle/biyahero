<?php

namespace Database\Seeders;

use App\Models\Route;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\LicenceIdentity;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Twelve already-verified drivers — the "12 sasakyan aktibo ngayon" the Map
 * Home screen shows.
 *
 * These represent drivers approved some time ago, so they are created with
 * verification_status=approved directly. That is the ONE thing the seeder
 * asserts; every statistic about them is derived from real trip rows written by
 * TripSeeder, and their time-on-route comes from a backdated created_at rather
 * than a made-up number.
 */
class VehicleSeeder extends Seeder
{
    public function run(): void
    {
        $routes = Route::pluck('id', 'label');
        $identity = app(LicenceIdentity::class);

        // name, phone, plate, type, model, body, route, years driving
        $fleet = [
            ['Roberto Santos', '+639175550142', 'NCR 8842', 'jeepney', 'Sarao 2018', '214', 'Buendia → Baclaran', 4],
            ['Ernesto Cruz', '+639175550143', 'PLK 2290', 'jeepney', 'Sarao 2015', '108', 'Buendia → Baclaran', 7],
            ['Alfredo Lim', '+639175550144', 'BCL 5521', 'bus', 'Hino RK1J 2017', '52', 'Buendia → Baclaran', 11],
            ['Danilo Reyes', '+639175550145', 'QZN 1183', 'jeepney', 'Sarao 2019', '77', 'Quiapo → Baclaran', 2],
            ['Ramon Dela Cruz', '+639175550146', 'MLA 7734', 'ejeep', 'COMET 2021', '19', 'Quiapo → Baclaran', 3],
            ['Marlon Aquino', '+639175550147', 'DAN 4417', 'jeepney', 'Sarao 2016', '331', 'Monumento → Cubao', 9],
            ['Nestor Bautista', '+639175550148', 'TXB 9931', 'bus', 'Hino RN8J 2020', '14', 'Monumento → Cubao', 5],
            ['Jerome Pascual', '+639175550149', 'MNT 3390', 'uv_express', 'Toyota HiAce 2019', null, 'Monumento → Cubao', 6],
            ['Alberto Manalo', '+639175550150', 'EJP 0142', 'ejeep', 'COMET 2022', '23', 'Ayala → Guadalupe', 1],
            ['Rico Villanueva', '+639175550151', 'AYL 6628', 'jeepney', 'Sarao 2014', '412', 'Ayala → Guadalupe', 12],
            ['Edgardo Tan', '+639175550152', 'RMV 5520', 'uv_express', 'Toyota HiAce 2018', null, 'Alabang → Buendia', 8],
            ['Fernando Ocampo', '+639175550153', 'ALB 8802', 'bus', 'Hino RK8J 2019', '61', 'Alabang → Buendia', 10],
        ];

        foreach ($fleet as $i => [$name, $phone, $plate, $type, $model, $body, $routeLabel, $years]) {
            // Real 3-2-6 shape, so these accounts log in through exactly the
            // same licence + plate path a registered driver uses.
            $licence = sprintf('N01-19-%06d', 100000 + $i);

            $driver = User::create([
                'name' => $name,
                'phone' => $phone,
                'license_hash' => Hash::make($licence),
                'license_lookup' => $identity->blindIndex($licence),
                'license_expires_at' => now()->addYears(3)->toDateString(),
                'is_verified' => true,
                'verification_status' => 'approved',
                'approved_at' => now()->subYears($years),
            ]);

            $this->command?->line(sprintf('  %-18s licence %s  plate %s', $name, $licence, $plate));

            // Backdate so yearsOnRoute() returns a real figure computed the same
            // way it will be for a driver who signs up today.
            $driver->forceFill(['created_at' => now()->subYears($years)])->save();

            Vehicle::create([
                'user_id' => $driver->id,
                'vehicle_code' => strtoupper(substr($type, 0, 4)).'-'.str_pad((string) $driver->id, 3, '0', STR_PAD_LEFT),
                'vehicle_type' => $type,
                'plate_number' => $plate,
                'model' => $model,
                'body_number' => $body,
                'route_id' => $routes[$routeLabel],
            ]);
        }
    }
}
