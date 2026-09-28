<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Save the editor preview size used for text clip positioning.
     */
    public function up(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->unsignedSmallInteger('preview_width')->nullable()->after('rotation');
            $table->unsignedSmallInteger('preview_height')->nullable()->after('preview_width');
        });
    }

    /**
     * Remove the saved preview size fields.
     */
    public function down(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->dropColumn(['preview_width', 'preview_height']);
        });
    }
};
