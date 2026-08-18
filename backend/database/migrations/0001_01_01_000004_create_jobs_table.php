<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up()
	{
		Schema::create('jobs', function ($table) {
			$table->id();
			$table->string('queue')->index();
			$table->longText('payload');
			$table->unsignedSmallInteger('attempts');
			$table->unsignedInteger('reserved_at')->nullable();
			$table->unsignedInteger('available_at');
			$table->unsignedInteger('created_at');
		});

		Schema::create('job_batches', function ($table) {
			$table->string('id')->primary();
			$table->string('name');
			$table->integer('total_jobs');
			$table->integer('pending_jobs');
			$table->integer('failed_jobs');
			$table->longText('failed_job_ids');
			$table->mediumText('options')->nullable();
			$table->integer('cancelled_at')->nullable();
			$table->integer('created_at');
			$table->integer('finished_at')->nullable();
		});

		Schema::create('failed_jobs', function ($table) {
			$table->id();
			$table->string('uuid')->unique();
			$table->string('connection');
			$table->string('queue');
			$table->longText('payload');
			$table->longText('exception');
			$table->timestamp('failed_at')->useCurrent();

			$table->index(['connection', 'queue', 'failed_at']);
		});
	}

	public function down()
	{
		Schema::dropIfExists('jobs');
		Schema::dropIfExists('job_batches');
		Schema::dropIfExists('failed_jobs');
	}
};
