<?php

namespace App\Http\Controllers;

use App\Models\Destination;
use App\Models\Trip;
use App\Services\CorridorMatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Feeds the Destination Search screen. Recent searches are NOT stored here —
 * they live on the device only, which is what the screen promises the user.
 */
class DestinationController extends Controller
{
    public function __construct(protected CorridorMatcher $corridor) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate(['q' => 'nullable|string|max:120']);
        $query = $validated['q'] ?? null;

        $destinations = Destination::query()
            ->when($query, fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($query).'%']))
            ->when(! $query, fn ($q) => $q->where('is_popular', true))
            ->orderBy('name')
            ->limit(20)
            ->get();

        // One pass over active trips, then count per destination in memory —
        // cheaper than a corridor query per row.
        $activeTrips = Trip::query()->active()->with('route')->get();

        return response()->json([
            'data' => $destinations->map(fn (Destination $d) => [
                'id' => $d->id,
                'name' => $d->name,
                'subtitle' => $d->subtitle,
                'lat' => $d->lat,
                'lng' => $d->lng,
                'active_count' => $activeTrips
                    ->filter(fn (Trip $t) => $this->corridor->minDistanceToRoute($d->lat, $d->lng, $t->route?->waypoints ?? []) <= CorridorMatcher::CORRIDOR_RADIUS_M)
                    ->count(),
            ])->values(),
        ]);
    }
}
