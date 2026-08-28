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
     * What Biyahero draws, by OSM tag.
     *
     * `shop` and `office` take ANY value, because that is where a Philippine
     * poblacion actually lives — a survey over Tarlac came back 91 sari-sari
     * stores, 23 pawnshops, 18 phone shops, water refilling stations, Bayad
     * Centers. Enumerating those was always going to miss the next one, and a
     * shop we have no icon for is still a shop worth a pin.
     *
     * `amenity` and the rest need an allowlist: that tag also carries benches,
     * waste baskets and bicycle parking, none of which is a place you go.
     *
     * @var array<string, array{allow: array<string, string>, default?: string}>
     */
    private const TAGS = [
        'public_transport' => [
            'allow' => ['station' => 'terminal'],
        ],
        'amenity' => [
            'allow' => [
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
                'childcare' => 'school',
                'library' => 'school',
                'driving_school' => 'school',
                'place_of_worship' => 'worship',
                'marketplace' => 'market',
                'townhall' => 'government',
                'courthouse' => 'government',
                'police' => 'government',
                'fire_station' => 'government',
                'post_office' => 'government',
                'community_centre' => 'government',
                'social_facility' => 'government',
                'fuel' => 'fuel',
                'bank' => 'bank',
                'atm' => 'bank',
                'bureau_de_change' => 'bank',
                // Remittance and bills counters. A Bayad Center is a landmark
                // and an errand at once, which is most of why anyone rides.
                'money_transfer' => 'bank',
                'payment_centre' => 'bank',
                'restaurant' => 'food',
                'cafe' => 'food',
                'fast_food' => 'food',
                'food_court' => 'food',
                'ice_cream' => 'food',
                'bar' => 'food',
                'pub' => 'food',
                'internet_cafe' => 'store',
                'car_wash' => 'store',
                'cinema' => 'culture',
                'theatre' => 'culture',
            ],
        ],
        'shop' => [
            'default' => 'store',
            'allow' => [
                'bakery' => 'food',
                'confectionery' => 'food',
                'deli' => 'food',
                'butcher' => 'food',
                'greengrocer' => 'food',
                'seafood' => 'food',
                'tea' => 'food',
                'coffee' => 'food',
                'chemist' => 'pharmacy',
                'medical_supply' => 'pharmacy',
                'optician' => 'pharmacy',
                // Pawnshops and remittance counters are landmarks here — an
                // M Lhuillier on the corner is how a whole barangay gives
                // directions, whatever Google's category list thinks.
                'pawnbroker' => 'bank',
                'money_lender' => 'bank',
                'money_transfer' => 'bank',
                'mall' => 'mall',
                'department_store' => 'mall',
                'supermarket' => 'mall',
            ],
        ],
        'office' => [
            'default' => 'store',
            'allow' => ['government' => 'government'],
        ],
        'tourism' => [
            'allow' => [
                'hotel' => 'hotel',
                'motel' => 'hotel',
                'guest_house' => 'hotel',
                'hostel' => 'hotel',
                'resort' => 'hotel',
                'attraction' => 'culture',
                'museum' => 'culture',
                'viewpoint' => 'park',
            ],
        ],
        'leisure' => [
            'allow' => [
                'park' => 'park',
                'stadium' => 'park',
                'sports_centre' => 'park',
                'fitness_centre' => 'park',
                'playground' => 'park',
                'swimming_pool' => 'park',
            ],
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
        'mall' => 2,
        'park' => 3,
        'culture' => 3,
        'fuel' => 3,
        'pharmacy' => 4,
        'bank' => 4,
        // Now that any named shop qualifies, "store" is mostly sari-sari
        // stores and repair shops. Worth a pin, not worth a terminal's slot.
        'hotel' => 5,
        'store' => 5,
        'food' => 6,
    ];

    /**
     * @return array<array{id: string, name: string, kind: string, lat: float, lng: float}>
     */
    public function inBox(float $south, float $west, float $north, float $east, int $limit = 150): array
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
            $clauses[] = isset($spec['default'])
                ? sprintf('nwr["name"]["%s"](%s);', $tag, $bbox)
                : sprintf('nwr["name"]["%s"~"^(%s)$"](%s);', $tag, implode('|', array_keys($spec['allow'])), $bbox);
        }

        // `out tags center` gives one point per element, so a mall mapped as a
        // building outline arrives as a single pin like a shop mapped as a dot.
        $ql = "[out:json][timeout:40];\n(\n".implode("\n", $clauses)."\n);\nout tags center 900;";

        try {
            $res = Http::asForm()
                ->withHeaders(['User-Agent' => 'biyahero-hackathon/1.0'])
                ->timeout(50)
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
     * @return array{id: string, name: string, kind: string, rank: int, lat: float, lng: float}|null
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
            if ($value === null || $value === 'no') {
                continue;
            }

            // An open tag keeps anything named; an allowlist keeps its own.
            $kind = $spec['allow'][$value] ?? ($spec['default'] ?? null);
            if ($kind !== null) {
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
            // The client keeps places from several viewports at once so that
            // panning does not tear down every marker. Merged sets lose our
            // ordering, so it travels with the row and is re-sorted there.
            'rank' => self::PRIORITY[$kind] ?? 9,
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
