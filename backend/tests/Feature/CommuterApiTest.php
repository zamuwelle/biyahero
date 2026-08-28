<?php

use App\Models\Destination;
use App\Models\Trip;
use App\Models\Vehicle;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Feature tests must not depend on a public routing host. OSRM is faked to
    // fail so seeding falls back to the hand-placed control points, which makes
    // corridor results deterministic. RouteGeometry itself is unit-tested with a
    // canned OSRM response in tests/Unit.
    Http::fake(['router.project-osrm.org/*' => Http::response(null, 503)]);

    // Nothing here may touch the network: an unfaked URL is executed for
    // real by Laravel's partial fake, which once let a live Nominatim
    // lookup decide a test's outcome.
    Http::preventStrayRequests();

    $this->seed(DatabaseSeeder::class);
});

/*
 * The product rule these tests exist to defend: the app never learns where the
 * commuter is. Anything that would require a commuter position — a distance, an
 * ETA, a radius — must stay absent from the API. If one of these fails, someone
 * has reintroduced the location dependency the design deliberately removed.
 */

it('never returns a distance or an ETA to the commuter', function () {
    $payload = $this->getJson('/api/active-vehicles')->assertOk()->json();

    // Walk every key in the response — a substring check would trip over "meta".
    $keys = [];
    $walk = function ($node) use (&$walk, &$keys) {
        foreach ((array) $node as $key => $value) {
            if (is_string($key)) {
                $keys[] = $key;
            }
            if (is_array($value)) {
                $walk($value);
            }
        }
    };
    $walk($payload);

    $forbidden = ['distance_km', 'distance', 'eta', 'eta_minutes', 'predicted_eta_minutes', 'predicted_travel_time_minutes'];

    expect(array_intersect($forbidden, $keys))->toBeEmpty();
});

it('ignores any commuter position passed to it', function () {
    $withPosition = $this->getJson('/api/active-vehicles?lat=14.55&lng=121.02&radius_km=2')->assertOk();
    $without = $this->getJson('/api/active-vehicles')->assertOk();

    // Same result either way — the parameters are simply not part of the query.
    expect($withPosition->json('meta.count'))->toBe($without->json('meta.count'));
});

it('lists every active vehicle when no destination is given', function () {
    $this->getJson('/api/active-vehicles')
        ->assertOk()
        ->assertJsonPath('meta.count', 12);
});

it('matches routes that pass the destination, nearest-passing first', function () {
    $response = $this->getJson('/api/active-vehicles?destination=Baclaran')->assertOk();

    expect($response->json('meta.corridor_radius_m'))->toBe(1500)
        ->and($response->json('data'))->not->toBeEmpty();

    // The corridor asks "does this route PASS the place", so every match must
    // report how close it actually runs — and the closest must lead.
    $distances = array_column($response->json('data'), 'passes_within_m');

    $sorted = $distances;
    sort($sorted);

    expect($distances)->toBe($sorted)
        ->and(max($distances))->toBeLessThanOrEqual(1500);
});

it('filters against the exact place the commuter picked, not a re-guessed name', function () {
    // No geocoder call is allowed to happen: the coordinates came with the
    // request, so a stray lookup would mean the server re-guessed the name.
    Http::preventStrayRequests();

    $taft = Destination::query()->where('name', 'Taft Avenue')->firstOrFail();

    $response = $this->getJson(sprintf(
        '/api/active-vehicles?destination=%s&dest_lat=%s&dest_lng=%s',
        rawurlencode('Some Place The Table Never Heard Of'),
        $taft->lat,
        $taft->lng
    ))->assertOk();

    expect($response->json('data'))->not->toBeEmpty()
        ->and($response->json('meta.destination'))->toBe('Some Place The Table Never Heard Of')
        ->and($response->json('meta.destination_position.lat'))->toBe((float) $taft->lat);
});

it('points the route label the way the trip is actually running', function () {
    $trip = Trip::query()->active()->with('route')->firstOrFail();
    $waypoints = $trip->route->waypoints;
    $start = $waypoints[0];
    $end = $waypoints[count($waypoints) - 1];

    $outbound = $trip->route->label;
    [$from, $to] = array_map('trim', preg_split('/→/u', $outbound));

    // Heading to the far end: the stored label already reads correctly.
    $trip->update(['destination' => $to, 'dest_lat' => $end['lat'], 'dest_lng' => $end['lng']]);

    $this->getJson("/api/active-vehicles/{$trip->vehicle_id}")
        ->assertOk()
        ->assertJsonPath('data.route.label', $outbound);

    // Turned around at the terminal: the SAME route row, driven back. The
    // label must not now contradict the destination printed above it.
    $trip->update(['destination' => $from, 'dest_lat' => $start['lat'], 'dest_lng' => $start['lng']]);

    $this->getJson("/api/active-vehicles/{$trip->vehicle_id}")
        ->assertOk()
        ->assertJsonPath('data.route.label', "{$to} → {$from}");
});

it('never lets a stale vehicle head a destination search', function () {
    // RMV 5520 is seeded two hours stale on a Baclaran corridor; a live vehicle
    // shares that exact route, so the two tie on passing distance.
    $rows = collect($this->getJson('/api/active-vehicles?destination=Baclaran')->assertOk()->json('data'));

    $stale = $rows->search(fn (array $v) => $v['is_stale'] === true);
    $live = $rows->search(fn (array $v) => $v['is_stale'] === false);

    expect($stale)->not->toBeFalse()
        ->and($live)->not->toBeFalse()
        // Nearest-passing orders the list, but never above a ride you can catch.
        ->and($live)->toBeLessThan($stale);
});

it('reports where the searched place sits so the app can pin it', function () {
    $baclaran = Destination::query()->where('name', 'Baclaran')->firstOrFail();

    $this->getJson('/api/active-vehicles?destination=Baclaran')
        ->assertOk()
        ->assertJsonPath('meta.destination_position.lat', (float) $baclaran->lat)
        ->assertJsonPath('meta.destination_position.lng', (float) $baclaran->lng);
});

it('finds rides that merely PASS a place nobody is bound for', function () {
    // SM City Clark is not a destination Biyahero knows, and no seeded trip is
    // headed there — but a route runs past it, which is the whole point.
    Http::fake(['nominatim.openstreetmap.org/*' => Http::response([
        ['lat' => '14.5636', 'lon' => '120.9944', 'display_name' => 'Some Mall, Pasay, Metro Manila, Philippines'],
    ])]);

    $response = $this->getJson('/api/active-vehicles?destination=Some%20Mall')->assertOk();

    expect($response->json('data'))->not->toBeEmpty();

    foreach ($response->json('data') as $vehicle) {
        // Nothing is bound FOR it; they only pass it.
        expect($vehicle['destination'])->not->toBe('Some Mall')
            ->and($vehicle['passes_within_m'])->toBeLessThanOrEqual(1500);
    }
});

it('pins where each trip is headed, using the destination table not the route end', function () {
    // Sentinel position: the seeded routes end exactly on the seeded Baclaran
    // coordinates, so without this move a route-end implementation would pass
    // this test by coincidence. Nowhere near any route end.
    Destination::query()->where('name', 'Baclaran')->firstOrFail()
        ->update(['lat' => 14.60000, 'lng' => 121.10000]);

    $response = $this->getJson('/api/active-vehicles')->assertOk();

    $bound = collect($response->json('data'))->where('destination', 'Baclaran');
    expect($bound)->not->toBeEmpty();

    foreach ($bound as $vehicle) {
        expect($vehicle['destination_position'])->toBe(['lat' => 14.6, 'lng' => 121.1]);
    }
});

it('pins a free-typed trip destination via a contains match, like the trip and search paths', function () {
    $trip = Trip::query()->active()->firstOrFail();
    // Drivers type destinations freehand: "Taft" must still pin "Taft Avenue".
    $trip->update(['destination' => 'Taft']);

    $taft = Destination::query()->where('name', 'Taft Avenue')->firstOrFail();

    $this->getJson("/api/active-vehicles/{$trip->vehicle_id}")
        ->assertOk()
        ->assertJsonPath('data.destination_position.lat', (float) $taft->lat)
        ->assertJsonPath('data.destination_position.lng', (float) $taft->lng);
});

it('returns a null destination pin for a destination name it does not know', function () {
    $trip = Trip::query()->active()->firstOrFail();
    $trip->update(['destination' => 'Kung Saan-Saan Lang']);

    $this->getJson("/api/active-vehicles/{$trip->vehicle_id}")
        ->assertOk()
        ->assertJsonPath('data.destination_position', null);
});

it('returns nothing for an unknown destination rather than falling back to everything', function () {
    // Nothing on the map by this name either.
    Http::fake(['nominatim.openstreetmap.org/*' => Http::response([], 200)]);

    // The dangerous failure mode: a typo silently showing all 12 vehicles as if
    // they all served the typed place.
    $this->getJson('/api/active-vehicles?destination=Narnia')
        ->assertOk()
        ->assertJsonPath('data', [])
        ->assertJsonPath('meta.resolved', false);
});

it('filters by vehicle class', function () {
    $response = $this->getJson('/api/active-vehicles?vehicle_type=bus')->assertOk();

    expect($response->json('data'))->not->toBeEmpty();

    foreach ($response->json('data') as $vehicle) {
        expect($vehicle['vehicle_type'])->toBe('bus');
    }
});

it('rejects a vehicle class that is not one of the four PH classes', function () {
    $this->getJson('/api/active-vehicles?vehicle_type=tricycle')
        ->assertStatus(422);
});

it('marks a vehicle stale and forces its capacity to unknown once the ping ages out', function () {
    $vehicle = Vehicle::where('plate_number', 'RMV 5520')->firstOrFail();

    // Seeded two hours stale, but its trip still claims a real capacity.
    expect(Trip::where('vehicle_id', $vehicle->id)->value('capacity'))->not->toBe('open');

    $response = $this->getJson('/api/active-vehicles')->assertOk();
    $stale = collect($response->json('data'))->firstWhere('plate_number', 'RMV 5520');

    expect($stale['is_stale'])->toBeTrue()
        ->and($stale['capacity'])->toBe('unknown')
        ->and($stale['minutes_since_ping'])->toBeGreaterThan(2);
});

it('reports a fresh ping as live', function () {
    $fresh = collect($this->getJson('/api/active-vehicles')->json('data'))
        ->firstWhere('plate_number', 'NCR 8842');

    expect($fresh['is_stale'])->toBeFalse()
        ->and($fresh['minutes_since_ping'])->toBe(0)
        ->and($fresh['current_street'])->toBe('Taft Ave');
});

it('shows the driver only by short name and never exposes the licence', function () {
    $vehicle = collect($this->getJson('/api/active-vehicles')->json('data'))
        ->firstWhere('plate_number', 'NCR 8842');

    expect($vehicle['driver']['name'])->toBe('Roberto S.')
        ->and($vehicle['driver'])->not->toHaveKey('license_no')
        ->and($vehicle['driver'])->not->toHaveKey('license_hash')
        ->and($vehicle['driver'])->not->toHaveKey('phone');
});

it('counts active vehicles per destination without any commuter position', function () {
    $response = $this->getJson('/api/destinations')->assertOk();

    $baclaran = collect($response->json('data'))->firstWhere('name', 'Baclaran');

    expect($baclaran['active_count'])->toBe(7)
        ->and($baclaran['subtitle'])->toBe('LRT-1 Baclaran Station');
});

it('searches destinations by partial name', function () {
    $response = $this->getJson('/api/destinations?q=bacl')->assertOk();

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.name'))->toBe('Baclaran');
});
