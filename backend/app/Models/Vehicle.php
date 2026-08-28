<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    protected $fillable = [
        'user_id', 'vehicle_code', 'vehicle_type', 'plate_number', 'model', 'body_number',
        'occupancy', 'route_id', 'current_waypoint_index', 'direction',
        'live_lat', 'live_lng', 'last_ping_at', 'current_street',
    ];

    protected $casts = [
        'live_lat' => 'float',
        'live_lng' => 'float',
        'last_ping_at' => 'datetime',
    ];

    /** Plates are painted on the vehicle; spacing varies, the characters do not. */
    public static function normalisePlate(string $plate): string
    {
        return strtoupper(preg_replace('/\s+/', ' ', trim($plate)) ?? '');
    }

    public function route()
    {
        return $this->belongsTo(Route::class);
    }

    public function driver()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function trips()
    {
        return $this->hasMany(Trip::class);
    }

    public function activeTrip()
    {
        return $this->hasOne(Trip::class)->whereNull('ended_at')->latestOfMany();
    }

    /**
     * Where this vehicle actually is, or null.
     *
     * There is no fallback on purpose: guessing from the profile route once
     * plotted every driver who had not pinged yet onto a Manila corridor they
     * had never driven. A vehicle nobody has heard from has no position, and
     * the app renders that honestly.
     *
     * @return array{lat: float, lng: float}|null
     */
    public function currentPosition(): ?array
    {
        if ($this->live_lat === null || $this->live_lng === null) {
            return null;
        }

        return ['lat' => (float) $this->live_lat, 'lng' => (float) $this->live_lng];
    }

    /**
     * Minutes since the last ping. Null means we have never heard from this
     * vehicle — the client renders that as Stale, never as "just arrived".
     */
    public function minutesSincePing(): ?int
    {
        return $this->last_ping_at ? (int) $this->last_ping_at->diffInMinutes(now()) : null;
    }
}
