<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $project_id
 * @property int $project_media_id
 * @property string $name
 * @property string $type
 * @property string $start
 * @property string $duration
 * @property string $source_start
 * @property int $sort_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['project_media_id', 'name', 'type', 'start', 'duration', 'source_start', 'sort_order'])]
class ProjectTimelineClip extends Model
{
    /**
     * Each saved clip belongs to one editing project.
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Each saved clip points back to the uploaded media file it uses.
     */
    public function media(): BelongsTo
    {
        return $this->belongsTo(ProjectMedia::class, 'project_media_id');
    }
}
