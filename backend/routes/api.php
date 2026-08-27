<?php

use App\Http\Controllers\ActiveVehicleController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DestinationController;
use App\Http\Controllers\EtaController;
use App\Http\Controllers\TripController;
use App\Models\Destination;
use App\Models\Route as Routes;
use App\Models\Vehicle;
use App\Services\CorridorMatcher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::get('test', fn () => 'wassup');

/*
|--------------------------------------------------------------------------
| Commuter — public, and deliberately position-free
|--------------------------------------------------------------------------
| None of these accept a commuter lat/lng. Filtering is by typed destination
| and vehicle class only, so the app never needs a location permission.
*/
Route::get('/active-vehicles', [ActiveVehicleController::class, 'index']);
Route::get('/active-vehicles/{vehicle}', [ActiveVehicleController::class, 'show']);
Route::get('/destinations', [DestinationController::class, 'index']);

Route::get('/routes/for-destination', function (Request $request, CorridorMatcher $corridor) {
    $validated = $request->validate(['destination' => 'required|string|max:120']);

    $place = Destination::query()
        ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($validated['destination']).'%'])
        ->first();

    if (! $place) {
        return response()->json(['data' => null]);
    }

    $ids = $corridor->routeIdsNear($place->lat, $place->lng);
    $route = $ids ? Routes::find($ids[0]) : null;

    return response()->json(['data' => $route]);
});

Route::get('/routes/{id}', function ($id) {
    $route = Routes::findOrFail($id);

    return response()->json([
        'id' => $route->id,
        'name' => $route->name,
        'label' => $route->label,
        'length_km' => $route->length_km,
        'waypoints' => $route->waypoints,
    ]);
});

/*
|--------------------------------------------------------------------------
| Driver — authenticated
|--------------------------------------------------------------------------
*/
Route::post('register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);

    Route::get('/trips/current', [TripController::class, 'current']);
    Route::get('/trips/summary', [TripController::class, 'summary']);
    Route::post('/trips', [TripController::class, 'store']);
    Route::patch('/trips/{trip}/capacity', [TripController::class, 'updateCapacity']);
    Route::post('/trips/{trip}/ping', [TripController::class, 'ping']);
    Route::post('/trips/{trip}/end', [TripController::class, 'end']);
});

/*
|--------------------------------------------------------------------------
| ETA — driver-facing only
|--------------------------------------------------------------------------
| Used for the driver's own "tinatayang 34 min" route preview. It is never
| surfaced to a commuter as an arrival time, because that would require
| knowing where the commuter is standing.
*/
Route::post('/eta', [EtaController::class, 'index']);

/*
|--------------------------------------------------------------------------
| Debug
|--------------------------------------------------------------------------
*/
Route::get('/debug/fresh-seed', function () {
    Artisan::call('migrate:fresh', ['--force' => true]);
    Artisan::call('db:seed', ['--class' => 'DatabaseSeeder', '--force' => true]);

    return response()->json(['status' => 'Database reset and reseeded']);
});

Route::get('/debug/vehicles', fn () => Vehicle::with('activeTrip')->get());
