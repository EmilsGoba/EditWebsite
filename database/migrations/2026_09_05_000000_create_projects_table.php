<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the table that stores each user's video editing projects.
     */
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('format', 10)->default('16:9');
            $table->string('status')->default('draft');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    /**
     * Remove the projects table if this migration is rolled back.
     */
    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
