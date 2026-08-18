<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up()
	{
		Schema::create('cache', function ($table) {
			$table->string('key')->primary();
			$table->mediumText('value');
			$table->bigInteger('expiration')->index();
		});

		Schema::create('cache_locks', function ($table) {
			$table->string('key')->primary();
			$table->string('owner');
			$table->bigInteger('expiration')->index();
		});
	}

	public function down()
	{
		Schema::dropIfExists('cache');
		Schema::dropIfExists('cache_locks');
	}
};
