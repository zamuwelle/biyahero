<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\AiRadarService;

class EtaController extends Controller
{
	public function __construct(protected AiRadarService $aiRadarService) {}

	public function index(Request $request)
	{
		$validated = $request->validate([
				'route_id' => 'required|integer',
				'vehicle_type' => 'required|string',
				'hour_of_day' => 'required|integer|min:0|max:23',
				'day_of_week' => 'required|string',
				'distance_km' => 'required|numeric',
		]);

		$result = $this->aiRadarService->predictEta(
				$validated['route_id'],
				$validated['vehicle_type'],
				$validated['hour_of_day'],
				$validated['day_of_week'],
				$validated['distance_km'],
		);

		return response()->json($result);
	}
}
