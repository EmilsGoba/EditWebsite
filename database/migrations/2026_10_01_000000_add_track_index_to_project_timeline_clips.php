<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Store which visible timeline lane a clip belongs to.
     */
    public function up(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->unsignedSmallInteger('track_index')->default(1)->after('type');
        });
    }

    /**
     * Remove the extra timeline lane information.
     */
    public function down(): void
    {
        Schema::table('project_timeline_clips', function (Blueprint $table) {
            $table->dropColumn('track_index');
        });
    }
};
