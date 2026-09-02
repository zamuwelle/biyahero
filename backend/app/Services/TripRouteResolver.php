<?php

namespace App\Services;

use App\Models\Destination;
use App\Models\Route;
use Illuminate\Support\Facades\Cache;

/**
 * Decides which route a trip runs on — and builds one when none exists.
 *
 * The old resolver fell back to Route::first() (a Metro Manila corridor) for
 * any unknown destination, which put Tarlac drivers on a Cubao line. This one
 * never guesses: it reuses a route only when it passes near BOTH the driver
 * and the destination, otherwise it road-snaps a brand-new route from where
 * the driver actually is to where they said they are going.
 */
class TripRouteResolver
{
    /** A route must pass this close to the DRIVER to be reused as-is. */
    public const DRIVER_RADIUS_M = 800;

    /**
     * How far a hand-placed road may sit from one already stored and still
     * count as the same route. A driver taps a junction roughly, from a moving
     * jeepney; an exact match would never fire and every run would mint a new
     * near-identical route.
     */
    private const SAME_ROUTE_RADIUS_M = 250;

    public function __construct(
        protected CorridorMatcher $corridor,
        protected RouteGeometry $geometry,
        protected Geocoder $geocoder,
    ) {}

    /**
     * @return array{route: Route, destination: string, target: array{lat: float, lng: float}|null}|null
     */
    /**
     * @param  array<array{lat: float, lng: float, name?: string}>  $via
     *                                                                    Roads the driver says they actually take on the way. A jeepney route
     *                                                                    is defined by the roads it uses, not by its endpoints — two jeepneys
     *                                                                    running Victoria to Tarlac by different highways are different routes,
     *                                                                    and a commuter on the road one of them skips must not be told it
     *                                                                    passes them.
     */
    public function resolve(
        ?int $routeId,
        string $destinationText,
        ?float $destLat,
        ?float $destLng,
        ?float $driverLat,
        ?float $driverLng,
        array $via = [],
    ): ?array {
        // An explicit route id is the driver tapping a listed route — honour it.
        // Its precise target is the route's far end.
        if ($routeId && ($route = Route::find($routeId))) {
            // Local copy: end() takes a reference, which an Eloquent accessor
            // cannot provide.
            $waypoints = $route->waypoints ?? [];
            $end = $waypoints === [] ? null : end($waypoints);

            return [
                'route' => $route,
                'destination' => $destinationText,
                'target' => $end ? ['lat' => (float) $end['lat'], 'lng' => (float) $end['lng']] : null,
            ];
        }

        // No driver fix means no way to know which corridor they are on and no
        // start point for a new route. Refusing beats guessing — guessing is
        // precisely how Tarlac drivers used to end up on Manila corridors.
        if ($driverLat === null || $driverLng === null) {
            return null;
        }

        $target = $this->destinationPoint($destinationText, $destLat, $destLng, $driverLat, $driverLng);
        if (! $target) {
            return null;
        }

        // Commuters must be able to search this trip and pin its destination,
        // whether the corridor is reused or freshly built.
        $target['name'] = $this->ensureDestination($target);

        $point = ['lat' => $target['lat'], 'lng' => $target['lng']];

        // Only when the driver has NOT said which roads they take. Handing
        // them a corridor that happens to end in the right town would throw
        // away the one thing they just told us.
        if ($via === [] && $route = $this->reusableRoute($target, $driverLat, $driverLng)) {
            return ['route' => $route, 'destination' => $target['name'], 'target' => $point];
        }

        // The same driver runs the same custom route every day. Matching it
        // back to one already built keeps a stable corridor for commuters to
        // search against, instead of a fresh near-identical row per trip.
        if ($via !== [] && $route = $this->matchingCustomRoute($driverLat, $driverLng, $target, $via)) {
            return ['route' => $route, 'destination' => $target['name'], 'target' => $point];
        }

        return [
            'route' => $this->createRoute($driverLat, $driverLng, $target, $via),
            'destination' => $target['name'],
            'target' => $point,
        ];
    }

    /**
     * Where the trip is going: a pinned coordinate, a known destination, or a
     * freshly geocoded place — in that order of trust.
     *
     * Name matches are ranked by distance to the DRIVER, not table order: PH
     * barangay names repeat in nearly every town ("Poblacion", "San Isidro"),
     * and a Tarlac driver typing one means the one beside them, not whichever
     * namesake happened to be inserted first.
     *
     * @return array{lat: float, lng: float, name: string}|null
     */
    private function destinationPoint(string $text, ?float $lat, ?float $lng, float $driverLat, float $driverLng): ?array
    {
        if ($lat !== null && $lng !== null) {
            $name = trim($text) !== '' ? trim($text) : ($this->geocoder->reverse($lat, $lng) ?? 'Piniling lokasyon');

            return ['lat' => $lat, 'lng' => $lng, 'name' => $name];
        }

        $needle = mb_strtolower(trim($text));
        if ($needle === '') {
            return null;
        }

        $rows = Destination::query()->get();

        $matches = $rows->filter(fn (Destination $d) => mb_strtolower($d->name) === $needle);
        if ($matches->isEmpty()) {
            $matches = $rows->filter(
                fn (Destination $d) => str_contains(mb_strtolower($d->name), $needle) || str_contains($needle, mb_strtolower($d->name))
            );
        }

        $known = $matches->sortBy(
            fn (Destination $d) => $this->corridor->minDistanceToRoute($driverLat, $driverLng, [['lat' => (float) $d->lat, 'lng' => (float) $d->lng]])
        )->first();

        if ($known) {
            return ['lat' => (float) $known->lat, 'lng' => (float) $known->lng, 'name' => $known->name];
        }

        $found = $this->geocoder->search($text);

        return $found ? ['lat' => $found['lat'], 'lng' => $found['lng'], 'name' => $found['name']] : null;
    }

    /**
     * A route is reusable only when it serves the destination AND actually
     * passes where the driver is standing — that second check is what stops a
     * Tarlac driver from being put on a Manila corridor with the same name.
     *
     * @param  array{lat: float, lng: float, name: string}  $target
     */
    /**
     * Driver, every road they named, then the destination — in that order,
     * which is the order they are driven.
     *
     * @param  array{lat: float, lng: float, name?: string}  $target
     * @param  array<array{lat: float, lng: float, name?: string}>  $via
     * @return array<array{lat: float, lng: float}>
     */
    private static function controlPoints(float $driverLat, float $driverLng, array $target, array $via): array
    {
        return [
            ['lat' => $driverLat, 'lng' => $driverLng],
            ...array_map(fn (array $point) => [
                'lat' => (float) $point['lat'],
                'lng' => (float) $point['lng'],
            ], $via),
            ['lat' => (float) $target['lat'], 'lng' => (float) $target['lng']],
        ];
    }

    /**
     * A route already built from the same hand-placed roads.
     *
     * Same count, and every point within a block of the one before it. The
     * driver taps roughly, not precisely, so an exact coordinate match would
     * never fire and every run would mint another route.
     *
     * @param  array{lat: float, lng: float, name?: string}  $target
     * @param  array<array{lat: float, lng: float, name?: string}>  $via
     */
    private function matchingCustomRoute(float $driverLat, float $driverLng, array $target, array $via): ?Route
    {
        $wanted = self::controlPoints($driverLat, $driverLng, $target, $via);

        return Route::query()
            ->whereNotNull('control_points')
            ->get()
            ->first(function (Route $route) use ($wanted) {
                $have = $route->control_points ?? [];
                if (count($have) !== count($wanted)) {
                    return false;
                }

                foreach ($wanted as $i => $point) {
                    $apart = $this->corridor->minDistanceToRoute($point['lat'], $point['lng'], [$have[$i]]);

                    if ($apart > self::SAME_ROUTE_RADIUS_M) {
                        return false;
                    }
                }

                return true;
            });
    }

    private function reusableRoute(array $target, float $driverLat, float $driverLng): ?Route
    {
        $nearDestination = $this->corridor->routeIdsNear($target['lat'], $target['lng'], CorridorMatcher::SERVES_RADIUS_M);
        if ($nearDestination === []) {
            return null;
        }

        return Route::query()->whereIn('id', $nearDestination)->get()
            ->map(fn (Route $route) => [
                'route' => $route,
                'driver_m' => $this->corridor->minDistanceToRoute($driverLat, $driverLng, $route->waypoints ?? []),
            ])
            ->filter(fn (array $x) => $x['driver_m'] <= self::DRIVER_RADIUS_M)
            // Id as tie-break: equidistant corridors must pick deterministically.
            ->sortBy(fn (array $x) => [$x['driver_m'], $x['route']->id])
            ->value('route');
    }

    /** Roughly how far two points can sit apart and still be "the same place". */
    private const SAME_PLACE_M = 2000;

    /**
     * Guarantees a searchable Destination row for the target and returns the
     * canonical name the trip should carry.
     *
     * A same-name row that is genuinely the same place (within 2 km) is
     * reused. A same-name row somewhere ELSE — "Poblacion" exists in nearly
     * every PH town, and pinned spots often reverse-geocode to one — gets a
     * town-qualified name instead, because names are the join key everywhere
     * (commuter search, the pin cache): letting the first namesake keep the
     * key would silently point every later trip at the wrong town.
     *
     * @param  array{lat: float, lng: float, name: string}  $target
     */
    private function ensureDestination(array $target): string
    {
        // Fold in PHP — SQLite's LOWER() is ASCII-only ("Parañaque" trap).
        $sameName = Destination::query()->get()->filter(
            fn (Destination $d) => mb_strtolower($d->name) === mb_strtolower($target['name'])
        );

        $samePlace = $sameName->first(
            fn (Destination $d) => $this->corridor->minDistanceToRoute(
                $target['lat'],
                $target['lng'],
                [['lat' => (float) $d->lat, 'lng' => (float) $d->lng]]
            ) <= self::SAME_PLACE_M
        );

        if ($samePlace) {
            return $samePlace->name;
        }

        $name = $target['name'];
        if ($sameName->isNotEmpty()) {
            $town = $this->geocoder->reverse($target['lat'], $target['lng']);
            $name = $town && mb_strtolower($town) !== mb_strtolower($name)
                ? "{$name} ({$town})"
                : sprintf('%s (%.3f, %.3f)', $name, $target['lat'], $target['lng']);
        }

        Destination::create([
            'name' => $name,
            'subtitle' => $name,
            'lat' => $target['lat'],
            'lng' => $target['lng'],
            'is_popular' => false,
        ]);

        Cache::forget('destinations.by-name');

        return $name;
    }

    /**
     * @param  array{lat: float, lng: float, name: string}  $target
     * @param  array<array{lat: float, lng: float, name?: string}>  $via
     */
    private function createRoute(float $driverLat, float $driverLng, array $target, array $via = []): Route
    {
        $controlPoints = self::controlPoints($driverLat, $driverLng, $target, $via);
        $snapped = $this->geometry->snapToRoads($controlPoints);

        $startName = $this->geocoder->reverse($driverLat, $driverLng) ?? 'Kasalukuyang lokasyon';
        // Deliberately NOT "A → B via C". Half the app parses this label by
        // splitting on the arrow and taking the far side as the destination;
        // appending anything there renames the destination everywhere it shows.
        // The roads live in control_points, where they belong.
        $label = "{$startName} \u{2192} {$target['name']}";

        return Route::create([
            'name' => $label,
            'label' => $label,
            'control_points' => $controlPoints,
            'waypoints' => $snapped['waypoints'],
            'length_km' => $snapped['length_km'],
            'duration_min' => $snapped['duration_min'],
            'road_matched' => $snapped['matched'],
        ]);
    }
}
