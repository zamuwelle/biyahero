<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
	public function register()
	{
		$user = User::create(request()->validate([
			'email' => 'required|email|max:254|unique:users',
			'password' => 'required|string|min:8'
		]));

		return $this->success([
			'user' => $user,
			'token' => $user->createToken('auth-token')->plainTextToken
		]);
	}

	public function login()
	{
		request()->validate([
			'email' => 'required|email',
			'password' => 'required|string'
		]);

		$user = User::where('email', request('email'))->first();

		if (!$user || !Hash::check(request('password'), $user->password)) {
			return $this->error('Incorrect email or password.', 401);
		}

		return $this->success([
			'user' => $user,
			'token' => $user->createToken('auth-token')->plainTextToken
		]);
	}

	public function logout()
	{
		request()->user()->currentAccessToken()->delete();

		return response()->noContent();
	}
}
