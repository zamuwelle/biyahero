<?php

use App\Http\Middleware\LocalOnly;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias(['local-only' => LocalOnly::class]);

        // Credential stuffing is otherwise free: licence + plate is the
        // only check, and a plate is painted on the side of the vehicle.
        $middleware->throttleApi('120,1');
    })
    ->withExceptions(
        fn ($exceptions) => $exceptions->shouldRenderJsonWhen(
            fn ($request) => $request->is('api/*') || $request->expectsJson(),
        )
    )->create();
