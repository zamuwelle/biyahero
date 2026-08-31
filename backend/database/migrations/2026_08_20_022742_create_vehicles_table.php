<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up()
	{
		Schema::create('vehicles', function (Blueprint $table) {
			$table->id();
			$table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
			$table->string('vehicle_code');
			$table->string('vehicle_type');
			$table->string('plate_number')->nullable();
			$table->string('model')->nullable();
			$table->enum('occupancy', ['available', 'moderate', 'full'])->default('available');
			$table->foreignId('route_id')->default(1)->constrained()->onDelete('cascade');
			$table->integer('current_waypoint_index')->default(0);
			$table->enum('direction', ['forward', 'backward'])->default('forward');
			$table->decimal('live_lat', 10, 7)->nullable();
			$table->decimal('live_lng', 10, 7)->nullable();
			$table->timestamps();
		});
	}

	public function down()
	{
		Schema::dropIfExists('vehicles');
	}
};
