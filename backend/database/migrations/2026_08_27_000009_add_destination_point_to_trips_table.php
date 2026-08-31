<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The exact point this trip is headed to — the driver's pinned spot or the
 * resolved place. Kept per TRIP (not just per Destination row) so the
 * commuter's destination pin lands exactly where the driver is going, the
 * way a navigation app pins the precise target.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->decimal('dest_lat', 10, 7)->nullable();
            $table->decimal('dest_lng', 10, 7)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn(['dest_lat', 'dest_lng']);
        });
    }
};
