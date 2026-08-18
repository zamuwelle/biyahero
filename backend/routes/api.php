<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('test', fn() => 'wassup');
Route::post('register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
	Route::post('logout', [AuthController::class, 'logout']);
	Route::get('me', fn() => request()->user());
});
