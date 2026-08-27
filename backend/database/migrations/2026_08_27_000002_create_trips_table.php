<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A trip is one driver's declared run. The ROUTE BELONGS TO THE TRIP, not to the
 * vehicle or the driver profile: PH drivers change route freely, so a route
 * pinned to a profile would go stale the moment the driver turns around.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('route_id')->constrained()->cascadeOnDelete();
            $table->string('destination');
            $table->enum('capacity', ['open', 'filling', 'full', 'unknown'])->default('unknown');
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('ended_at')->nullable();
            $table->decimal('distance_km', 6, 2)->default(0);
            $table->timestamps();

            // The commuter query is always "active trips", so index the open ones.
            $table->index(['ended_at', 'vehicle_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
