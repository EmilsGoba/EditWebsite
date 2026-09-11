<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $project_id
 * @property string $type
 * @property string $original_name
 * @property string $path
 * @property string $disk
 * @property string|null $mime_type
 * @property int $size
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['type', 'original_name', 'path', 'disk', 'mime_type', 'size'])]
class ProjectMedia extends Model
{
    /**
     * Each uploaded media file belongs to one editing project.
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * One uploaded media file can be used by multiple saved timeline clips.
     */
    public function timelineClips(): HasMany
    {
        return $this->hasMany(ProjectTimelineClip::class);
    }
}
