<?php

use App\Models\Trip;
use App\Models\User;
use App\Services\LicenceIdentity;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

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
    Storage::fake('local');
});

function registerDriver(array $overrides = [])
{
    return test()->postJson('/api/register', array_merge([
        'name' => 'Juan Dela Cruz',
        'license_no' => 'N01-19-123456',
        'license_expires_at' => now()->addYears(2)->toDateString(),
        'license_photo' => UploadedFile::fake()->image('licence.jpg', 1200, 750),
        'vehicle_type' => 'jeepney',
        'plate_number' => 'tst 1234',
        'model' => 'Sarao 2020',
    ], $overrides));
}

it('registers with licence and plate, and needs no phone number', function () {
    $response = registerDriver()->assertCreated();

    expect($response->json('data.user.vehicle.plate_number'))->toBe('TST 1234')
        ->and($response->json('data.user.phone'))->toBeNull()
        ->and($response->json('data.token'))->not->toBeEmpty();
});

it('approves immediately once the number is well formed and unexpired', function () {
    registerDriver()->assertCreated();

    $driver = User::where('license_lookup', app(LicenceIdentity::class)->blindIndex('N01-19-123456'))->firstOrFail();

    expect($driver->verification_status)->toBe('approved')
        ->and($driver->is_verified)->toBeTrue()
        ->and($driver->approved_at)->not->toBeNull();
});

it('rejects a licence number that is not the PH 3-2-6 shape', function () {
    foreach (['12345', 'ABC-DE-FGHIJK', 'N1-19-123456', 'N01-19-12345'] as $bad) {
        registerDriver(['license_no' => $bad])->assertStatus(422);
    }
});

it('rejects an expired licence', function () {
    registerDriver(['license_expires_at' => now()->subDay()->toDateString()])->assertStatus(422);
});

it('still requires a licence photo', function () {
    registerDriver(['license_photo' => null])->assertStatus(422);
});

it('stores the photo privately, hashes the number and indexes it blind', function () {
    registerDriver()->assertCreated();

    $identity = app(LicenceIdentity::class);
    $driver = User::where('license_lookup', $identity->blindIndex('N01-19-123456'))->firstOrFail();

    Storage::assertExists($driver->license_photo_path);

    expect(Hash::check('N01-19-123456', $driver->license_hash))->toBeTrue()
        // The blind index must be deterministic but not the number itself.
        ->and($driver->license_lookup)->not->toContain('N01-19-123456')
        ->and($driver->license_lookup)->toHaveLength(64);
});

it('never exposes the licence number, hash, blind index or photo path', function () {
    $content = registerDriver()->assertCreated()->getContent();

    foreach (['N01-19-123456', 'license_hash', 'license_lookup', 'license_photo_path'] as $secret) {
        expect($content)->not->toContain($secret);
    }
});

it('refuses to register the same licence twice and points at login', function () {
    registerDriver()->assertCreated();

    registerDriver(['plate_number' => 'ZZZ 9999'])
        ->assertStatus(409)
        ->assertJsonPath('message', 'Nakarehistro na ang lisensyang ito. Mag-log in na lang.');
});

it('logs a driver back in with licence and plate, in any formatting', function () {
    registerDriver()->assertCreated();

    foreach (['N01-19-123456', 'n01 19 123456', 'n0119123456'] as $variant) {
        $response = test()->postJson('/api/login', [
            'license_no' => $variant,
            'plate_number' => 'tst 1234',
        ])->assertOk();

        expect($response->json('data.user.name'))->toBe('Juan Dela Cruz');
    }
});

it('refuses login when the plate does not match the licence', function () {
    registerDriver()->assertCreated();

    test()->postJson('/api/login', [
        'license_no' => 'N01-19-123456',
        'plate_number' => 'XXX 0000',
    ])->assertStatus(404);
});

it('gives the same message for an unknown licence as for a wrong plate', function () {
    registerDriver()->assertCreated();

    // Distinct messages would make this an oracle for enumerating licences.
    $wrongPlate = test()->postJson('/api/login', ['license_no' => 'N01-19-123456', 'plate_number' => 'XXX 0000']);
    $unknown = test()->postJson('/api/login', ['license_no' => 'Z99-99-999999', 'plate_number' => 'TST 1234']);

    expect($wrongPlate->json('message'))->toBe($unknown->json('message'));
});

it('stops a revoked driver from working and lets them be reinstated', function () {
    registerDriver()->assertCreated();
    $driver = User::where('license_lookup', app(LicenceIdentity::class)->blindIndex('N01-19-123456'))->firstOrFail();

    test()->artisan('biyahero:review', ['licence' => 'N01-19-123456', '--revoke' => 'Pekeng lisensya.'])
        ->assertSuccessful();

    Sanctum::actingAs($driver->fresh());
    test()->postJson('/api/trips', ['destination' => 'Baclaran'])->assertForbidden();

    test()->artisan('biyahero:review', ['licence' => 'N01-19-123456', '--reinstate' => true])
        ->assertSuccessful();

    Sanctum::actingAs($driver->fresh());
    // Position is part of starting a trip now — routes resolve from where the
    // driver actually is.
    test()->postJson('/api/trips', ['destination' => 'Baclaran', 'lat' => 14.534, 'lng' => 120.9967])->assertCreated();
});

it('stops a driver working once their licence lapses', function () {
    registerDriver()->assertCreated();
    $driver = User::where('license_lookup', app(LicenceIdentity::class)->blindIndex('N01-19-123456'))->firstOrFail();

    // Approved, but the licence has since expired.
    $driver->forceFill(['license_expires_at' => now()->subDay()])->save();

    expect($driver->fresh()->isApproved())->toBeFalse();

    Sanctum::actingAs($driver->fresh());
    test()->postJson('/api/trips', ['destination' => 'Baclaran'])->assertForbidden();
});

it('clears the live fix when a trip ends so no stale position lingers', function () {
    $driver = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();
    Sanctum::actingAs($driver);

    $trip = Trip::where('vehicle_id', $driver->vehicle->id)->active()->firstOrFail();

    $this->postJson("/api/trips/{$trip->id}/end")->assertOk();

    $vehicle = $driver->vehicle->fresh();
    expect($vehicle->live_lat)->toBeNull()
        ->and($vehicle->live_lng)->toBeNull()
        ->and($vehicle->last_ping_at)->toBeNull();
});

it('updates capacity on the trip, not on the vehicle profile', function () {
    $driver = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();
    Sanctum::actingAs($driver);

    $trip = Trip::where('vehicle_id', $driver->vehicle->id)->active()->firstOrFail();

    $this->patchJson("/api/trips/{$trip->id}/capacity", ['capacity' => 'full'])->assertOk();

    expect($trip->fresh()->capacity)->toBe('full');

    $shown = collect($this->getJson('/api/active-vehicles')->json('data'))
        ->firstWhere('plate_number', 'NCR 8842');

    expect($shown['capacity'])->toBe('full');
});

it('refuses a capacity value outside the four states', function () {
    $driver = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();
    Sanctum::actingAs($driver);
    $trip = Trip::where('vehicle_id', $driver->vehicle->id)->active()->firstOrFail();

    $this->patchJson("/api/trips/{$trip->id}/capacity", ['capacity' => 'crowded'])->assertStatus(422);
});

it('stops one driver from pinging or ending another driver trip', function () {
    $mine = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();
    $theirs = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'DAN 4417'))->firstOrFail();

    $theirTrip = Trip::where('vehicle_id', $theirs->vehicle->id)->active()->firstOrFail();

    Sanctum::actingAs($mine);

    $this->postJson("/api/trips/{$theirTrip->id}/ping", ['lat' => 14.5, 'lng' => 121.0])->assertForbidden();
    $this->postJson("/api/trips/{$theirTrip->id}/end")->assertForbidden();
    $this->patchJson("/api/trips/{$theirTrip->id}/capacity", ['capacity' => 'full'])->assertForbidden();
});

it('requires authentication for every driver write', function () {
    $trip = Trip::active()->firstOrFail();

    $this->postJson('/api/trips', ['destination' => 'Baclaran'])->assertUnauthorized();
    $this->postJson("/api/trips/{$trip->id}/ping", ['lat' => 14.5, 'lng' => 121.0])->assertUnauthorized();
    $this->postJson("/api/trips/{$trip->id}/end")->assertUnauthorized();
    $this->getJson('/api/trips/summary')->assertUnauthorized();
});

it('derives driver statistics from real trip rows rather than storing them', function () {
    $driver = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();
    Sanctum::actingAs($driver);

    $stats = $this->getJson('/api/me')->assertOk()->json('data.stats');

    $actualCompleted = Trip::where('vehicle_id', $driver->vehicle->id)->whereNotNull('ended_at')->count();
    $actualKm = round(Trip::where('vehicle_id', $driver->vehicle->id)->whereNotNull('ended_at')->sum('distance_km'), 1);

    expect($stats['completed_trips'])->toBe($actualCompleted)
        ->and($stats['total_km'])->toBe($actualKm)
        ->and($actualCompleted)->toBeGreaterThan(0);
});

it('lists only the driver own completed trips, newest first', function () {
    $driver = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();
    Sanctum::actingAs($driver);

    $rows = $this->getJson('/api/trips/history')->assertOk()->json('data');

    expect($rows)->not->toBeEmpty()
        ->and(count($rows))->toBeLessThanOrEqual(50);

    $ownTripIds = Trip::where('vehicle_id', $driver->vehicle->id)->whereNotNull('ended_at')->pluck('id');
    $starts = array_map(fn ($r) => $r['started_at'], $rows);
    $sorted = $starts;
    rsort($sorted);

    expect($starts)->toBe($sorted);
    foreach ($rows as $row) {
        expect($ownTripIds)->toContain($row['id'])
            ->and($row)->toHaveKeys(['destination', 'duration_min', 'distance_km']);
    }
});

it('requires auth for trip history', function () {
    $this->getJson('/api/trips/history')->assertUnauthorized();
});

it('lets a driver edit their vehicle, and the new plate becomes the login credential', function () {
    registerDriver()->assertCreated();
    $driver = User::where('license_lookup', app(LicenceIdentity::class)->blindIndex('N01-19-123456'))->firstOrFail();
    Sanctum::actingAs($driver);

    $this->patchJson('/api/vehicle', [
        'vehicle_type' => 'ejeep',
        'plate_number' => 'new 5678',
        'model' => 'COMET 2023',
        'body_number' => '99',
    ])->assertOk();

    $vehicle = $driver->vehicle->fresh();
    expect($vehicle->vehicle_type)->toBe('ejeep')
        ->and($vehicle->plate_number)->toBe('NEW 5678');

    // The plate is half the login credential: old stops working, new works.
    test()->postJson('/api/login', ['license_no' => 'N01-19-123456', 'plate_number' => 'TST 1234'])->assertStatus(404);
    test()->postJson('/api/login', ['license_no' => 'N01-19-123456', 'plate_number' => 'new 5678'])->assertOk();
});

it('rejects a vehicle edit with an unknown class or no auth', function () {
    $driver = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();

    $this->patchJson('/api/vehicle', ['vehicle_type' => 'jeepney', 'plate_number' => 'X'])->assertUnauthorized();

    Sanctum::actingAs($driver);
    $this->patchJson('/api/vehicle', ['vehicle_type' => 'tricycle', 'plate_number' => 'ABC 123'])->assertStatus(422);
});
