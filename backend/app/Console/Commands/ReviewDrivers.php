<?php

namespace App\Console\Commands;

use App\Models\Trip;
use App\Models\User;
use App\Services\LicenceIdentity;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Audit and revoke drivers after the fact.
 *
 * Registration approves automatically once the licence number is well-formed
 * and unexpired, so nobody waits on a queue. This is the counterweight: the
 * licence photo is retained, and a real person can look at it and pull a
 * driver off the road if the number was invented or the photo does not match.
 */
class ReviewDrivers extends Command
{
    protected $signature = 'biyahero:review
        {licence? : Licence number of the driver to inspect, e.g. N01-19-123456}
        {--revoke= : Revoke this driver with the given reason}
        {--reinstate : Undo a revocation}';

    protected $description = 'Inspect drivers and revoke any whose licence does not hold up';

    public function __construct(private readonly LicenceIdentity $identity)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $licence = $this->argument('licence');

        if (! $licence) {
            return $this->listDrivers();
        }

        $driver = User::where('license_lookup', $this->identity->blindIndex($licence))
            ->with('vehicle')
            ->first();

        if (! $driver) {
            $this->error("No driver registered with licence {$licence}.");

            return self::FAILURE;
        }

        return $this->inspect($driver);
    }

    private function listDrivers(): int
    {
        $drivers = User::query()
            ->whereNotNull('license_lookup')
            ->with('vehicle')
            ->orderByDesc('created_at')
            ->get();

        if ($drivers->isEmpty()) {
            $this->info('No registered drivers.');

            return self::SUCCESS;
        }

        $this->table(
            ['Name', 'Vehicle', 'Plate', 'Status', 'Licence expires', 'Photo on file'],
            $drivers->map(fn (User $d) => [
                $d->name,
                $d->vehicle?->vehicle_type ?? '—',
                $d->vehicle?->plate_number ?? '—',
                $d->licenceHasExpired() ? 'EXPIRED' : strtoupper($d->verification_status),
                $d->license_expires_at?->toDateString() ?? '—',
                $d->license_photo_path ? 'yes' : 'NO',
            ])->all()
        );

        $this->newLine();
        $this->line('Inspect one with: php artisan biyahero:review N01-19-123456');
        $this->line('The licence number is not stored, so it must be typed in full.');

        return self::SUCCESS;
    }

    private function inspect(User $driver): int
    {
        if ($reason = $this->option('revoke')) {
            $driver->update([
                'verification_status' => 'rejected',
                'is_verified' => false,
                'approved_at' => null,
                'rejection_reason' => $reason,
            ]);

            // Pull them off the road NOW, not at their next trip: an open run
            // keeps a revoked driver live on commuter maps.
            $ended = Trip::query()
                ->active()
                ->whereHas('vehicle', fn ($q) => $q->where('user_id', $driver->id))
                ->update(['ended_at' => now()]);

            if ($ended > 0) {
                $driver->vehicle?->update(['live_lat' => null, 'live_lng' => null, 'last_ping_at' => null]);
                $this->warn("Ended {$ended} run(s) already in progress.");
            }

            $this->warn("Revoked {$driver->name}. They can no longer start a trip.");

            return self::SUCCESS;
        }

        if ($this->option('reinstate')) {
            $driver->update([
                'verification_status' => 'approved',
                'is_verified' => true,
                'approved_at' => now(),
                'rejection_reason' => null,
            ]);

            $this->info("Reinstated {$driver->name}.");

            return self::SUCCESS;
        }

        $this->info("Driver:  {$driver->name}");
        $this->info("Vehicle: {$driver->vehicle?->vehicle_type} {$driver->vehicle?->plate_number}");
        $this->info("Status:  {$driver->verification_status}".($driver->licenceHasExpired() ? ' (LICENCE EXPIRED)' : ''));
        $this->info('Expires: '.($driver->license_expires_at?->toDateString() ?? 'unknown'));
        $this->info('Photo:   '.($driver->license_photo_path ? Storage::path($driver->license_photo_path) : 'MISSING'));
        $this->newLine();
        $this->line('Open the photo above. If it does not hold up:');
        $this->line('  php artisan biyahero:review '.$this->argument('licence').' --revoke="reason"');

        return self::SUCCESS;
    }
}
