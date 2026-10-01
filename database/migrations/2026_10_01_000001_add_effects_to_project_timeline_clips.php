<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Save clip effects applied from the editor VFX pool.
     */
    public function up(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->json('effects')->nullable()->after('preview_height');
        });
    }

    /**
     * Remove saved clip effects.
     */
    public function down(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->dropColumn('effects');
        });
    }
};
