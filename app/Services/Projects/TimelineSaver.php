<?php

namespace App\Services\Projects;

use App\Models\Project;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TimelineSaver
{
    /**
     * Replace the project's timeline clips after ownership and overlap checks pass.
     *
     * @param  array<int, array<string, mixed>>  $validatedClips
     */
    public function save(Project $project, array $validatedClips): void
    {
        $clips = collect($validatedClips);

        if ($clips->contains(fn (array $clip): bool => $clip['type'] !== 'text' && ! isset($clip['mediaId']))) {
            throw ValidationException::withMessages([
                'clips' => __('Timeline media clips must reference an uploaded media file.'),
            ]);
        }

        $requestedMediaIds = $clips
            ->filter(fn (array $clip) => ($clip['type'] ?? null) !== 'text')
            ->pluck('mediaId')
            ->map(fn (int|string $mediaId): int => (int) $mediaId)
            ->unique()
            ->values();

        $projectMediaIds = $project->media()
            ->whereIn('id', $requestedMediaIds)
            ->pluck('id')
            ->map(fn (int|string $mediaId): int => (int) $mediaId);

        if ($requestedMediaIds->diff($projectMediaIds)->isNotEmpty()) {
            throw ValidationException::withMessages([
                'clips' => __('Timeline contains media that does not belong to this project.'),
            ]);
        }

        $timelineTracks = $clips->values();

        foreach ($timelineTracks as $clipIndex => $clip) {
            $clipTrack = match ($clip['type']) {
                'audio' => 'audio',
                'text' => 'text',
                default => 'video',
            };
            $clipStart = (float) $clip['start'];
            $clipEnd = $clipStart + (float) $clip['duration'];

            foreach ($timelineTracks->slice($clipIndex + 1) as $otherClip) {
                $otherClipTrack = match ($otherClip['type']) {
                    'audio' => 'audio',
                    'text' => 'text',
                    default => 'video',
                };
                $otherClipStart = (float) $otherClip['start'];
                $otherClipEnd = $otherClipStart + (float) $otherClip['duration'];

                if (
                    $clipTrack === $otherClipTrack &&
                    (int) ($clip['trackIndex'] ?? 1) === (int) ($otherClip['trackIndex'] ?? 1) &&
                    $clipStart < $otherClipEnd &&
                    $clipEnd > $otherClipStart
                ) {
                    throw ValidationException::withMessages([
                        'clips' => __('Timeline clips cannot overlap on the same track.'),
                    ]);
                }
            }
        }

        DB::transaction(function () use ($project, $clips): void {
            $project->timelineClips()->delete();

            foreach ($clips as $index => $clip) {
                $project->timelineClips()->create([
                    'project_media_id' => $clip['mediaId'] ?? null,
                    'name' => $clip['name'],
                    'type' => $clip['type'],
                    'track_index' => $clip['trackIndex'] ?? 1,
                    'start' => $clip['start'],
                    'duration' => $clip['duration'],
                    'source_start' => $clip['sourceStart'],
                    'scale' => $clip['scale'] ?? 100,
                    'position_x' => $clip['positionX'] ?? 0,
                    'position_y' => $clip['positionY'] ?? 0,
                    'rotation' => $clip['rotation'] ?? 0,
                    'preview_width' => $clip['previewWidth'] ?? null,
                    'preview_height' => $clip['previewHeight'] ?? null,
                    'effects' => $clip['effects'] ?? [],
                    'sort_order' => $index,
                ]);
            }
        });
    }
}
