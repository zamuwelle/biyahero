<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActiveVehicleResource;
use App\Models\Destination;
use App\Models\Trip;
use App\Services\CorridorMatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The commuter's only read endpoint. Takes NO commuter position — the filters
 * are a typed destination and a vehicle class, both of which the user supplies
 * explicitly. Replaces the old /commuter-radar, which required a GPS fix.
 */
class ActiveVehicleController extends Controller
{
    public function __construct(protected CorridorMatcher $corridor) {}

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

        // Corridor match: keep only trips whose route passes within 400 m of the
        // typed destination. A destination we don't know yields no matches rather
        // than silently falling back to "everything".
        if (! empty($validated['destination'])) {
            $place = $this->resolveDestination($validated['destination']);

            if (! $place) {
                return response()->json([
                    'data' => [],
                    'meta' => ['destination' => $validated['destination'], 'resolved' => false],
                ]);
            }

            $trips->whereIn('route_id', $this->corridor->routeIdsNear($place->lat, $place->lng));
        }

        $results = $trips->get()
            // Live vehicles first; a stale ping should never head the list.
            ->sortBy(fn (Trip $t) => $t->vehicle->last_ping_at?->timestamp === null ? PHP_INT_MAX : -$t->vehicle->last_ping_at->timestamp)
            ->values();

        return ActiveVehicleResource::collection($results)->additional([
            'meta' => [
                'count' => $results->count(),
                'destination' => $validated['destination'] ?? null,
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

    /** Exact name first, then a contains match so "baclaran" finds "Baclaran". */
    private function resolveDestination(string $name): ?Destination
    {
        return Destination::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first()
            ?? Destination::query()
                ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($name).'%'])
                ->first();
    }
}
