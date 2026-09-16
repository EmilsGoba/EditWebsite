<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Store clip timing with enough precision for 60 FPS frame snapping.
     */
    public function up(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->decimal('start', 10, 6)->change();
            $table->decimal('duration', 10, 6)->change();
            $table->decimal('source_start', 10, 6)->default(0)->change();
        });
    }

    /**
     * Restore the previous timing precision.
     */
    public function down(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->decimal('start', 8, 2)->change();
            $table->decimal('duration', 8, 2)->change();
            $table->decimal('source_start', 8, 2)->default(0)->change();
        });
    }
};
