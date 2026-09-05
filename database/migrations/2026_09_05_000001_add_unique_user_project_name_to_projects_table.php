<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add a database safety rule for duplicate project names per user.
     */
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->unique(['user_id', 'name']);
        });
    }

    /**
     * Remove the duplicate-name safety rule if this migration is rolled back.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'name']);
        });
    }
};
