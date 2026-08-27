<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\AiRadarService;

class RadarController extends Controller
{
	public function __construct(protected AiRadarService $aiRadarService) {}

	public function index(Request $request)
	{
		$validated = $request->validate([
			'lat' => 'required|numeric',
			'lng' => 'required|numeric',
			'radius_km' => 'required|numeric',
			'vehicle_type' => 'required|string',
			'route_id' => 'required|integer',
		]);

		$res = $this->aiRadarService->findNearbyVehicles(
			(float) $validated['lat'],
			(float) $validated['lng'],
			(float) $validated['radius_km'],
			$validated['vehicle_type'],
			(int) $validated['route_id'],
		);

		return response()->json($res);
	}
}
