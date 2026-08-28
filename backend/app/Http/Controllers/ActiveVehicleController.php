<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActiveVehicleResource;
use App\Models\Destination;
use App\Models\Trip;
use App\Services\CorridorMatcher;
use App\Services\Geocoder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;

/**
 * The commuter's only read endpoint. Takes NO commuter position — the filters
 * are a typed destination and a vehicle class, both of which the user supplies
 * explicitly. Replaces the old /commuter-radar, which required a GPS fix.
 */
class ActiveVehicleController extends Controller
{
    /** Mirrors the resource: past this, a ping no longer counts as live. */
    private const STALE_AFTER_SECONDS = ActiveVehicleResource::STALE_AFTER_SECONDS;

    public function __construct(
        protected CorridorMatcher $corridor,
        protected Geocoder $geocoder,
    ) {}

    public function index(Request $request): JsonResponse|AnonymousResourceCollection
    {
        $validated = $request->validate([
            'destination' => 'nullable|string|max:120',
            'vehicle_type' => 'nullable|string|in:jeepney,ejeep,bus,uv_express',
        ]);

        $trips = Trip::query()
            ->active()
            ->with(['vehicle.driver', 'route'])
            ->when(
                ! empty($validated['vehicle_type']),
                fn ($q) => $q->whereHas('vehicle', fn ($v) => $v->where('vehicle_type', $validated['vehicle_type']))
            );

        // Corridor match: keep trips whose route passes within the corridor of
        // the typed destination. A place we cannot locate at all yields no
        // matches rather than silently falling back to "everything".
        $place = null;

        if (! empty($validated['destination'])) {
            $place = $this->resolveDestination($validated['destination']);

            if (! $place) {
                return response()->json([
                    'data' => [],
                    'meta' => ['destination' => $validated['destination'], 'resolved' => false],
                ]);
            }

            $nearby = $this->corridor->routeIdsNear($place['lat'], $place['lng']);
            $trips->whereIn('route_id', $nearby);
        }

        $results = $trips->get();

        if ($place) {
            // How close each route actually runs to the destination: the ride
            // that passes nearest leads, and every card shows its own figure so
            // a 1.5 km corridor informs instead of overpromising.
            //
            // Distance is a property of the ROUTE, so it is measured once per
            // route rather than once per trip sharing it.
            $byRoute = [];

            $results->each(function (Trip $t) use ($place, &$byRoute) {
                $key = $t->route_id ?? 0;
                $byRoute[$key] ??= (int) round(
                    $this->corridor->minDistanceToRoute($place['lat'], $place['lng'], $t->route?->waypoints ?? [])
                );

                $t->setAttribute('passes_within_m', $byRoute[$key]);
            });

            // Nearest-passing first, but never at the cost of the older rule:
            // a vehicle nobody has heard from in an hour must not head a list
            // of rides someone is about to run for.
            $results = $results
                ->sortBy([
                    fn (Trip $a, Trip $b) => ($a->vehicle->last_ping_at?->diffInSeconds(now()) > self::STALE_AFTER_SECONDS)
                        <=> ($b->vehicle->last_ping_at?->diffInSeconds(now()) > self::STALE_AFTER_SECONDS),
                    fn (Trip $a, Trip $b) => $a->passes_within_m <=> $b->passes_within_m,
                    fn (Trip $a, Trip $b) => ($b->vehicle->last_ping_at?->timestamp ?? 0) <=> ($a->vehicle->last_ping_at?->timestamp ?? 0),
                ])
                ->values();
        } else {
            // Live vehicles first; a stale ping should never head the list.
            $results = $results
                ->sortBy(fn (Trip $t) => $t->vehicle->last_ping_at?->timestamp === null ? PHP_INT_MAX : -$t->vehicle->last_ping_at->timestamp)
                ->values();
        }

        return ActiveVehicleResource::collection($results)->additional([
            'meta' => [
                'count' => $results->count(),
                'destination' => $place['name'] ?? ($validated['destination'] ?? null),
                // Lets the app pin the searched place even when it is nowhere
                // in our own destinations table.
                'destination_position' => $place ? ['lat' => $place['lat'], 'lng' => $place['lng']] : null,
                'corridor_radius_m' => CorridorMatcher::CORRIDOR_RADIUS_M,
            ],
        ]);
    }

    public function show(int $vehicleId): ActiveVehicleResource
    {
        $trip = Trip::query()
            ->active()
            ->with(['vehicle.driver', 'route'])
            ->where('vehicle_id', $vehicleId)
            ->firstOrFail();

        return new ActiveVehicleResource($trip);
    }

    /**
     * Where the commuter wants to go: our own destinations first (exact, then
     * a contains match so "baclaran" finds "Baclaran"), and failing that, any
     * real place on the map.
     *
     * The geocode step is what lets someone search "SM City Clark" — a place
     * no jeepney is bound FOR, but several run PAST. It takes only the typed
     * text; the commuter's own position is still never involved.
     *
     * @return array{lat: float, lng: float, name: string}|null
     */
    private function resolveDestination(string $name): ?array
    {
        $known = Destination::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first()
            ?? Destination::query()
                ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($name).'%'])
                ->first();

        if ($known) {
            return ['lat' => (float) $known->lat, 'lng' => (float) $known->lng, 'name' => $known->name];
        }

        // Cached: commuters retype the same landmarks all day, and the
        // geocoder asks for no more than one call a second.
        return Cache::remember(
            'commuter-place:'.md5(mb_strtolower(trim($name))),
            300,
            fn () => $this->geocoder->search($name)
        );
    }
}
