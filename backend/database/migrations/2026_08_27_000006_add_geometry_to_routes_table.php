<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            // The hand-placed anchors. `waypoints` holds the dense polyline OSRM
            // snaps them to, so the drawn line follows the actual road.
            $table->json('control_points')->nullable()->after('waypoints');
            $table->unsignedSmallInteger('duration_min')->default(0)->after('length_km');
            $table->boolean('road_matched')->default(false)->after('duration_min');
        });
    }

    public function down(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropColumn(['control_points', 'duration_min', 'road_matched']);
        });
    }
};
