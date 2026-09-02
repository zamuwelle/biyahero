<?php

namespace App\Http\Controllers;

use App\Models\Trip;
use App\Models\User;
use App\Services\RouteGeometry;
use App\Services\TripRouteResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The driver side. A trip is started with a destination — that declaration is
 * what makes the vehicle visible to commuters, and ending it removes them from
 * the map immediately.
 */
class TripController extends Controller
{
    public function __construct(
        protected TripRouteResolver $resolver,
        protected RouteGeometry $geometry,
    ) {}

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
            // Where the driver is starting from — this is what stops a Tarlac
            // driver from ever being put on a Metro Manila corridor.
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
            // A destination pinned on the map instead of typed.
            'dest_lat' => 'nullable|numeric|between:-90,90',
            'dest_lng' => 'nullable|numeric|between:-180,180',
            // Roads the driver says they actually take. A jeepney route is
            // defined by the roads it uses, not by its endpoints — without
            // these, two jeepneys running the same pair of towns by different
            // highways get the same drawn corridor, and the commuter on the
            // road one of them skips is wrongly told it passes them.
            'via' => 'nullable|array|max:8',
            'via.*.lat' => 'required|numeric|between:-90,90',
            'via.*.lng' => 'required|numeric|between:-180,180',
        ]);

        $driver = $request->user();

        // Verification is the gate: an unapproved driver must not become
        // visible to commuters, however they reached this endpoint.
        if (! $driver->isApproved()) {
            return $this->error(self::standingMessage($driver), 403);
        }

        $vehicle = $driver->vehicle;
        if (! $vehicle) {
            return $this->error('No vehicle registered for this driver.', 404);
        }

        $resolved = $this->resolver->resolve(
            $validated['route_id'] ?? null,
            $validated['destination'],
            isset($validated['dest_lat']) ? (float) $validated['dest_lat'] : null,
            isset($validated['dest_lng']) ? (float) $validated['dest_lng'] : null,
            isset($validated['lat']) ? (float) $validated['lat'] : null,
            isset($validated['lng']) ? (float) $validated['lng'] : null,
            $validated['via'] ?? [],
        );

        if (! $resolved) {
            return $this->error('Hindi mahanap ang lugar na iyan. Subukan ang ibang pangalan, o ituro ito sa mapa.', 422);
        }

        // One run at a time — starting a new trip closes any run left open.
        Trip::query()->active()->where('vehicle_id', $vehicle->id)->update(['ended_at' => now()]);

        $trip = Trip::create([
            'vehicle_id' => $vehicle->id,
            'route_id' => $resolved['route']->id,
            'destination' => $resolved['destination'],
            'dest_lat' => $resolved['target']['lat'] ?? null,
            'dest_lng' => $resolved['target']['lng'] ?? null,
            'capacity' => 'open',
            'started_at' => now(),
        ]);

        return $this->success($trip->load('route'), 'Nagsimula ang biyahe.', 201);
    }

    /**
     * Mid-trip destination change. The new route is resolved from where the
     * vehicle IS RIGHT NOW — the drawn line re-routes like a navigation app —
     * while the run itself (start time, distance so far) is preserved.
     */
    /**
     * What the roads make of the line the driver drew, before they commit to it.
     *
     * A tap lands on whatever road is nearest, and near an expressway that is
     * the expressway — which a jeepney may not legally use and which OSRM can
     * only enter and leave at an interchange. Three points spanning 4 km came
     * back as a 25 km route with hooks at both ends. The driver could not see
     * that until the trip had already started, so this hands back the snapped
     * line and lets them look before they go.
     */
    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'points' => 'required|array|min:2|max:10',
            'points.*.lat' => 'required|numeric|between:-90,90',
            'points.*.lng' => 'required|numeric|between:-180,180',
        ]);

        $points = array_map(fn (array $p) => [
            'lat' => (float) $p['lat'],
            'lng' => (float) $p['lng'],
        ], $validated['points']);

        $snapped = $this->geometry->snapToRoads($points);

        return response()->json(['data' => [
            'waypoints' => $snapped['waypoints'],
            'length_km' => $snapped['length_km'],
            'road_matched' => $snapped['matched'],
            // What the driver drew, so the app can say when the roads disagree
            // with them by an unreasonable margin.
            'drawn_km' => round($this->geometry->straightLineKm($points), 2),
        ]]);
    }

    public function reroute(Request $request, Trip $trip): JsonResponse
    {
        $this->authorizeTrip($request, $trip);

        // A finished run is a historical record — /trips/history serves its
        // destination and route. Only a live trip may change course.
        if ($trip->ended_at !== null) {
            return $this->error('Tapos na ang biyaheng ito.', 422);
        }

        $validated = $request->validate([
            'destination' => 'required|string|max:120',
            'route_id' => 'nullable|integer|exists:routes,id',
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
            'dest_lat' => 'nullable|numeric|between:-90,90',
            'dest_lng' => 'nullable|numeric|between:-180,180',
            // Roads the driver says they actually take. A jeepney route is
            // defined by the roads it uses, not by its endpoints — without
            // these, two jeepneys running the same pair of towns by different
            // highways get the same drawn corridor, and the commuter on the
            // road one of them skips is wrongly told it passes them.
            'via' => 'nullable|array|max:8',
            'via.*.lat' => 'required|numeric|between:-90,90',
            'via.*.lng' => 'required|numeric|between:-180,180',
        ]);

        $vehicle = $trip->vehicle;

        $resolved = $this->resolver->resolve(
            $validated['route_id'] ?? null,
            $validated['destination'],
            isset($validated['dest_lat']) ? (float) $validated['dest_lat'] : null,
            isset($validated['dest_lng']) ? (float) $validated['dest_lng'] : null,
            isset($validated['lat']) ? (float) $validated['lat'] : ($vehicle->live_lat !== null ? (float) $vehicle->live_lat : null),
            isset($validated['lng']) ? (float) $validated['lng'] : ($vehicle->live_lng !== null ? (float) $vehicle->live_lng : null),
            $validated['via'] ?? [],
        );

        if (! $resolved) {
            return $this->error('Hindi mahanap ang lugar na iyan. Subukan ang ibang pangalan, o ituro ito sa mapa.', 422);
        }

        $trip->update([
            'route_id' => $resolved['route']->id,
            'destination' => $resolved['destination'],
            'dest_lat' => $resolved['target']['lat'] ?? null,
            'dest_lng' => $resolved['target']['lng'] ?? null,
        ]);

        return $this->success($trip->load('route'), 'Napalitan ang ruta.');
    }

    /** How many past routes the driver gets as one-tap shortcuts. */
    private const RECENT_ROUTE_LIMIT = 5;

    /**
     * The routes this driver has actually run, most recent first. A jeepney
     * driver repeats the same run daily, so their own history is a better
     * shortcut than any list we could compute for them.
     */
    public function recentRoutes(Request $request): JsonResponse
    {
        $vehicle = $request->user()->vehicle;

        if (! $vehicle) {
            return $this->success([]);
        }

        $routes = Trip::query()
            ->where('vehicle_id', $vehicle->id)
            // Finished runs only: the trip they are on right now is not a
            // shortcut to anywhere, it is where they already are.
            ->whereNotNull('ended_at')
            ->with('route')
            ->latest('started_at')
            // Wide enough that a week of repeating the same run still surfaces
            // five DISTINCT routes; a driver who only ever ran four has four.
            ->take(200)
            ->get()
            ->filter(fn (Trip $trip) => $trip->route !== null)
            // One row per route: the same run repeated all week is one shortcut.
            ->unique('route_id')
            ->take(self::RECENT_ROUTE_LIMIT)
            ->map(fn (Trip $trip) => [
                'id' => $trip->route->id,
                'label' => $trip->orientedRouteLabel(),
                'length_km' => (float) $trip->route->length_km,
                'destination' => $trip->destination,
                'last_used_at' => $trip->started_at?->toIso8601String(),
            ])
            ->values();

        return $this->success($routes);
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

        // A ping in flight when the driver hit "Tapusin" must not undo the
        // end: it would re-plot a finished vehicle on commuter maps and
        // rewrite a historical trip's distance.
        if ($trip->ended_at !== null) {
            return $this->error('Tapos na ang biyaheng ito.', 422);
        }

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
    /**
     * Ownership AND standing. Approval used to be checked only when a trip
     * was created, so a driver revoked mid-run kept pinging and stayed live
     * on commuter maps for as long as their app was open.
     */
    private function authorizeTrip(Request $request, Trip $trip): void
    {
        $driver = $request->user();

        abort_unless($trip->vehicle?->user_id === $driver->id, 403, 'Hindi ito ang biyahe mo.');
        abort_unless($driver->isApproved(), 403, self::standingMessage($driver));
    }

    /** Names the actual reason, rather than always saying "not yet approved". */
    private static function standingMessage(User $driver): string
    {
        if ($driver->licenceHasExpired()) {
            return 'Paso na ang lisensya mo. I-renew ito bago magbiyahe ulit.';
        }

        if ($driver->verification_status === 'rejected') {
            return 'Hindi aprubado ang rehistro mo.';
        }

        return 'Hindi pa aprubado ang rehistro mo. Maghintay ng abiso.';
    }
}
