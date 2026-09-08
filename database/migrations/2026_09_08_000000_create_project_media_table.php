<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Store the uploaded video, image, and audio files that belong to a project.
     */
    public function up(): void
    {
        Schema::create('project_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);
            $table->string('original_name');
            $table->string('path');
            $table->string('disk')->default('public');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size');
            $table->timestamps();

            $table->index(['project_id', 'created_at']);
        });
    }

    /**
     * Remove the project media table if this migration is rolled back.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_media');
    }
};
