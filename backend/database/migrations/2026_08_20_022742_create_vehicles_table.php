<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
						$table->string('vehicle_code');
						$table->string('vehicle_type');
						$table->foreignId('route_id')->constrained()->onDelete('cascade');
						$table->integer('current_waypoint_index')->default(0);
						$table->enum('direction', ['forward', 'backward'])->default('forward');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
