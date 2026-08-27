<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'name', 'phone', 'email', 'password', 'license_no', 'license_hash',
        'is_verified', 'verification_status', 'years_on_route', 'total_trips', 'on_time_rate',
    ];

    /** license_* never leaves the server: it proves registration, it is not a display field. */
    protected $hidden = ['password', 'license_no', 'license_hash'];

    protected $casts = [
        'is_verified' => 'boolean',
    ];

    public function vehicle()
    {
        return $this->hasOne(Vehicle::class);
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
}
