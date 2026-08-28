<?php

use App\Http\Controllers\ActiveVehicleController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DestinationController;
use App\Http\Controllers\EtaController;
use App\Http\Controllers\PlaceController;
use App\Http\Controllers\TripController;
use App\Http\Controllers\VehicleController;
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

// Commuter type-ahead. Deliberately position-free: candidates are ranked by
// how close they sit to routes the fleet is actually running.
Route::get('/places/suggest', [PlaceController::class, 'suggest'])->middleware('throttle:40,1');

Route::get('/routes/for-destination', function (Request $request, CorridorMatcher $corridor) {
    $validated = $request->validate(['destination' => 'required|string|max:120']);

    $place = Destination::query()
        ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($validated['destination']).'%'])
        ->first();

    if (! $place) {
        return response()->json(['data' => null]);
    }

    // The driver's own preview: same tight rule the trip resolver uses.
    $ids = $corridor->routeIdsNear($place->lat, $place->lng, CorridorMatcher::SERVES_RADIUS_M);
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
    // whereNumber keeps this from swallowing /routes/nearby (the driver-side
    // proximity listing registered behind auth below).
})->whereNumber('id');

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
    Route::get('/trips/history', [TripController::class, 'history']);
    Route::patch('/vehicle', [VehicleController::class, 'update']);
    Route::get('/trips/summary', [TripController::class, 'summary']);
    Route::post('/trips', [TripController::class, 'store']);
    Route::patch('/trips/{trip}/route', [TripController::class, 'reroute']);
    Route::patch('/trips/{trip}/capacity', [TripController::class, 'updateCapacity']);

    Route::get('/places/search', [PlaceController::class, 'search']);
    Route::get('/routes/recent', [TripController::class, 'recentRoutes']);

    // Driver-facing: which routes pass near where I am standing? Lives behind
    // auth on purpose — no commuter-side code may ever send a position.
    Route::get('/routes/nearby', function (Request $request, CorridorMatcher $corridor) {
        $validated = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
        ]);

        $nearby = Routes::query()
            ->get(['id', 'label', 'length_km', 'waypoints'])
            ->map(fn (Routes $route) => [
                'route' => $route,
                'distance_m' => $corridor->minDistanceToRoute((float) $validated['lat'], (float) $validated['lng'], $route->waypoints ?? []),
            ])
            ->filter(fn (array $x) => $x['distance_m'] <= 1500)
            ->sortBy('distance_m')
            ->take(6)
            ->values()
            ->map(fn (array $x) => [
                'id' => $x['route']->id,
                'label' => $x['route']->label,
                'length_km' => $x['route']->length_km,
                // AddRoute and the resolver both name routes "Start → End".
                'destination' => trim(last(preg_split('/→|->/u', $x['route']->label ?? ''))),
                'distance_m' => (int) round($x['distance_m']),
            ]);

        return response()->json(['data' => $nearby]);
    });
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
    // The provincial demo fleets (Victoria–Tarlac + the Angeles venue
    // corridors) live outside DatabaseSeeder because tests pin fleet counts.
    Artisan::call('db:seed', ['--class' => 'DemoFleetSeeder', '--force' => true]);

    return response()->json(['status' => 'Database reset and reseeded']);
});

Route::get('/debug/vehicles', fn () => Vehicle::with('activeTrip')->get());
