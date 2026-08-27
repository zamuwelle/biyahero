<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Stored privately (never on a public disk) and shown only to a
            // reviewer. Registration no longer self-approves.
            $table->string('license_photo_path')->nullable()->after('license_hash');
            $table->timestamp('approved_at')->nullable()->after('verification_status');
            $table->string('rejection_reason')->nullable()->after('approved_at');

            // Both were invented at seed time and could never be computed from
            // real data. Trip counts and distance are derived from `trips`, and
            // time-on-route is derived from the account's own age.
            $table->dropColumn(['total_trips', 'on_time_rate', 'years_on_route']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['license_photo_path', 'approved_at', 'rejection_reason']);
            $table->unsignedInteger('total_trips')->default(0);
            $table->unsignedTinyInteger('on_time_rate')->default(0);
            $table->unsignedInteger('years_on_route')->default(0);
        });
    }
};
