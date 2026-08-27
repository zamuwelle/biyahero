<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // The licence number is hashed and never returned to any client —
            // it proves the driver registered, it is not a display field.
            $table->string('license_hash')->nullable()->after('license_no');
            $table->enum('verification_status', ['pending', 'approved', 'rejected'])->default('pending')->after('is_verified');
            $table->unsignedInteger('years_on_route')->default(0);
            $table->unsignedInteger('total_trips')->default(0);
            $table->unsignedTinyInteger('on_time_rate')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['license_hash', 'verification_status', 'years_on_route', 'total_trips', 'on_time_rate']);
        });
    }
};
