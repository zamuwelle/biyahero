<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['email', 'password'])]
#[Hidden(['password'])]
class User extends Authenticatable
{
	use HasApiTokens;

	protected function casts()
	{
		return [
			'password' => 'hashed',
		];
	}
}
