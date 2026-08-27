<?php

namespace Database\Seeders;

use App\Models\Route;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Twelve registered drivers, one vehicle each — the "12 sasakyan aktibo ngayon"
 * the Map Home screen shows. Positions and ping ages are set by TripSeeder.
 */
class VehicleSeeder extends Seeder
{
    public function run(): void
    {
        $routes = Route::pluck('id', 'label');

        $fleet = [
            // Buendia → Baclaran
            ['Roberto Santos', '+639175550142', 'NCR 8842', 'jeepney', 'Sarao 2018', '214', 'Buendia → Baclaran', 4],
            ['Ernesto Cruz', '+639175550143', 'PLK 2290', 'jeepney', 'Sarao 2015', '108', 'Buendia → Baclaran', 7],
            ['Alfredo Lim', '+639175550144', 'BCL 5521', 'bus', 'Hino RK1J 2017', '52', 'Buendia → Baclaran', 11],
            // Quiapo → Baclaran
            ['Danilo Reyes', '+639175550145', 'QZN 1183', 'jeepney', 'Sarao 2019', '77', 'Quiapo → Baclaran', 2],
            ['Ramon Dela Cruz', '+639175550146', 'MLA 7734', 'ejeep', 'COMET 2021', '19', 'Quiapo → Baclaran', 3],
            // Monumento → Cubao
            ['Marlon Aquino', '+639175550147', 'DAN 4417', 'jeepney', 'Sarao 2016', '331', 'Monumento → Cubao', 9],
            ['Nestor Bautista', '+639175550148', 'TXB 9931', 'bus', 'Hino RN8J 2020', '14', 'Monumento → Cubao', 5],
            ['Jerome Pascual', '+639175550149', 'MNT 3390', 'uv_express', 'Toyota HiAce 2019', null, 'Monumento → Cubao', 6],
            // Ayala → Guadalupe
            ['Alberto Manalo', '+639175550150', 'EJP 0142', 'ejeep', 'COMET 2022', '23', 'Ayala → Guadalupe', 1],
            ['Rico Villanueva', '+639175550151', 'AYL 6628', 'jeepney', 'Sarao 2014', '412', 'Ayala → Guadalupe', 12],
            // Alabang → Buendia
            ['Edgardo Tan', '+639175550152', 'RMV 5520', 'uv_express', 'Toyota HiAce 2018', null, 'Alabang → Buendia', 8],
            ['Fernando Ocampo', '+639175550153', 'ALB 8802', 'bus', 'Hino RK8J 2019', '61', 'Alabang → Buendia', 10],
        ];

        foreach ($fleet as [$name, $phone, $plate, $type, $model, $body, $routeLabel, $years]) {
            $driver = User::create([
                'name' => $name,
                'phone' => $phone,
                'license_hash' => Hash::make('N01-'.substr($phone, -6)),
                'is_verified' => true,
                'verification_status' => 'approved',
                'years_on_route' => $years,
                'total_trips' => $years * 320,
                'on_time_rate' => 88 + ($years % 9),
            ]);

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
