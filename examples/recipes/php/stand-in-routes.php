<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

// The PHP examples are Pest feature tests that call the Laravel app itself, so this app hands
// every route to the stand-in app, which does the app's part of the recipe.
Route::any('{appPath}', function (Request $request, string $appPath) {
    $standInResponse = Http::send($request->method(), 'http://localhost:3000/'.$appPath, [
        'json' => $request->all(),
    ]);

    return response($standInResponse->body(), $standInResponse->status())
        ->header('Content-Type', $standInResponse->header('Content-Type'));
})->where('appPath', '.*');
