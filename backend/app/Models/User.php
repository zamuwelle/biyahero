<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'name', 'phone', 'email', 'password',
        'license_no', 'license_hash', 'license_lookup', 'license_expires_at', 'license_photo_path',
        'is_verified', 'verification_status', 'approved_at', 'rejection_reason',
    ];

    /**
     * license_* never leaves the server: the number proves registration and the
     * photo is reviewer-only. Neither is ever a display field.
     */
    /**
     * Nothing licence-derived is ever serialised. `license_lookup` is a keyed
     * HMAC, so leaking it would let anyone confirm a guessed licence number.
     */
    protected $hidden = ['password', 'license_no', 'license_hash', 'license_lookup', 'license_photo_path'];

    protected $casts = [
        'is_verified' => 'boolean',
        'approved_at' => 'datetime',
        'license_expires_at' => 'date',
    ];

    public function vehicle()
    {
        return $this->hasOne(Vehicle::class);
    }

    public function trips()
    {
        return $this->hasManyThrough(Trip::class, Vehicle::class);
    }

    /** "Roberto Santos" -> "Roberto S." — the only form shown to commuters. */
    public function shortName(): string
    {
        $parts = preg_split('/\s+/', trim((string) $this->name)) ?: [];
        if (count($parts) < 2) {
            return $this->name ?? '';
        }

        return $parts[0].' '.strtoupper(substr(end($parts), 0, 1)).'.';
    }

    public function isApproved(): bool
    {
        return $this->verification_status === 'approved' && ! $this->licenceHasExpired();
    }

    /** A licence that lapses after registration must stop the driver working. */
    public function licenceHasExpired(): bool
    {
        return $this->license_expires_at !== null && $this->license_expires_at->isPast();
    }

    /*
     * Driver statistics are DERIVED, never stored. Anything stored would be a
     * number nobody could reproduce from the trips table.
     */

    public function completedTripCount(): int
    {
        return $this->trips()->whereNotNull('ended_at')->count();
    }

    public function totalKm(): float
    {
        return round((float) $this->trips()->whereNotNull('ended_at')->sum('distance_km'), 1);
    }

    /** Whole years since the account was created — not self-reported. */
    public function yearsOnRoute(): int
    {
        return (int) $this->created_at?->diffInYears(now());
    }
}
