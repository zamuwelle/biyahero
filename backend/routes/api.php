<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RadarController;
use App\Http\Controllers\EtaController;
use App\Http\Controllers\CommuterRadarController;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use App\Models\Route as Routes;
use App\Models\Vehicle;

Route::get('test', fn() => 'wassup');
Route::post('register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
	Route::post('logout', [AuthController::class, 'logout']);
	Route::get('me', fn() => request()->user());
});

Route::post('/radar', [RadarController::class, 'index']);
Route::post('/eta', [EtaController::class, 'index']);
Route::post('/commuter-radar', [CommuterRadarController::class, 'index']);

Route::get('/routes/{id}', function ($id) {
    $route = Routes::findOrFail($id);
    return response()->json([
        'id' => $route->id,
        'name' => $route->name,
        'waypoints' => $route->waypoints,
    ]);
});

Route::post('/vehicles/{id}/update-location', function (Request $request, $id) {
    $validated = $request->validate([
        'lat' => 'required|numeric|between:-90,90',
        'lng' => 'required|numeric|between:-180,180',
    ]);

    $vehicle = Vehicle::findOrFail($id);
    $vehicle->live_lat = $validated['lat'];
    $vehicle->live_lng = $validated['lng'];
    $vehicle->save();

    Log::info("[DRIVER GPS] {$vehicle->vehicle_code} → ({$validated['lat']}, {$validated['lng']})");

    return response()->json([
        'status' => 'updated',
        'vehicle_code' => $vehicle->vehicle_code,
        'position' => ['lat' => $vehicle->live_lat, 'lng' => $vehicle->live_lng],
    ]);
});

//test
Route::get('/debug/vehicles', function () {
    return \App\Models\Vehicle::all(['id', 'vehicle_code', 'live_lat', 'live_lng', 'current_waypoint_index']);
});