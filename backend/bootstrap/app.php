<?php

use Illuminate\Foundation\Application;

return Application::configure(basePath: dirname(__DIR__))
	->withRouting(
		web: __DIR__ . '/../routes/web.php',
		api: __DIR__ . '/../routes/api.php',
		commands: __DIR__ . '/../routes/console.php',
		health: '/up',
	)
	->withMiddleware(function () {})
	->withExceptions(
		fn($exceptions) =>
		$exceptions->shouldRenderJsonWhen(
			fn($request) => $request->is('api/*') || $request->expectsJson(),
		)
	)->create();
