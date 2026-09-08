<?php

use App\Http\Controllers\ProjectController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [ProjectController::class, 'index'])->name('dashboard');
    Route::get('projects/{project}/edit', [ProjectController::class, 'edit'])->name('projects.edit');
    Route::get('projects/{project}/export', [ProjectController::class, 'export'])->name('projects.export');
    Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::post('projects/{project}/media', [ProjectController::class, 'uploadMedia'])->name('projects.media.store');
    Route::delete('projects/{project}/media', [ProjectController::class, 'destroyMedia'])->name('projects.media.destroy');
    Route::put('projects/{project}', [ProjectController::class, 'update'])->name('projects.update');
    Route::delete('projects/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');
});

require __DIR__.'/settings.php';
