<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Text timeline clips are editor-created, so they do not point to an uploaded media file.
     */
    public function up(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->dropForeign(['project_media_id']);
            $table->foreignId('project_media_id')
                ->nullable()
                ->change();
            $table->foreign('project_media_id')
                ->references('id')
                ->on('project_media')
                ->cascadeOnDelete();
        });
    }

    /**
     * Restore the original media requirement for timeline clips.
     */
    public function down(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->dropForeign(['project_media_id']);
            $table->foreignId('project_media_id')
                ->nullable(false)
                ->change();
            $table->foreign('project_media_id')
                ->references('id')
                ->on('project_media')
                ->cascadeOnDelete();
        });
    }
};
