<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

/**
 * Drivers only. Commuters never authenticate — there is no commuter account,
 * no password and no profile, which is why every commuter route is public.
 *
 * NOTE: registration and login are keyed on a phone number that is never
 * verified. The Figma sign-up screen promises a 6-digit SMS code but no OTP
 * screen was designed, so this ships as the designed flow. Before any real
 * deployment this needs an OTP step — knowing a phone number is currently
 * enough to assume that driver's identity.
 */
class AuthController extends Controller
{
    public function register(): JsonResponse
    {
        $validated = request()->validate([
            'name' => 'required|string|max:100',
            'phone' => 'required|string|max:20',
            'vehicle_type' => 'required|string|in:jeepney,ejeep,bus,uv_express',
            'plate_number' => 'required|string|max:20',
            'model' => 'nullable|string|max:50',
            'body_number' => 'nullable|string|max:20',
            'license_no' => 'nullable|string|max:30',
        ]);

        $user = DB::transaction(function () use ($validated) {
            $user = User::firstOrCreate(['phone' => $validated['phone']], [
                'name' => $validated['name'],
                // Hashed on the way in and hidden on the way out — the licence
                // number proves registration, it is never a display field.
                'license_hash' => isset($validated['license_no']) ? Hash::make($validated['license_no']) : null,
                'is_verified' => true,
                'verification_status' => 'approved',
                'years_on_route' => 0,
            ]);

            Vehicle::updateOrCreate(['user_id' => $user->id], [
                'vehicle_code' => strtoupper(substr($validated['vehicle_type'], 0, 4)).'-'.str_pad((string) $user->id, 3, '0', STR_PAD_LEFT),
                'vehicle_type' => $validated['vehicle_type'],
                'plate_number' => strtoupper($validated['plate_number']),
                'model' => $validated['model'] ?? null,
                'body_number' => $validated['body_number'] ?? null,
                'route_id' => 1,
            ]);

            return $user;
        });

        return $this->success([
            'user' => $user->load('vehicle'),
            'token' => $user->createToken('auth-token')->plainTextToken,
        ], 'Naipadala ang rehistro.');
    }

    public function login(): JsonResponse
    {
        $validated = request()->validate(['phone' => 'required|string|max:20']);

        $user = User::where('phone', $validated['phone'])->first();

        if (! $user) {
            return $this->error('Walang account sa numerong ito.', 404);
        }

        return $this->success([
            'user' => $user->load('vehicle'),
            'token' => $user->createToken('auth-token')->plainTextToken,
        ]);
    }

    public function me(): JsonResponse
    {
        return $this->success(request()->user()->load('vehicle'));
    }

    public function logout(): Response
    {
        request()->user()->currentAccessToken()->delete();

        return response()->noContent();
    }
}
