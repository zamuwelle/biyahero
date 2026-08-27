<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Vehicle;
use App\Rules\PhilippineLicence;
use App\Services\LicenceIdentity;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

/**
 * Drivers only. Commuters never authenticate — there is no commuter account,
 * no password and no profile, which is why every commuter route is public.
 *
 * Identity is LICENCE + PLATE. Neither is secret on its own (both are visible
 * on the vehicle and the card), but together they are hard to guess, and it
 * needs no SMS. There is no password and no OTP.
 *
 * Approval is automatic once the licence number is well-formed and unexpired.
 * That is the only automated check that exists: LTO publishes no verification
 * API, so nothing confirms the licence is real or belongs to this person. The
 * photo is retained so a human can revoke a driver after the fact with
 * `php artisan biyahero:review {licence} --reject="reason"`.
 */
class AuthController extends Controller
{
    public function __construct(private readonly LicenceIdentity $identity) {}

    public function register(): JsonResponse
    {
        $validated = request()->validate([
            'name' => 'required|string|max:100',
            'license_no' => ['required', 'string', 'max:30', new PhilippineLicence],
            'license_expires_at' => 'required|date|after:today',
            'license_photo' => 'required|image|max:8192',
            'vehicle_type' => 'required|string|in:jeepney,ejeep,bus,uv_express',
            'plate_number' => 'required|string|max:20',
            'model' => 'nullable|string|max:50',
            'body_number' => 'nullable|string|max:20',
            'phone' => 'nullable|string|max:20',
        ], [
            'license_expires_at.after' => 'Paso na ang lisensya mo.',
        ]);

        $lookup = $this->identity->blindIndex($validated['license_no']);

        if (User::where('license_lookup', $lookup)->exists()) {
            return $this->error('Nakarehistro na ang lisensyang ito. Mag-log in na lang.', 409);
        }

        $user = DB::transaction(function () use ($validated, $lookup) {
            // Private disk: the photo is evidence for a later dispute, never public.
            $path = request()->file('license_photo')->store('licences');

            $user = User::create([
                'name' => $validated['name'],
                'phone' => $validated['phone'] ?? null,
                'license_hash' => Hash::make($this->identity->normalise($validated['license_no'])),
                'license_lookup' => $lookup,
                'license_expires_at' => $validated['license_expires_at'],
                'license_photo_path' => $path,
                // Format and expiry passed, which is everything we can check.
                'is_verified' => true,
                'verification_status' => 'approved',
                'approved_at' => now(),
            ]);

            Vehicle::create([
                'user_id' => $user->id,
                'vehicle_code' => strtoupper(substr($validated['vehicle_type'], 0, 4)).'-'.str_pad((string) $user->id, 3, '0', STR_PAD_LEFT),
                'vehicle_type' => $validated['vehicle_type'],
                'plate_number' => $this->normalisePlate($validated['plate_number']),
                'model' => $validated['model'] ?? null,
                'body_number' => $validated['body_number'] ?? null,
                'route_id' => 1,
            ]);

            return $user;
        });

        return $this->success([
            'user' => $this->profile($user->fresh()),
            'token' => $user->createToken('auth-token')->plainTextToken,
        ], 'Aprubado ka na. Puwede ka nang magbiyahe.', 201);
    }

    public function login(): JsonResponse
    {
        $validated = request()->validate([
            'license_no' => 'required|string|max:30',
            'plate_number' => 'required|string|max:20',
        ]);

        $user = User::where('license_lookup', $this->identity->blindIndex($validated['license_no']))
            ->with('vehicle')
            ->first();

        // One message for both failures: revealing which half was wrong would
        // turn this into an oracle for enumerating licence numbers.
        $plateMatches = $user?->vehicle
            && $user->vehicle->plate_number === $this->normalisePlate($validated['plate_number']);

        if (! $plateMatches) {
            return $this->error('Hindi tugma ang lisensya at plaka.', 404);
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

    /** Plates are painted on the vehicle; spacing varies, the characters do not. */
    private function normalisePlate(string $plate): string
    {
        return strtoupper(preg_replace('/\s+/', ' ', trim($plate)) ?? '');
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
