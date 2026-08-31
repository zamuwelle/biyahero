<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two corrections to the vehicles table.
 *
 * route_id defaulted to 1 — a real Metro Manila corridor — so every driver
 * who had not declared a trip yet was silently attached to it. The route
 * belongs to the TRIP; a vehicle may have none.
 *
 * plate_number is half the login credential and is painted on the vehicle in
 * public, so nothing stopped a second account claiming a real jeepney's
 * plate. The database now refuses duplicates.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->unsignedBigInteger('route_id')->nullable()->default(null)->change();
            $table->unique('plate_number');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropUnique(['plate_number']);
            $table->unsignedBigInteger('route_id')->default(1)->change();
        });
    }
};
