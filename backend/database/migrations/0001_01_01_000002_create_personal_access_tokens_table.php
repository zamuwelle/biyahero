<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up()
	{
		Schema::create('personal_access_tokens', function ($table) {
			$table->id();
			$table->morphs('tokenable');
			$table->text('name');
			$table->string('token', 64)->unique();
			$table->text('abilities')->nullable();
			$table->timestamp('last_used_at')->nullable();
			$table->timestamp('expires_at')->nullable()->index();
			$table->timestamps();
		});
	}

	public function down()
	{
		Schema::dropIfExists('personal_access_tokens');
	}
};
