<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Vehicle;

class AuthController extends Controller
{
	public function register()
	{
		$validated = request()->validate([
			'name' => 'required|string|max:100',
			'phone' => 'required|string|max:20',
			'vehicle_type' => 'required|string',
			'plate_number' => 'required|string|max:20',
			'model' => 'nullable|string|max:50',
			'license_no' => 'nullable|string|max:30',
			'is_verified' => 'boolean'
		]);

		$user = User::firstOrCreate(['phone' => $validated['phone']], [
			'name' => $validated['name'],
			'license_no' => $validated['license_no'] ?? null,
			'is_verified' => $validated['is_verified'] ?? true,
		]);

		$vehicle = Vehicle::firstOrCreate(['user_id' => $user->id], [
			'vehicle_code' => strtoupper(substr($validated['vehicle_type'], 0, 4)) . '-' . rand(100, 999),
			'vehicle_type' => strtolower($validated['vehicle_type']),
			'plate_number' => $validated['plate_number'],
			'model' => $validated['model'] ?? null,
			'route_id' => 1,
			'occupancy' => 'available'
		]);

		return $this->success([
			'user' => $user->load('vehicle'),
			'token' => $user->createToken('auth-token')->plainTextToken
		]);
	}

	public function login()
	{
		$validated = request()->validate([
			'phone' => 'required|string',
		]);

		$user = User::where('phone', $validated['phone'])->first();

		if (!$user) {
			return $this->error('User not found', 404);
		}

		return $this->success([
			'user' => $user->load('vehicle'),
			'token' => $user->createToken('auth-token')->plainTextToken
		]);
	}

	public function me()
	{
		return $this->success(request()->user()->load('vehicle'));
	}

	public function logout()
	{
		request()->user()->currentAccessToken()->delete();
		return response()->noContent();
	}
}
