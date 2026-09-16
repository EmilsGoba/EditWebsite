<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Store visual transform settings for each clip on the editor timeline.
     */
    public function up(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->decimal('scale', 6, 2)->default(100)->after('source_start');
            $table->decimal('position_x', 8, 2)->default(0)->after('scale');
            $table->decimal('position_y', 8, 2)->default(0)->after('position_x');
            $table->decimal('rotation', 6, 2)->default(0)->after('position_y');
        });
    }

    /**
     * Remove per-clip visual transform settings.
     */
    public function down(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->dropColumn([
                'scale',
                'position_x',
                'position_y',
                'rotation',
            ]);
        });
    }
};
