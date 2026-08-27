<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            // Freshness is what the commuter sees INSTEAD of an ETA, so it has to
            // be a real timestamp rather than inferred from `updated_at`.
            $table->timestamp('last_ping_at')->nullable()->after('live_lng');
            $table->string('current_street')->nullable()->after('last_ping_at');
            $table->string('body_number')->nullable()->after('model');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['last_ping_at', 'current_street', 'body_number']);
        });
    }
};
