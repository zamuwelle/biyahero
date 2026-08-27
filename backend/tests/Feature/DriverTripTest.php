<?php

use App\Models\Trip;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
});

it('registers a driver with a vehicle and never echoes the licence back', function () {
    $response = $this->postJson('/api/register', [
        'name' => 'Juan Dela Cruz',
        'phone' => '+639998887777',
        'vehicle_type' => 'jeepney',
        'plate_number' => 'tst 1234',
        'model' => 'Sarao 2020',
        'license_no' => 'N01-19-123456',
    ])->assertOk();

    expect($response->json('data.user.name'))->toBe('Juan Dela Cruz')
        // Plate is normalised — it is a public, painted-on identifier.
        ->and($response->json('data.user.vehicle.plate_number'))->toBe('TST 1234')
        ->and($response->json('data.token'))->not->toBeEmpty();

    $content = $response->getContent();
    expect($content)->not->toContain('N01-19-123456')
        ->and($content)->not->toContain('license_hash');

    // Stored hashed, never in the clear.
    $stored = User::where('phone', '+639998887777')->value('license_hash');
    expect($stored)->not->toBe('N01-19-123456')
        ->and(Hash::check('N01-19-123456', $stored))->toBeTrue();
});

it('rejects a vehicle class outside the four PH classes at registration', function () {
    $this->postJson('/api/register', [
        'name' => 'Juan Dela Cruz',
        'phone' => '+639998887777',
        'vehicle_type' => 'tricycle',
        'plate_number' => 'TST 1234',
    ])->assertStatus(422);
});

it('makes a driver visible to commuters only while a trip is running', function () {
    $this->postJson('/api/register', [
        'name' => 'Juan Dela Cruz',
        'phone' => '+639998887777',
        'vehicle_type' => 'jeepney',
        'plate_number' => 'TST 1234',
    ])->assertOk();

    $driver = User::where('phone', '+639998887777')->firstOrFail();
    Sanctum::actingAs($driver);

    // Not broadcasting yet — absent from the commuter map.
    $before = $this->getJson('/api/active-vehicles?destination=Baclaran')->json('meta.count');
    expect($before)->toBe(5);

    $trip = $this->postJson('/api/trips', ['destination' => 'Baclaran'])->assertCreated();
    $tripId = $trip->json('data.id');

    $this->postJson("/api/trips/{$tripId}/ping", [
        'lat' => 14.5455,
        'lng' => 120.9969,
        'street' => 'Taft Ave',
        'distance_km' => 5.1,
    ])->assertOk();

    $during = $this->getJson('/api/active-vehicles?destination=Baclaran');
    expect($during->json('meta.count'))->toBe(6);

    $mine = collect($during->json('data'))->firstWhere('plate_number', 'TST 1234');
    expect($mine['current_street'])->toBe('Taft Ave')
        ->and($mine['is_stale'])->toBeFalse();

    // Ending the trip must drop them immediately, not after a timeout.
    $this->postJson("/api/trips/{$tripId}/end")->assertOk();

    $after = $this->getJson('/api/active-vehicles?destination=Baclaran');
    expect($after->json('meta.count'))->toBe(5)
        ->and(collect($after->json('data'))->firstWhere('plate_number', 'TST 1234'))->toBeNull();
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

it('starts a new trip by closing whatever run was left open', function () {
    $driver = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();
    Sanctum::actingAs($driver);

    $this->postJson('/api/trips', ['destination' => 'Cubao'])->assertCreated();

    $open = Trip::where('vehicle_id', $driver->vehicle->id)->active()->get();

    expect($open)->toHaveCount(1)
        ->and($open->first()->destination)->toBe('Cubao');
});

it('reports today totals for the driver home screen', function () {
    $driver = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();
    Sanctum::actingAs($driver);

    $summary = $this->getJson('/api/trips/summary')->assertOk();

    expect($summary->json('data'))->toHaveKeys(['trips', 'hours_online', 'km_travelled']);
});
