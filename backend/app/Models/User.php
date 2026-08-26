<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
	use HasApiTokens;

	protected $fillable = ['name', 'phone', 'email', 'password', 'license_no', 'is_verified'];
	protected $hidden = ['password'];

	public function vehicle()
	{
		return $this->hasOne(Vehicle::class);
	}
}
