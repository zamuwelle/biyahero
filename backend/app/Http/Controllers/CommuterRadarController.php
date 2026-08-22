<?php

namespace App\Http\Controllers;

use App\Services\AiRadarService;
use Illuminate\Http\Request;

class CommuterRadarController extends Controller
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
            'hour_of_day' => 'required|integer|min:0|max:23',
            'day_of_week' => 'required|string',
        ]);

        $result = $this->aiRadarService->findNearbyVehiclesWithEta(
            $validated['lat'],
            $validated['lng'],
            $validated['radius_km'],
            $validated['vehicle_type'],
            $validated['route_id'],
            $validated['hour_of_day'],
            $validated['day_of_week'],
        );

        return response()->json($result);
    }
}