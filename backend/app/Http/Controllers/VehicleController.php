<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The driver's own vehicle. Editing it is routine — a repaint, a corrected
 * plate typo, a new body number — but note the PLATE IS HALF THE LOGIN
 * CREDENTIAL, so changing it changes what the driver types to log in. The
 * client says so on the edit screen.
 */
class VehicleController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $vehicle = $request->user()->vehicle;
        if (! $vehicle) {
            return $this->error('No vehicle registered for this driver.', 404);
        }

        $validated = $request->validate([
            'vehicle_type' => 'required|string|in:jeepney,ejeep,bus,uv_express',
            'plate_number' => 'required|string|max:20',
            'model' => 'nullable|string|max:50',
            'body_number' => 'nullable|string|max:20',
        ]);

        $vehicle->update([
            'vehicle_type' => $validated['vehicle_type'],
            'plate_number' => Vehicle::normalisePlate($validated['plate_number']),
            'model' => $validated['model'] ?? null,
            'body_number' => $validated['body_number'] ?? null,
        ]);

        return $this->success($vehicle->fresh(), 'Na-save ang pagbabago.');
    }
}
