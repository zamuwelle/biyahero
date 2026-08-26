<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up()
	{
		Schema::create('users', function ($table) {
			$table->id();
			$table->string('email')->unique();
			$table->string('password');
			$table->timestamps();
		});
	}

	public function down()
	{
		Schema::dropIfExists('users');
	}
};
