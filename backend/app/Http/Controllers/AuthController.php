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
 * Registration does NOT approve the driver. It records the submission and
 * leaves verification_status at `pending`; a human approves with
 * `php artisan biyahero:review` after looking at the licence photo. Until then
 * the driver cannot start a trip and is invisible to commuters.
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
            'license_no' => 'required|string|max:30',
            'license_photo' => 'required|image|max:8192',
        ]);

        if (User::where('phone', $validated['phone'])->exists()) {
            return $this->error('May account na sa numerong ito. Mag-log in na lang.', 409);
        }

        $user = DB::transaction(function () use ($validated) {
            // Private disk: the photo is evidence for a reviewer, never public.
            $path = request()->file('license_photo')->store('licences');

            $user = User::create([
                'name' => $validated['name'],
                'phone' => $validated['phone'],
                // Hashed on the way in and hidden on the way out — the number
                // proves registration, it is never a display field.
                'license_hash' => Hash::make($validated['license_no']),
                'license_photo_path' => $path,
                'is_verified' => false,
                'verification_status' => 'pending',
            ]);

            Vehicle::create([
                'user_id' => $user->id,
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
            'user' => $this->profile($user->fresh()),
            'token' => $user->createToken('auth-token')->plainTextToken,
        ], 'Naipadala ang rehistro. Aabisuhan ka namin kapag aprubado na.', 201);
    }

    public function login(): JsonResponse
    {
        $validated = request()->validate(['phone' => 'required|string|max:20']);

        $user = User::where('phone', $validated['phone'])->first();

        if (! $user) {
            return $this->error('Walang account sa numerong ito.', 404);
        }

        return $this->success([
            'user' => $this->profile($user),
            'token' => $user->createToken('auth-token')->plainTextToken,
        ]);
    }

    public function me(): JsonResponse
    {
        return $this->success($this->profile(request()->user()));
    }

    public function logout(): Response
    {
        request()->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    /**
     * The driver's own view of themselves. Every statistic is derived from the
     * trips table rather than stored, so the numbers can always be reproduced.
     *
     * @return array<string, mixed>
     */
    private function profile(User $user): array
    {
        return [
            ...$user->load('vehicle')->toArray(),
            'stats' => [
                'completed_trips' => $user->completedTripCount(),
                'total_km' => $user->totalKm(),
                'years_on_route' => $user->yearsOnRoute(),
            ],
        ];
    }
}
