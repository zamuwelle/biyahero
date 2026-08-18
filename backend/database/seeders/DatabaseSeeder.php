<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
	public function run()
	{
		User::create([
			'email' => 'test@example.com',
			'password' => 'password',
		]);
	}
}
