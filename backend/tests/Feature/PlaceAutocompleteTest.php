<?php

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/**
 * Google Places answers the driver's destination box, and only that box.
 *
 * It is here for one reason: OpenStreetMap does not know small businesses. An
 * exhaustive country-wide search for "Siowings" returned three, none of them
 * the branches a driver can actually name. Everything else in the app stays on
 * OpenStreetMap, and so does this the moment the key is missing or the quota
 * is gone — a search that has stopped working is worse than one that only
 * knows towns.
 */
beforeEach(function () {
    // Route building during the seed is the only outbound call allowed here;
    // an unfaked URL is executed for real by Laravel's partial fake.
    Http::fake(['router.project-osrm.org/*' => Http::response(null, 503)]);
    Http::preventStrayRequests();

    config()->set('services.google.places_key', 'test-key');

    $this->seed(DatabaseSeeder::class);
});

const SESSION = '11111111-2222-4333-8444-555555555555';

function driverWithVehicle(): void
{
    Sanctum::actingAs(User::whereHas('vehicle')->firstOrFail());
}

/** One prediction, plus the category row Google mixes in with them. */
function placesFake(): void
{
    Http::fake([
        'places.googleapis.com/v1/places:autocomplete' => Http::response([
            'suggestions' => [
                [
                    'placePrediction' => [
                        'placeId' => 'ChIJsiowings',
                        'structuredFormat' => [
                            'mainText' => ['text' => 'Siowings-Apalit'],
                            'secondaryText' => ['text' => 'MacArthur Highway, Sampaloc, Apalit'],
                        ],
                        'distanceMeters' => 57000,
                    ],
                ],
                // A category search, not a place. A trip has to end somewhere.
                ['queryPrediction' => ['text' => ['text' => 'siowings near me']]],
            ],
        ]),
    ]);
}

it('answers the driver with places OpenStreetMap has never heard of', function () {
    driverWithVehicle();
    placesFake();

    $rows = $this->getJson('/api/places/search?q=siowings&lat=15.5771&lng=120.6813&session='.SESSION)
        ->assertOk()
        ->json('data');

    $siowings = collect($rows)->firstWhere('name', 'Siowings-Apalit');

    expect($siowings)->not->toBeNull()
        ->and($siowings['place_id'])->toBe('ChIJsiowings')
        // A prediction carries no point. That is what makes it cheap; the one
        // the driver picks gets resolved separately.
        ->and($siowings['lat'])->toBeNull()
        ->and($siowings['distance_m'])->toBe(57000)
        // The category row is not a destination.
        ->and(array_column($rows, 'name'))->not->toContain('siowings near me');
});

it('asks Google in the shape Google expects', function () {
    driverWithVehicle();
    placesFake();

    $this->getJson('/api/places/search?q=siowings&lat=15.5771&lng=120.6813&session='.SESSION)->assertOk();

    Http::assertSent(function ($request) {
        $body = $request->data();

        // Autocomplete spells the region filter as a LIST. Text Search wants a
        // single `regionCode`, and mixing the two up is a silent 400 that
        // looks exactly like "Google found nothing" — it cost us a whole
        // debugging session once already.
        return $body['includedRegionCodes'] === ['PH']
            && $body['sessionToken'] === SESSION
            // Without an origin the predictions come back with no distance.
            && $body['origin']['latitude'] === 15.5771
            && isset($body['locationBias']['circle']);
    });
});

it('falls back to OpenStreetMap when Google has nothing to say', function () {
    driverWithVehicle();

    Http::fake([
        'places.googleapis.com/*' => Http::response(['suggestions' => []]),
        'nominatim.openstreetmap.org/search*' => Http::response([
            ['name' => 'Bacolor', 'lat' => '14.9989', 'lon' => '120.6503', 'display_name' => 'Bacolor, Pampanga, Philippines'],
        ]),
    ]);

    $rows = $this->getJson('/api/places/search?q=bacolor&lat=15.5771&lng=120.6813&session='.SESSION)
        ->assertOk()
        ->json('data');

    expect(array_column($rows, 'name'))->toContain('Bacolor');
});

it('falls back to OpenStreetMap when the key is gone', function () {
    driverWithVehicle();
    config()->set('services.google.places_key', null);

    Http::fake(['nominatim.openstreetmap.org/search*' => Http::response([
        ['name' => 'Bacolor', 'lat' => '14.9989', 'lon' => '120.6503', 'display_name' => 'Bacolor, Pampanga, Philippines'],
    ])]);

    $rows = $this->getJson('/api/places/search?q=bacolor&lat=15.5771&lng=120.6813&session='.SESSION)
        ->assertOk()
        ->json('data');

    // A revoked key must degrade the search, never break it.
    expect(array_column($rows, 'name'))->toContain('Bacolor');
});

it('turns the prediction the driver picked into a point', function () {
    driverWithVehicle();

    Http::fake(['places.googleapis.com/v1/places/ChIJsiowings*' => Http::response([
        'displayName' => ['text' => 'Siowings-Apalit'],
        'formattedAddress' => 'MacArthur Highway, Apalit, Pampanga',
        'location' => ['latitude' => 14.95, 'longitude' => 120.76],
    ])]);

    $row = $this->getJson('/api/places/resolve?place_id=ChIJsiowings&session='.SESSION)
        ->assertOk()
        ->json('data');

    expect($row['lat'])->toBe(14.95)->and($row['lng'])->toBe(120.76);

    // The same token on both halves is what makes Google bill the search once
    // instead of billing every keystroke that led to it.
    Http::assertSent(fn ($request) => str_contains($request->url(), 'sessionToken='.SESSION));
});

it('admits when a prediction cannot be pinned down', function () {
    driverWithVehicle();

    Http::fake(['places.googleapis.com/*' => Http::response(null, 500)]);

    // No point means no route. The app asks the driver to pin it instead of
    // starting a trip that goes nowhere.
    $this->getJson('/api/places/resolve?place_id=ChIJbroken&session='.SESSION)
        ->assertOk()
        ->assertJson(['data' => null]);
});

it('never spends the budget on an unauthenticated caller', function () {
    Http::fake(['nominatim.openstreetmap.org/search*' => Http::response([])]);

    // Both the billed endpoints sit behind auth on purpose.
    $this->getJson('/api/places/search?q=siowings&session='.SESSION)->assertUnauthorized();
    $this->getJson('/api/places/resolve?place_id=ChIJx&session='.SESSION)->assertUnauthorized();

    // And the public commuter type-ahead stays on the free provider.
    $this->getJson('/api/places/suggest?q=siowings')->assertOk();

    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'places.googleapis.com'));
});
