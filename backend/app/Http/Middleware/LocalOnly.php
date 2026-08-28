<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Refuses anywhere but a local environment.
 *
 * Guards the debug routes: one drops every table, the other dumps every
 * plate and live coordinate. Convenient on a laptop, catastrophic on a
 * deployed instance where anyone can find them.
 */
class LocalOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(app()->environment('local', 'testing'), 404);

        return $next($request);
    }
}
