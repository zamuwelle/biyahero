<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Nominatim (OpenStreetMap) lookups, PH-bounded. This is what lets a driver
 * type ANY town — not just the seeded ones — and still get a real point on
 * the map. Failures return null and the caller degrades honestly instead of
 * guessing.
 *
 * One provider by choice: no paid geocoder, so nothing here needs a key or a
 * billing account, and the app behaves the same on every machine.
 */
class Geocoder
{
    private const BASE = 'https://nominatim.openstreetmap.org';

    private const HEADERS = ['User-Agent' => 'biyahero-hackathon/1.0'];

    /**
     * How many candidates to ask Nominatim for, regardless of how many we
     * mean to show.
     *
     * Nominatim ranks by its own idea of importance and treats the viewbox as
     * a hint, so a short list comes back full of famous far-away matches: a
     * driver in Victoria searching "Jollibee" was offered Calasiao, 100 km
     * north, and "Mercury Drug" got them Lucban, 200 km south — the nearby
     * branches were simply not in the twelve rows. Asking for a real pool and
     * ranking it ourselves puts the reachable one first.
     */
    private const CANDIDATES = 40;

    /**
     * Below this many results the query is treated as having failed to parse,
     * and the trailing-token retry runs. Kept low so the common case stays a
     * single request against a service that asks for one call a second.
     */
    private const THIN = 3;

    /** @return array{lat: float, lng: float, name: string}|null */
    public function search(string $query): ?array
    {
        try {
            $res = Http::withHeaders(self::HEADERS)->timeout(10)->get(self::BASE.'/search', [
                'q' => $query,
                'format' => 'json',
                'limit' => 1,
                'countrycodes' => 'ph',
            ]);

            $hit = $res->json('0');
            if (! $res->ok() || ! $hit) {
                return null;
            }

            return [
                'lat' => (float) $hit['lat'],
                'lng' => (float) $hit['lon'],
                // "Pura, Tarlac, Central Luzon, Philippines" → "Pura"
                'name' => trim(explode(',', $hit['display_name'] ?? $query)[0]) ?: $query,
            ];
        } catch (\Throwable $e) {
            Log::warning('Nominatim search failed', ['q' => $query, 'error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Type-ahead search: several candidates, biased toward the driver so
     * "Poblacion" offers the one beside them before a namesake province away.
     * Ranking is the caller's job — it is the only side that knows where the
     * driver is standing.
     *
     * OpenStreetMap only, on purpose. It knows every town, barangay and street
     * in the country and costs nothing, which is the trade Biyahero wants: no
     * key to leak, no billing account, no per-keystroke charge. The gap is
     * businesses — a sari-sari store or a mall by brand name is often missing —
     * and seeded Destinations cover the ones that matter.
     *
     * @return array<array{name: string, subtitle: string, lat: float, lng: float}>
     */
    public function searchMany(string $query, ?float $nearLat = null, ?float $nearLng = null, int $limit = 6): array
    {
        $hits = $this->ask($query, $nearLat, $nearLng);

        // "Siowings apalit" finds nothing. "Siowings" finds it.
        //
        // Nominatim reads a free-text query as ONE place, so a business name
        // with the town appended — which is exactly how people search — matches
        // neither the business nor the town. Dropping the trailing word and
        // keeping it as a hint recovers the place, and the hint still lets the
        // ranker prefer the branch in the town they actually named.
        $tokens = preg_split('/[\s,\-]+/u', trim($query), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if (count($hits) < self::THIN && count($tokens) >= 2) {
            array_pop($tokens);
            $hits = array_merge($hits, $this->ask(implode(' ', $tokens), $nearLat, $nearLng));
        }

        return collect($hits)
            ->unique(fn (array $p) => mb_strtolower($p['name']).'|'.round($p['lat'], 4).'|'.round($p['lng'], 4))
            ->values()
            ->all();
    }

    /**
     * The trailing word of a multi-word query, which is usually the town the
     * user tacked on. The ranker uses it to break ties; nothing else does.
     */
    public function areaHint(string $query): ?string
    {
        $tokens = preg_split('/[\s,\-]+/u', trim($query), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return count($tokens) >= 2 ? mb_strtolower(end($tokens)) : null;
    }

    /**
     * One Nominatim pass.
     *
     * @return array<array{name: string, subtitle: string, lat: float, lng: float, importance: float}>
     */
    private function ask(string $query, ?float $nearLat, ?float $nearLng): array
    {
        $params = [
            'q' => $query,
            'format' => 'json',
            'limit' => self::CANDIDATES,
            'countrycodes' => 'ph',
            'addressdetails' => 1,
        ];

        if ($nearLat !== null && $nearLng !== null) {
            // Preference, not a filter: bounded=0 still returns far matches
            // when nothing nearby fits.
            $params['viewbox'] = sprintf('%F,%F,%F,%F', $nearLng - 0.6, $nearLat + 0.6, $nearLng + 0.6, $nearLat - 0.6);
            $params['bounded'] = 0;
        }

        try {
            $res = Http::withHeaders(self::HEADERS)->timeout(10)->get(self::BASE.'/search', $params);

            if (! $res->ok() || ! is_array($res->json())) {
                return [];
            }

            return collect($res->json())
                ->map(function (array $hit): array {
                    $parts = array_map('trim', explode(',', $hit['display_name'] ?? ''));
                    $name = $hit['name'] ?? ($parts[0] ?? '');

                    // Drop the country and postcode wherever they sit — a
                    // driver reads "Cutcut, Angeles", not a postal address.
                    $context = array_values(array_filter(
                        array_slice($parts, 1),
                        fn (string $part) => $part !== ''
                            && ! preg_match('/^\d{3,5}$/', $part)
                            && mb_strtolower($part) !== 'philippines'
                    ));

                    return [
                        'name' => $name !== '' ? $name : ($parts[0] ?? 'Lugar'),
                        'subtitle' => implode(', ', array_slice($context, 0, 3)),
                        'lat' => (float) $hit['lat'],
                        'lng' => (float) $hit['lon'],
                        // Nominatim's own popularity prior. It is what keeps
                        // the town of Victoria above a shop called Victoria.
                        'importance' => (float) ($hit['importance'] ?? 0),
                    ];
                })
                ->filter(fn (array $place) => $place['name'] !== '')
                ->values()
                ->all();
        } catch (\Throwable $e) {
            Log::warning('Nominatim type-ahead failed', ['q' => $query, 'error' => $e->getMessage()]);

            return [];
        }
    }

    /** Short place name for a coordinate — barangay or town, nearest first. */
    public function reverse(float $lat, float $lng): ?string
    {
        try {
            $res = Http::withHeaders(self::HEADERS)->timeout(10)->get(self::BASE.'/reverse', [
                'lat' => $lat,
                'lon' => $lng,
                'format' => 'json',
                'zoom' => 14,
            ]);

            $address = $res->json('address');
            if (! $res->ok() || ! $address) {
                return null;
            }

            foreach (['village', 'suburb', 'town', 'city', 'municipality'] as $key) {
                if (! empty($address[$key])) {
                    return $address[$key];
                }
            }

            return null;
        } catch (\Throwable $e) {
            Log::warning('Nominatim reverse failed', ['error' => $e->getMessage()]);

            return null;
        }
    }
}
