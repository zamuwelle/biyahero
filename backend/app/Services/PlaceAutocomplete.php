<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Google Places Autocomplete, for the driver's destination box only.
 *
 * OpenStreetMap knows every town, barangay and street in the country and costs
 * nothing, which is why it still answers everywhere else in this app. What it
 * does not know is small businesses: an exhaustive country-wide search for
 * "Siowings" returned three, and none of them were the branches a driver can
 * actually name. Google has those, and nothing free does.
 *
 * Autocomplete, not Text Search, because a type-ahead is what this is: the
 * predictions are cheap, one Place Details call on selection carries the
 * charge, and a session token ties the two together so Google bills the pair
 * once instead of billing every keystroke.
 *
 * Every failure returns empty and the caller falls back to the geocoder. A
 * missing key, a spent quota and a dead network all look the same from here,
 * and all three should leave a driver with a working search.
 */
class PlaceAutocomplete
{
    private const SUGGEST = 'https://places.googleapis.com/v1/places:autocomplete';

    private const DETAILS = 'https://places.googleapis.com/v1/places/';

    /** A destination on this run, not across the country. */
    private const BIAS_RADIUS_M = 50000;

    public function configured(): bool
    {
        return (bool) config('services.google.places_key');
    }

    /**
     * Predictions for what the driver has typed so far.
     *
     * These carry no coordinates by design — that is what makes them cheap.
     * `resolve()` turns the one they pick into a point.
     *
     * @return array<array{name: string, subtitle: string, place_id: string, distance_m: int|null}>
     */
    public function suggest(string $query, ?float $lat, ?float $lng, string $session): array
    {
        $key = config('services.google.places_key');

        if (! $key) {
            return [];
        }

        $body = [
            'input' => $query,
            // Autocomplete spells this as a LIST. Text Search wants a single
            // `regionCode` instead, and mixing the two up is a silent 400 that
            // looks exactly like "Google found nothing".
            'includedRegionCodes' => ['PH'],
            'sessionToken' => $session,
        ];

        if ($lat !== null && $lng !== null) {
            // Bias, not restriction: a driver may well be asked for somewhere
            // outside the circle, and a search that refuses is worse than one
            // that merely prefers.
            $body['locationBias'] = [
                'circle' => ['center' => ['latitude' => $lat, 'longitude' => $lng], 'radius' => self::BIAS_RADIUS_M],
            ];
            // With an origin, each prediction comes back with how far it is,
            // so the list can say so without a second call.
            $body['origin'] = ['latitude' => $lat, 'longitude' => $lng];
        }

        try {
            $res = Http::withHeaders(['X-Goog-Api-Key' => $key])->timeout(8)->post(self::SUGGEST, $body);

            if (! $res->ok()) {
                Log::warning('Places autocomplete unavailable', ['status' => $res->status()]);

                return [];
            }

            return collect($res->json('suggestions') ?? [])
                // A queryPrediction is a category search ("pizza near me"),
                // not a place. A trip has to end somewhere specific.
                ->filter(fn (array $s) => isset($s['placePrediction']['placeId']))
                ->map(function (array $s): array {
                    $p = $s['placePrediction'];

                    return [
                        'name' => $p['structuredFormat']['mainText']['text'] ?? ($p['text']['text'] ?? ''),
                        'subtitle' => $p['structuredFormat']['secondaryText']['text'] ?? '',
                        'place_id' => $p['placeId'],
                        'distance_m' => isset($p['distanceMeters']) ? (int) $p['distanceMeters'] : null,
                    ];
                })
                ->filter(fn (array $p) => $p['name'] !== '')
                ->values()
                ->all();
        } catch (\Throwable $e) {
            Log::warning('Places autocomplete failed', ['error' => $e->getMessage()]);

            return [];
        }
    }

    /**
     * The point behind a prediction the driver picked.
     *
     * Passing the same session token as the predictions is what closes the
     * session: Google charges for the pair, not for every keystroke that led
     * to it.
     *
     * @return array{name: string, subtitle: string, lat: float, lng: float}|null
     */
    public function resolve(string $placeId, string $session): ?array
    {
        $key = config('services.google.places_key');

        if (! $key) {
            return null;
        }

        try {
            $res = Http::withHeaders([
                'X-Goog-Api-Key' => $key,
                'X-Goog-FieldMask' => 'displayName,formattedAddress,location',
            ])->timeout(8)->get(self::DETAILS.$placeId, ['sessionToken' => $session]);

            $location = $res->json('location');

            if (! $res->ok() || ! isset($location['latitude'], $location['longitude'])) {
                Log::warning('Place details unavailable', ['status' => $res->status()]);

                return null;
            }

            return [
                'name' => $res->json('displayName.text') ?? '',
                'subtitle' => $res->json('formattedAddress') ?? '',
                'lat' => (float) $location['latitude'],
                'lng' => (float) $location['longitude'],
            ];
        } catch (\Throwable $e) {
            Log::warning('Place details failed', ['error' => $e->getMessage()]);

            return null;
        }
    }
}
