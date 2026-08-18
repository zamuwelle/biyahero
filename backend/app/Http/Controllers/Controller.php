<?php

namespace App\Http\Controllers;

abstract class Controller
{
	protected function success($data = null, $message = null, $status = 200)
	{
		return response()->json([
			'message' => $message,
			'data' => $data
		], $status);
	}

	protected function error($message = null, $status = 400, $errors = null)
	{
		return response()->json([
			'message' => $message,
			'errors' => $errors
		], $status);
	}
}
