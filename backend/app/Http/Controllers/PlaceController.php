<?php

namespace App\Http\Controllers;

use App\Models\Destination;
use App\Services\Geocoder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Type-ahead for the driver's "Saan ka papunta?" field.
 *
 * Places already known to Biyahero come first — picking one keeps trips on
 * the corridors commuters are already searching — then anywhere else in the
 * Philippines via OpenStreetMap, so a driver in a town we have never seen
 * still gets a real, exact destination instead of free text.
 *
 * Driver-side only (auth): it takes a position to bias results, and no
 * commuter screen may ever send one.
 */
class PlaceController extends Controller
{
    public function __construct(protected Geocoder $geocoder) {}

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
            ->map(fn (Destination $d) => [
                'name' => $d->name,
                'subtitle' => $d->subtitle ?? '',
                'lat' => (float) $d->lat,
                'lng' => (float) $d->lng,
                'known' => true,
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
            ->map(fn (array $p) => [...$p, 'known' => false])
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
