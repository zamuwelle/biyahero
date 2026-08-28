<?php

namespace App\Http\Controllers;

use App\Models\Destination;
use App\Models\Trip;
use App\Services\CorridorMatcher;
use App\Services\Geocoder;
use App\Services\PoiFinder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Place type-ahead for both sides of the app.
 *
 * Places already known to Biyahero come first — picking one keeps trips on
 * the corridors commuters are already searching — then anywhere else in the
 * Philippines via OpenStreetMap, so a town we have never seen still yields a
 * real, exact destination instead of free text.
 *
 * The two type-ahead entry points differ only in how they RANK, and that
 * difference is the privacy line: search() is driver-side (auth) and ranks by
 * distance from the driver's own position, while suggest() is public and ranks
 * by distance to the running fleet, because no commuter position exists to
 * rank with.
 *
 * nearby() is a third thing: the places to DRAW inside a map viewport. It is
 * public and takes coordinates, which looks like a privacy hole and is not —
 * a viewport is where the map is pointed, which the user chose by dragging.
 * It is never the device's position, and nothing here records it.
 */
class PlaceController extends Controller
{
    public function __construct(
        protected Geocoder $geocoder,
        protected CorridorMatcher $corridor,
        protected PoiFinder $poi,
    ) {}

    /**
     * Places inside the map's current viewport, so Biyahero can draw its own
     * place layer.
     *
     * It draws one because the Google Maps SDK will not: a custom map style
     * applies to the plain map type only, so satellite and terrain showed a
     * different, much thinner set of labels and the three layers disagreed
     * about what exists. Ours are the same markers on every layer.
     */
    public function nearby(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'south' => 'required|numeric|between:-90,90',
            'north' => 'required|numeric|between:-90,90',
            'west' => 'required|numeric|between:-180,180',
            'east' => 'required|numeric|between:-180,180',
        ]);

        $places = $this->poi->inBox(
            (float) $validated['south'],
            (float) $validated['west'],
            (float) $validated['north'],
            (float) $validated['east'],
        );

        return response()->json(['data' => $places]);
    }

    /**
     * Type-ahead for the COMMUTER's "Saan ka pupunta?" — public, and it takes
     * no position at all. Ranking comes from where the fleet actually runs
     * instead: a place several jeepneys pass is a more useful answer than a
     * namesake in another province, and the server already knows every active
     * route without asking the commuter anything.
     */
    public function suggest(Request $request): JsonResponse
    {
        $validated = $request->validate(['q' => 'required|string|min:2|max:120']);

        $needle = mb_strtolower(trim($validated['q']));

        $known = Destination::query()
            ->get()
            ->filter(fn (Destination $d) => str_contains(mb_strtolower($d->name), $needle))
            ->take(4)
            ->map(fn (Destination $d) => [
                'name' => $d->name,
                'subtitle' => $d->subtitle ?? '',
                'lat' => (float) $d->lat,
                'lng' => (float) $d->lng,
                'known' => true,
            ])
            // Without this the filtered collection keeps its original keys and
            // the whole payload serialises as a JSON object, not a list.
            ->values();

        $cacheKey = 'suggest:'.md5($needle);
        $found = Cache::get($cacheKey);

        if ($found === null) {
            $found = $this->geocoder->searchMany($validated['q'], null, null, 12);

            if ($found !== []) {
                Cache::put($cacheKey, $found, 300);
            }
        }

        // Every polyline currently carrying a vehicle, loaded once — and only
        // when there are candidates to rank against it.
        $liveRoutes = $found === [] ? [] : Trip::query()
            ->active()
            ->with('route')
            ->get()
            ->pluck('route')
            ->filter()
            ->unique('id')
            ->map(fn ($route) => $route->waypoints ?? [])
            ->filter()
            ->all();

        $places = collect($found)
            // Same name AND same place — never name alone. "Victoria" exists in
            // half a dozen provinces, and hiding all but ours would strand
            // anyone searching for one of the others.
            ->reject(fn (array $p) => $known->contains(
                fn (array $k) => mb_strtolower($k['name']) === mb_strtolower($p['name'])
                    && $this->roughDistanceKm($k['lat'], $k['lng'], $p['lat'], $p['lng']) <= 2
            ))
            ->map(fn (array $p) => [...$p, 'known' => false])
            ->sortBy(fn (array $p) => $this->distanceToFleetM($p['lat'], $p['lng'], $liveRoutes))
            ->take(6)
            ->values();

        return response()->json(['data' => $known->concat($places)->all()]);
    }

    /**
     * How far a place sits from the nearest route with a vehicle on it. INF
     * when nothing is running, which leaves the geocoder's own order intact.
     *
     * @param  array<array<array{lat: float, lng: float}>>  $routes
     */
    private function distanceToFleetM(float $lat, float $lng, array $routes): float
    {
        $nearest = INF;

        foreach ($routes as $waypoints) {
            $nearest = min($nearest, $this->corridor->minDistanceToRoute($lat, $lng, $waypoints));
        }

        return $nearest;
    }

    public function search(Request $request): JsonResponse
    {
        // A lone lat or lng is meaningless here and would reach the distance
        // maths as null — require the pair or neither.
        $validated = $request->validate([
            'q' => 'required|string|min:2|max:120',
            'lat' => 'nullable|required_with:lng|numeric|between:-90,90',
            'lng' => 'nullable|required_with:lat|numeric|between:-180,180',
        ]);

        $needle = mb_strtolower(trim($validated['q']));
        $lat = isset($validated['lat']) ? (float) $validated['lat'] : null;
        $lng = isset($validated['lng']) ? (float) $validated['lng'] : null;
        $located = $lat !== null && $lng !== null;

        $known = Destination::query()
            ->get()
            ->filter(fn (Destination $d) => str_contains(mb_strtolower($d->name), $needle))
            ->sortBy(fn (Destination $d) => $located ? $this->roughDistanceKm($lat, $lng, (float) $d->lat, (float) $d->lng) : 0)
            ->take(4)
            // Same shape as a geocoded row, distance included: a place we
            // seeded is no less likely to be in the wrong province.
            ->map(fn (Destination $d) => [
                'name' => $d->name,
                'subtitle' => $d->subtitle ?? '',
                'lat' => (float) $d->lat,
                'lng' => (float) $d->lng,
                'known' => true,
                'distance_m' => $located
                    ? (int) round($this->roughDistanceKm($lat, $lng, (float) $d->lat, (float) $d->lng) * 1000)
                    : null,
            ])
            ->values();

        // Nominatim asks for at most one call per second, and drivers type
        // fast — cache each (query, rough area) briefly.
        $cacheKey = 'places:'.md5($needle.'|'.round($lat ?? 0, 1).'|'.round($lng ?? 0, 1));
        $found = Cache::get($cacheKey);

        if ($found === null) {
            $found = $this->geocoder->searchMany($validated['q'], $lat, $lng, 12);

            // Only cache real answers: the geocoder returns [] for a timeout
            // exactly as it does for "no such place", and caching that would
            // blank the query for five minutes over one hiccup.
            if ($found !== []) {
                Cache::put($cacheKey, $found, 300);
            }
        }

        // Nominatim's viewbox is only a hint — it still ranks a namesake in
        // Cebu above the one down the road. Distance from the driver decides
        // here: a jeepney destination is somewhere they can actually drive.
        $places = collect($found)
            // Drop a geocoded hit only when it IS the known row — same name
            // AND same place. PH names repeat province to province, so a
            // name-only match would hide the Baclaran down the road.
            ->reject(fn (array $p) => $known->contains(
                fn (array $k) => mb_strtolower($k['name']) === mb_strtolower($p['name'])
                    && $this->roughDistanceKm($k['lat'], $k['lng'], $p['lat'], $p['lng']) <= 2
            ))
            ->sortBy(fn (array $p) => $located ? $this->roughDistanceKm($lat, $lng, $p['lat'], $p['lng']) : 0)
            // How far it is, so a driver can see that the Jollibee on offer is
            // in the next province before they commit a whole run to it.
            ->map(fn (array $p) => [
                ...$p,
                'known' => false,
                'distance_m' => $located
                    ? (int) round($this->roughDistanceKm($lat, $lng, $p['lat'], $p['lng']) * 1000)
                    : null,
            ])
            ->take(6)
            ->values();

        return response()->json(['data' => $known->concat($places)->all()]);
    }

    /** Cheap ranking distance — exactness does not matter for sort order. */
    private function roughDistanceKm(float $aLat, float $aLng, float $bLat, float $bLng): float
    {
        return sqrt((($bLat - $aLat) * 111) ** 2 + (($bLng - $aLng) * 107) ** 2);
    }
}
