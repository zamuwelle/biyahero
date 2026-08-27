<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * The human half of driver verification.
 *
 * Registration only records a submission — this is where a person looks at the
 * licence photo and decides. Nothing in the app auto-approves, because the whole
 * point of asking for a licence is that somebody checked it.
 */
class ReviewDrivers extends Command
{
    protected $signature = 'biyahero:review
        {phone? : Review one driver by phone number}
        {--approve : Approve without prompting (for the named phone)}
        {--reject= : Reject with this reason (for the named phone)}';

    protected $description = 'Review pending driver registrations and approve or reject them';

    public function handle(): int
    {
        $phone = $this->argument('phone');

        if ($phone) {
            $driver = User::where('phone', $phone)->first();

            if (! $driver) {
                $this->error("No driver with phone {$phone}.");

                return self::FAILURE;
            }

            return $this->reviewOne($driver);
        }

        $pending = User::where('verification_status', 'pending')->get();

        if ($pending->isEmpty()) {
            $this->info('No pending registrations.');

            return self::SUCCESS;
        }

        $this->table(
            ['Phone', 'Name', 'Vehicle', 'Plate', 'Licence photo', 'Submitted'],
            $pending->map(fn (User $d) => [
                $d->phone,
                $d->name,
                $d->vehicle?->vehicle_type ?? '—',
                $d->vehicle?->plate_number ?? '—',
                $d->license_photo_path ? Storage::path($d->license_photo_path) : 'MISSING',
                $d->created_at?->diffForHumans(),
            ])->all()
        );

        $this->newLine();
        $this->line('Review one with: php artisan biyahero:review {phone}');

        return self::SUCCESS;
    }

    private function reviewOne(User $driver): int
    {
        if ($this->option('reject')) {
            $driver->update([
                'verification_status' => 'rejected',
                'is_verified' => false,
                'approved_at' => null,
                'rejection_reason' => $this->option('reject'),
            ]);
            $this->warn("Rejected {$driver->name} ({$driver->phone}).");

            return self::SUCCESS;
        }

        if (! $this->option('approve')) {
            $this->info("Driver:  {$driver->name}");
            $this->info("Phone:   {$driver->phone}");
            $this->info("Vehicle: {$driver->vehicle?->vehicle_type} {$driver->vehicle?->plate_number}");
            $this->info('Licence: '.($driver->license_photo_path ? Storage::path($driver->license_photo_path) : 'MISSING'));
            $this->newLine();
            $this->line('Open the licence photo above, then re-run with --approve or --reject="reason".');

            return self::SUCCESS;
        }

        if (! $driver->license_photo_path) {
            $this->error('No licence photo on file — refusing to approve.');

            return self::FAILURE;
        }

        $driver->update([
            'verification_status' => 'approved',
            'is_verified' => true,
            'approved_at' => now(),
            'rejection_reason' => null,
        ]);

        $this->info("Approved {$driver->name} ({$driver->phone}).");

        return self::SUCCESS;
    }
}
