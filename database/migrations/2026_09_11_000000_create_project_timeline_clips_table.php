<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Store the saved timeline layout for each project.
     */
    public function up(): void
    {
        Schema::create('project_timeline_clips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_media_id')->constrained('project_media')->cascadeOnDelete();
            $table->string('name');
            $table->string('type', 20);
            $table->decimal('start', 8, 2);
            $table->decimal('duration', 8, 2);
            $table->decimal('source_start', 8, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['project_id', 'sort_order']);
        });
    }

    /**
     * Remove the saved timeline clips table if this migration is rolled back.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_timeline_clips');
    }
};
