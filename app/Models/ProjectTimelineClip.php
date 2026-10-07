<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $project_id
 * @property int|null $project_media_id
 * @property string $name
 * @property string $type
 * @property int $track_index
 * @property float $start
 * @property float $duration
 * @property float $source_start
 * @property float $scale
 * @property float $position_x
 * @property float $position_y
 * @property float $rotation
 * @property int|null $preview_width
 * @property int|null $preview_height
 * @property array<int, array<string, mixed>|string>|null $effects
 * @property int $sort_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'project_media_id',
    'name',
    'type',
    'track_index',
    'start',
    'duration',
    'source_start',
    'scale',
    'position_x',
    'position_y',
    'rotation',
    'preview_width',
    'preview_height',
    'effects',
    'sort_order',
])]
class ProjectTimelineClip extends Model
{
    protected $casts = [
        'start' => 'float',
        'duration' => 'float',
        'source_start' => 'float',
        'scale' => 'float',
        'position_x' => 'float',
        'position_y' => 'float',
        'rotation' => 'float',
        'effects' => 'array',
    ];

    /**
     * Each saved clip belongs to one editing project.
     *
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Each saved clip points back to the uploaded media file it uses.
     *
     * @return BelongsTo<ProjectMedia, $this>
     */
    public function media(): BelongsTo
    {
        return $this->belongsTo(ProjectMedia::class, 'project_media_id');
    }
}
