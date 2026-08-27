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
