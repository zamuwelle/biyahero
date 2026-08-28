<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Every named place inside a map viewport, from OpenStreetMap's Overpass API.
 *
 * This exists because of a hard limit in the Google Maps Android SDK: a custom
 * map style only applies to the plain map type. On satellite and terrain the
 * SDK draws its own labels, far fewer of them, and nothing we send changes
 * that — so the three layers showed three different sets of places. Carrying
 * our own layer is the only way they can match: the same markers appear on
 * every layer because Biyahero puts them there, not Google.
 *
 * Failures return an empty list. A map with no shop pins is a smaller loss
 * than a map that will not load.
 */
class PoiFinder
{
    private const ENDPOINT = 'https://overpass-api.de/api/interpreter';

    /**
     * Viewports snap outward to this grid before becoming a cache key, so
     * nudging the map a block over reuses the answer instead of paying for
     * another round trip. ~2.2 km, comfortably finer than one screen.
     */
    private const GRID = 0.02;

    /**
     * Wider than this and the query stops being about "what is around me" —
     * it is a province-sized scrape that Overpass will throttle and no phone
     * can draw. The client keeps the POI layer off at those zooms anyway.
     */
    private const MAX_SPAN = 0.30;

    /**
     * OSM tags worth drawing, and the icon family each maps to. Wide on
     * purpose: the ask was for the map to know what is actually there, and a
     * poblacion is mostly sari-sari stores, pawnshops and clinics. What each
     * one is worth once the screen runs out of room is PRIORITY's job, below.
     *
     * @var array<string, array{kinds: array<string, string>}>
     */
    private const TAGS = [
        'public_transport' => [
            'kinds' => ['station' => 'terminal'],
        ],
        'amenity' => [
            'kinds' => [
                'bus_station' => 'terminal',
                'ferry_terminal' => 'terminal',
                'hospital' => 'hospital',
                'clinic' => 'hospital',
                'doctors' => 'hospital',
                'dentist' => 'hospital',
                'veterinary' => 'hospital',
                'pharmacy' => 'pharmacy',
                'school' => 'school',
                'university' => 'school',
                'college' => 'school',
                'kindergarten' => 'school',
                'library' => 'school',
                'place_of_worship' => 'worship',
                'marketplace' => 'market',
                'townhall' => 'government',
                'courthouse' => 'government',
                'police' => 'government',
                'fire_station' => 'government',
                'post_office' => 'government',
                'community_centre' => 'government',
                'fuel' => 'fuel',
                'bank' => 'bank',
                'atm' => 'bank',
                'bureau_de_change' => 'bank',
                'money_transfer' => 'bank',
                'restaurant' => 'food',
                'cafe' => 'food',
                'fast_food' => 'food',
                'ice_cream' => 'food',
            ],
        ],
        'shop' => [
            'kinds' => [
                'mall' => 'store',
                'department_store' => 'store',
                'supermarket' => 'store',
                'convenience' => 'store',
                'variety_store' => 'store',
                'general' => 'store',
                'hardware' => 'store',
                'doityourself' => 'store',
                'electronics' => 'store',
                'mobile_phone' => 'store',
                'clothes' => 'store',
                'furniture' => 'store',
                'optician' => 'store',
                'butcher' => 'store',
                'greengrocer' => 'store',
                'car_repair' => 'store',
                'motorcycle' => 'store',
                'chemist' => 'pharmacy',
                // Pawnshops and remittance counters are landmarks here — an
                // M Lhuillier on the corner is how a whole barangay gives
                // directions, whatever Google's category list thinks.
                'pawnbroker' => 'bank',
                'money_lender' => 'bank',
                'bakery' => 'food',
            ],
        ],
        'tourism' => [
            'kinds' => ['hotel' => 'hotel', 'motel' => 'hotel', 'guest_house' => 'hotel', 'attraction' => 'park', 'museum' => 'park'],
        ],
        'leisure' => [
            'kinds' => ['park' => 'park', 'stadium' => 'park', 'sports_centre' => 'park'],
        ],
    ];

    /**
     * How badly each kind wants to survive the cap. Terminals and landmarks
     * are how people describe where they are ("sa tapat ng simbahan"); a
     * convenience store is not worth crowding one out.
     *
     * @var array<string, int>
     */
    private const PRIORITY = [
        'terminal' => 0,
        'worship' => 1,
        'school' => 1,
        'hospital' => 1,
        'market' => 1,
        'government' => 2,
        'store' => 2,
        'park' => 3,
        'fuel' => 3,
        'pharmacy' => 4,
        'bank' => 4,
        'hotel' => 5,
        'food' => 6,
    ];

    /**
     * @return array<array{id: string, name: string, kind: string, lat: float, lng: float}>
     */
    public function inBox(float $south, float $west, float $north, float $east, int $limit = 60): array
    {
        if ($north <= $south || $east <= $west) {
            return [];
        }

        if ($north - $south > self::MAX_SPAN || $east - $west > self::MAX_SPAN) {
            return [];
        }

        // Snap outward, so a viewport that only shifted a little lands on the
        // same key. Every caller of the same neighbourhood shares one answer.
        $box = [
            floor($south / self::GRID) * self::GRID,
            floor($west / self::GRID) * self::GRID,
            ceil($north / self::GRID) * self::GRID,
            ceil($east / self::GRID) * self::GRID,
        ];

        // A day: shops open and close, but not fast enough to be worth asking
        // Overpass again mid-demo, and it is a shared public service.
        $places = Cache::remember(
            'poi:'.implode(',', array_map(fn (float $v) => number_format($v, 3, '.', ''), $box)),
            86400,
            fn () => $this->query(...$box)
        );

        return $this->rank($places, $south, $west, $north, $east, $limit);
    }

    /**
     * @return array<array{id: string, name: string, kind: string, lat: float, lng: float}>
     */
    private function query(float $south, float $west, float $north, float $east): array
    {
        $bbox = sprintf('%F,%F,%F,%F', $south, $west, $north, $east);

        $clauses = [];
        foreach (self::TAGS as $tag => $spec) {
            $values = implode('|', array_keys($spec['kinds']));
            $clauses[] = sprintf('nwr["name"]["%s"~"^(%s)$"](%s);', $tag, $values, $bbox);
        }

        // `out tags center` gives one point per element, so a mall mapped as a
        // building outline arrives as a single pin like a shop mapped as a dot.
        $ql = "[out:json][timeout:20];\n(\n".implode("\n", $clauses)."\n);\nout tags center 400;";

        try {
            $res = Http::asForm()
                ->withHeaders(['User-Agent' => 'biyahero-hackathon/1.0'])
                ->timeout(25)
                ->post(self::ENDPOINT, ['data' => $ql]);

            if (! $res->ok() || ! is_array($res->json('elements'))) {
                Log::warning('Overpass POI lookup failed', ['status' => $res->status(), 'bbox' => $bbox]);

                return [];
            }

            return collect($res->json('elements'))
                ->map(fn (array $el) => $this->normalise($el))
                ->filter()
                ->unique('id')
                ->values()
                ->all();
        } catch (\Throwable $e) {
            Log::warning('Overpass POI lookup threw', ['bbox' => $bbox, 'error' => $e->getMessage()]);

            return [];
        }
    }

    /**
     * One Overpass element into one pin, or null when it is not something we
     * can place on a map.
     *
     * @return array{id: string, name: string, kind: string, lat: float, lng: float}|null
     */
    private function normalise(array $element): ?array
    {
        $tags = $element['tags'] ?? [];
        $name = trim((string) ($tags['name'] ?? ''));

        // A way or relation carries its point in `center`; a node is the point.
        $lat = $element['lat'] ?? ($element['center']['lat'] ?? null);
        $lng = $element['lon'] ?? ($element['center']['lon'] ?? null);

        if ($name === '' || $lat === null || $lng === null) {
            return null;
        }

        $kind = null;
        foreach (self::TAGS as $tag => $spec) {
            $value = $tags[$tag] ?? null;
            if ($value !== null && isset($spec['kinds'][$value])) {
                $kind = $spec['kinds'][$value];
                break;
            }
        }

        if ($kind === null) {
            return null;
        }

        return [
            // Stable across refetches, so React keys and the client's own
            // de-duplication both hold when two viewports overlap.
            'id' => ($element['type'] ?? 'node').'/'.($element['id'] ?? 0),
            'name' => $name,
            'kind' => $kind,
            'lat' => (float) $lat,
            'lng' => (float) $lng,
        ];
    }

    /**
     * Cut the cached grid square down to what is actually on screen, then to
     * what a phone can draw: most useful kinds first, and within a kind the
     * ones nearest the middle of the view.
     *
     * @param  array<array{id: string, name: string, kind: string, lat: float, lng: float}>  $places
     * @return array<array{id: string, name: string, kind: string, lat: float, lng: float}>
     */
    private function rank(array $places, float $south, float $west, float $north, float $east, int $limit): array
    {
        $midLat = ($south + $north) / 2;
        $midLng = ($west + $east) / 2;

        return collect($places)
            ->filter(fn (array $p) => $p['lat'] >= $south && $p['lat'] <= $north
                && $p['lng'] >= $west && $p['lng'] <= $east)
            ->sortBy(fn (array $p) => [
                self::PRIORITY[$p['kind']] ?? 9,
                ($p['lat'] - $midLat) ** 2 + ($p['lng'] - $midLng) ** 2,
            ])
            ->take(max(1, $limit))
            ->values()
            ->all();
    }
}
