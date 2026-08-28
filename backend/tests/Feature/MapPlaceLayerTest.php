<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

/**
 * Biyahero draws its own place layer because the Google Maps Android SDK will
 * not: a custom map style applies to the plain map type only, so satellite and
 * terrain came back with a different, much thinner set of labels and the three
 * layers disagreed about what exists. These tests pin the contract that layer
 * depends on — the same places, from our own data, every time.
 */
beforeEach(function () {
    // An unfaked URL is executed for real by Laravel's partial fake, which
    // once let a live lookup decide a test's outcome.
    Http::preventStrayRequests();
});

/** One Overpass answer covering a node, a way-with-center, and the junk rows. */
function overpassFake(): void
{
    Http::fake([
        'overpass-api.de/*' => Http::response([
            'elements' => [
                // A shop mapped as a building outline: the point is in `center`.
                ['type' => 'way', 'id' => 11, 'center' => ['lat' => 15.571, 'lon' => 120.679],
                    'tags' => ['name' => 'SM Victoria', 'shop' => 'mall']],
                ['type' => 'node', 'id' => 12, 'lat' => 15.572, 'lon' => 120.680,
                    'tags' => ['name' => 'Victoria Jeepney Terminal', 'amenity' => 'bus_station']],
                ['type' => 'node', 'id' => 13, 'lat' => 15.573, 'lon' => 120.681,
                    'tags' => ['name' => 'Aling Nena Bakery', 'shop' => 'bakery']],
                // No name: unplaceable on a map, and must not reach the client.
                ['type' => 'node', 'id' => 14, 'lat' => 15.574, 'lon' => 120.682,
                    'tags' => ['amenity' => 'pharmacy']],
                // A tag we do not draw.
                ['type' => 'node', 'id' => 15, 'lat' => 15.575, 'lon' => 120.683,
                    'tags' => ['name' => 'Some Bench', 'amenity' => 'bench']],
            ],
        ]),
    ]);
}

it('draws the places inside a viewport, most useful first', function () {
    overpassFake();

    $rows = $this->getJson('/api/places/nearby?south=15.56&west=120.67&north=15.59&east=120.70')
        ->assertOk()
        ->json('data');

    // A JSON list, not an object keyed by row index — the app maps over it.
    expect(array_is_list($rows))->toBeTrue()
        // The terminal outranks the mall, which outranks the bakery. A jeepney
        // terminal is the whole point of the app; a bakery is scenery.
        ->and(array_column($rows, 'name'))->toBe([
            'Victoria Jeepney Terminal',
            'SM Victoria',
            'Aling Nena Bakery',
        ])
        ->and(array_column($rows, 'kind'))->toBe(['terminal', 'store', 'food'])
        // A way carries its point in `center`; it must arrive placed like a node.
        ->and($rows[1]['lat'])->toBe(15.571)
        ->and($rows[1]['lng'])->toBe(120.679)
        // Stable enough to be a React key across two overlapping viewports.
        ->and($rows[1]['id'])->toBe('way/11');
});

it('asks Overpass once for a neighbourhood, however the map is nudged', function () {
    overpassFake();

    $this->getJson('/api/places/nearby?south=15.56&west=120.67&north=15.59&east=120.70')->assertOk();
    // A viewport shifted by metres snaps to the same grid square, so a drag
    // across town must not spend a request per settle.
    $this->getJson('/api/places/nearby?south=15.561&west=120.671&north=15.589&east=120.699')->assertOk();

    Http::assertSentCount(1);
});

it('refuses a viewport too wide to be about anywhere', function () {
    // No fake at all: a province-sized box must be turned away before it
    // becomes a request Overpass would throttle us for.
    $rows = $this->getJson('/api/places/nearby?south=14.0&west=120.0&north=15.5&east=121.5')
        ->assertOk()
        ->json('data');

    expect($rows)->toBe([]);
});

it('keeps a map that loads over a map with pins', function () {
    Http::fake(['overpass-api.de/*' => Http::response(null, 504)]);

    $this->getJson('/api/places/nearby?south=15.56&west=120.67&north=15.59&east=120.70')
        ->assertOk()
        ->assertJson(['data' => []]);
});

it('needs all four corners of the viewport', function () {
    $this->getJson('/api/places/nearby?south=15.56&west=120.67')->assertUnprocessable();
    $this->getJson('/api/places/nearby?south=15.56&west=120.67&north=99&east=120.70')->assertUnprocessable();
});

it('takes a viewport from anyone, because a viewport is not a person', function () {
    overpassFake();

    // Public on purpose. These are the corners of what is on screen, which the
    // commuter chose by dragging the map — never where their device is.
    $this->getJson('/api/places/nearby?south=15.56&west=120.67&north=15.59&east=120.70')->assertOk();
});
