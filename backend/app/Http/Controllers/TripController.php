<?php

namespace App\Http\Controllers;

use App\Models\Destination;
use App\Models\Route;
use App\Models\Trip;
use App\Services\CorridorMatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The driver side. A trip is started with a destination — that declaration is
 * what makes the vehicle visible to commuters, and ending it removes them from
 * the map immediately.
 */
class TripController extends Controller
{
    public function __construct(protected CorridorMatcher $corridor) {}

    /** The driver's current run, if any. */
    public function current(Request $request): JsonResponse
    {
        $vehicle = $request->user()->vehicle;
        if (! $vehicle) {
            return $this->error('No vehicle registered for this driver.', 404);
        }

        $trip = Trip::query()->active()->with('route')->where('vehicle_id', $vehicle->id)->first();

        return $this->success($trip);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'destination' => 'required|string|max:120',
            'route_id' => 'nullable|integer|exists:routes,id',
        ]);

        $driver = $request->user();

        // Verification is the gate: an unapproved driver must not become
        // visible to commuters, however they reached this endpoint.
        if (! $driver->isApproved()) {
            return $this->error('Hindi pa aprubado ang rehistro mo. Maghintay ng abiso.', 403);
        }

        $vehicle = $driver->vehicle;
        if (! $vehicle) {
            return $this->error('No vehicle registered for this driver.', 404);
        }

        $route = $this->resolveRoute($validated['route_id'] ?? null, $validated['destination']);
        if (! $route) {
            return $this->error('No known route serves that destination yet.', 422);
        }

        // One run at a time — starting a new trip closes any run left open.
        Trip::query()->active()->where('vehicle_id', $vehicle->id)->update(['ended_at' => now()]);

        $trip = Trip::create([
            'vehicle_id' => $vehicle->id,
            'route_id' => $route->id,
            'destination' => $validated['destination'],
            'capacity' => 'open',
            'started_at' => now(),
        ]);

        return $this->success($trip->load('route'), 'Nagsimula ang biyahe.', 201);
    }

    /** Capacity is the driver's one-tap job while driving, so it gets its own route. */
    public function updateCapacity(Request $request, Trip $trip): JsonResponse
    {
        $this->authorizeTrip($request, $trip);

        $validated = $request->validate([
            'capacity' => 'required|string|in:open,filling,full,unknown',
        ]);

        $trip->update(['capacity' => $validated['capacity']]);

        return $this->success($trip);
    }

    /**
     * Location ping. This is the ONLY location the system ever ingests, and it
     * comes from a driver who has explicitly started broadcasting.
     */
    public function ping(Request $request, Trip $trip): JsonResponse
    {
        $this->authorizeTrip($request, $trip);

        $validated = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
            'street' => 'nullable|string|max:120',
            'distance_km' => 'nullable|numeric|min:0',
        ]);

        $trip->vehicle->update([
            'live_lat' => $validated['lat'],
            'live_lng' => $validated['lng'],
            'last_ping_at' => now(),
            'current_street' => $validated['street'] ?? $trip->vehicle->current_street,
        ]);

        if (isset($validated['distance_km'])) {
            $trip->update(['distance_km' => $validated['distance_km']]);
        }

        return $this->success(['last_ping_at' => now()->toIso8601String()]);
    }

    public function end(Request $request, Trip $trip): JsonResponse
    {
        $this->authorizeTrip($request, $trip);

        $trip->update(['ended_at' => now()]);

        // Drop the live fix so the vehicle cannot linger on a commuter's map.
        $trip->vehicle->update(['live_lat' => null, 'live_lng' => null, 'last_ping_at' => null]);

        return $this->success($trip->fresh(), 'Tapos na ang biyahe.');
    }

    /** Completed runs, newest first — backs the "Kasaysayan ng biyahe" screen. */
    public function history(Request $request): JsonResponse
    {
        $vehicle = $request->user()->vehicle;
        if (! $vehicle) {
            return $this->error('No vehicle registered for this driver.', 404);
        }

        $trips = Trip::query()
            ->where('vehicle_id', $vehicle->id)
            ->whereNotNull('ended_at')
            ->with('route')
            ->orderByDesc('started_at')
            ->limit(50)
            ->get()
            ->map(fn (Trip $trip) => [
                'id' => $trip->id,
                'destination' => $trip->destination,
                'route_label' => $trip->route?->label,
                'started_at' => $trip->started_at?->toIso8601String(),
                'ended_at' => $trip->ended_at?->toIso8601String(),
                'duration_min' => $trip->elapsedMinutes(),
                'distance_km' => (float) $trip->distance_km,
            ]);

        return $this->success($trips);
    }

    /** Today's totals for the driver home screen. */
    public function summary(Request $request): JsonResponse
    {
        $vehicle = $request->user()->vehicle;
        if (! $vehicle) {
            return $this->error('No vehicle registered for this driver.', 404);
        }

        $today = Trip::query()
            ->where('vehicle_id', $vehicle->id)
            ->whereDate('started_at', today())
            ->get();

        $minutes = $today->sum(fn (Trip $t) => $t->elapsedMinutes());

        return $this->success([
            'trips' => $today->count(),
            'hours_online' => round($minutes / 60, 1),
            'km_travelled' => round($today->sum('distance_km'), 1),
        ]);
    }

    /** An explicit route wins; otherwise pick one whose polyline passes the destination. */
    private function resolveRoute(?int $routeId, string $destination): ?Route
    {
        if ($routeId) {
            return Route::find($routeId);
        }

        $place = Destination::query()
            ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($destination).'%'])
            ->first();

        if (! $place) {
            return Route::first();
        }

        $ids = $this->corridor->routeIdsNear($place->lat, $place->lng);

        return $ids ? Route::find($ids[0]) : Route::first();
    }

    private function authorizeTrip(Request $request, Trip $trip): void
    {
        abort_unless($trip->vehicle?->user_id === $request->user()->id, 403, 'Hindi ito ang biyahe mo.');
    }
}
