<?php

use App\Models\Trip;
use App\Models\User;
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

    $this->seed(DatabaseSeeder::class);
    Storage::fake('local');
});

function registerDriver(array $overrides = [])
{
    return test()->postJson('/api/register', array_merge([
        'name' => 'Juan Dela Cruz',
        'phone' => '+639998887777',
        'vehicle_type' => 'jeepney',
        'plate_number' => 'tst 1234',
        'model' => 'Sarao 2020',
        'license_no' => 'N01-19-123456',
        'license_photo' => UploadedFile::fake()->image('licence.jpg', 1200, 750),
    ], $overrides));
}

it('registers a driver as PENDING and never self-approves', function () {
    $response = registerDriver()->assertCreated();

    expect($response->json('data.user.verification_status'))->toBe('pending')
        ->and($response->json('data.user.is_verified'))->toBeFalse()
        // Plate is normalised — it is a public, painted-on identifier.
        ->and($response->json('data.user.vehicle.plate_number'))->toBe('TST 1234');

    $driver = User::where('phone', '+639998887777')->firstOrFail();
    expect($driver->approved_at)->toBeNull();
});

it('requires a licence photo and a licence number', function () {
    registerDriver(['license_photo' => null])->assertStatus(422);
    registerDriver(['license_no' => null])->assertStatus(422);
});

it('stores the licence photo privately and hashes the number', function () {
    registerDriver()->assertCreated();

    $driver = User::where('phone', '+639998887777')->firstOrFail();

    expect($driver->license_photo_path)->not->toBeNull();
    Storage::assertExists($driver->license_photo_path);

    expect(Hash::check('N01-19-123456', $driver->license_hash))->toBeTrue();
});

it('never exposes the licence number, hash or photo path to any client', function () {
    $content = registerDriver()->assertCreated()->getContent();

    expect($content)->not->toContain('N01-19-123456')
        ->and($content)->not->toContain('license_hash')
        ->and($content)->not->toContain('license_photo_path');
});

it('refuses a second registration on the same phone and points at login', function () {
    registerDriver()->assertCreated();

    registerDriver()
        ->assertStatus(409)
        ->assertJsonPath('message', 'May account na sa numerong ito. Mag-log in na lang.');
});

it('lets a registered driver log back in with their phone number', function () {
    registerDriver()->assertCreated();

    $response = $this->postJson('/api/login', ['phone' => '+639998887777'])->assertOk();

    expect($response->json('data.token'))->not->toBeEmpty()
        ->and($response->json('data.user.verification_status'))->toBe('pending');
});

it('blocks an unapproved driver from starting a trip', function () {
    registerDriver()->assertCreated();
    $driver = User::where('phone', '+639998887777')->firstOrFail();

    Sanctum::actingAs($driver);

    $this->postJson('/api/trips', ['destination' => 'Baclaran'])->assertForbidden();

    // And they must not be visible to commuters.
    $shown = collect($this->getJson('/api/active-vehicles')->json('data'))
        ->firstWhere('plate_number', 'TST 1234');
    expect($shown)->toBeNull();
});

it('lets a driver work only once a human approves them', function () {
    registerDriver()->assertCreated();
    $driver = User::where('phone', '+639998887777')->firstOrFail();

    $this->artisan('biyahero:review', ['phone' => '+639998887777', '--approve' => true])
        ->assertSuccessful();

    $driver->refresh();
    expect($driver->verification_status)->toBe('approved')
        ->and($driver->approved_at)->not->toBeNull();

    Sanctum::actingAs($driver);
    $trip = $this->postJson('/api/trips', ['destination' => 'Baclaran'])->assertCreated();

    $this->postJson("/api/trips/{$trip->json('data.id')}/ping", [
        'lat' => 14.5455, 'lng' => 120.9969, 'street' => 'Taft Ave',
    ])->assertOk();

    $shown = collect($this->getJson('/api/active-vehicles')->json('data'))
        ->firstWhere('plate_number', 'TST 1234');

    expect($shown)->not->toBeNull()
        ->and($shown['current_street'])->toBe('Taft Ave');
});

it('refuses to approve a driver with no licence photo on file', function () {
    registerDriver()->assertCreated();
    User::where('phone', '+639998887777')->update(['license_photo_path' => null]);

    $this->artisan('biyahero:review', ['phone' => '+639998887777', '--approve' => true])
        ->assertFailed();

    expect(User::where('phone', '+639998887777')->value('verification_status'))->toBe('pending');
});

it('records a rejection reason the driver can see', function () {
    registerDriver()->assertCreated();

    $this->artisan('biyahero:review', [
        'phone' => '+639998887777',
        '--reject' => 'Malabo ang larawan ng lisensya.',
    ])->assertSuccessful();

    $driver = User::where('phone', '+639998887777')->firstOrFail();
    Sanctum::actingAs($driver);

    $me = $this->getJson('/api/me')->assertOk();

    expect($me->json('data.verification_status'))->toBe('rejected')
        ->and($me->json('data.rejection_reason'))->toBe('Malabo ang larawan ng lisensya.');
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
