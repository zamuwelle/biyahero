<?php

use Illuminate\Support\Facades\Route;

Route::get('favicon.ico', fn() => response()->noContent());
Route::get('test', fn() => response('wassup', 200));
