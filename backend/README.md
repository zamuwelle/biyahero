# Backend

Dear developers,

All controllers extend `App\Http\Controllers\Controller`, which provides two response helpers:

- `success($data = null, $message = null, $status = 200)`
- `error($message = null, $status = 400, $errors = null)`

Both return JSON responses. Use them instead of manually building responses.

## External Libraries

- [Laravel Sanctum](https://laravel.com/docs/sanctum) — API authentication

## Deployment

The included `Dockerfile` and `entrypoint.sh` are production-ready. Just build and run the image.
