<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up()
	{
		Schema::create('users', function ($table) {
			$table->id();
			$table->string('name')->nullable();
			$table->string('phone')->nullable()->unique();
			$table->string('email')->nullable()->unique();
			$table->string('license_no')->nullable();
			$table->boolean('is_verified')->default(false);
			$table->string('password')->nullable();
			$table->timestamps();
		});
	}

	public function down()
	{
		Schema::dropIfExists('users');
	}
};
