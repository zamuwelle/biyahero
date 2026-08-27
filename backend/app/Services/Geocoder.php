<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Nominatim (OpenStreetMap) lookups, PH-bounded. This is what lets a driver
 * type ANY town — not just the seeded ones — and still get a real point on
 * the map. Failures return null and the caller degrades honestly instead of
 * guessing.
 */
class Geocoder
{
    private const BASE = 'https://nominatim.openstreetmap.org';

    private const HEADERS = ['User-Agent' => 'biyahero-hackathon/1.0'];

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
     *
     * Google Places first when a key is configured — it knows the terminals,
     * tindahan and landmarks drivers name, which OpenStreetMap largely does
     * not. OSM is the fallback, so search still works with no key at all.
     *
     * @return array<array{name: string, subtitle: string, lat: float, lng: float}>
     */
    public function searchMany(string $query, ?float $nearLat = null, ?float $nearLng = null, int $limit = 6): array
    {
        $google = $this->searchGoogle($query, $nearLat, $nearLng, $limit);

        if ($google !== []) {
            return $google;
        }

        return $this->searchOpenStreetMap($query, $nearLat, $nearLng, $limit);
    }

    /**
     * Google Places Text Search — one call returns name, address and
     * coordinates, so there is no follow-up Place Details request.
     *
     * @return array<array{name: string, subtitle: string, lat: float, lng: float}>
     */
    private function searchGoogle(string $query, ?float $lat, ?float $lng, int $limit): array
    {
        $key = config('services.google.maps_key');
        if (! $key) {
            return [];
        }

        $body = [
            'textQuery' => $query,
            'includedRegionCodes' => ['ph'],
            'maxResultCount' => $limit,
        ];

        if ($lat !== null && $lng !== null) {
            // 50 km around the driver: a jeepney destination is somewhere
            // they can actually drive to on this run.
            $body['locationBias'] = [
                'circle' => ['center' => ['latitude' => $lat, 'longitude' => $lng], 'radius' => 50000],
            ];
        }

        try {
            $res = Http::withHeaders([
                'X-Goog-Api-Key' => $key,
                'X-Goog-FieldMask' => 'places.displayName,places.formattedAddress,places.location',
            ])->timeout(10)->post('https://places.googleapis.com/v1/places:searchText', $body);

            if (! $res->ok()) {
                // A disabled Places API answers 403 on every call — log once
                // per failure and let OpenStreetMap carry the search.
                Log::warning('Google Places unavailable, falling back to OSM', ['status' => $res->status()]);

                return [];
            }

            return collect($res->json('places') ?? [])
                ->map(fn (array $place) => [
                    'name' => $place['displayName']['text'] ?? '',
                    'subtitle' => $place['formattedAddress'] ?? '',
                    'lat' => (float) ($place['location']['latitude'] ?? 0),
                    'lng' => (float) ($place['location']['longitude'] ?? 0),
                ])
                ->filter(fn (array $p) => $p['name'] !== '' && $p['lat'] !== 0.0)
                ->values()
                ->all();
        } catch (\Throwable $e) {
            Log::warning('Google Places call failed', ['error' => $e->getMessage()]);

            return [];
        }
    }

    /** @return array<array{name: string, subtitle: string, lat: float, lng: float}> */
    private function searchOpenStreetMap(string $query, ?float $nearLat, ?float $nearLng, int $limit): array
    {
        $params = [
            'q' => $query,
            'format' => 'json',
            'limit' => $limit,
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
