<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectTimelineClip;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\Process\Process;

class ProjectController extends Controller
{
    /**
     * Show the logged-in user's projects on the dashboard.
     */
    public function index(Request $request): Response
    {
        $projects = $request->user()
            ->projects()
            ->latest()
            ->get(['id', 'name', 'format', 'status', 'created_at']);

        return Inertia::render('dashboard', [
            'projects' => $projects,
        ]);
    }

    /**
     * Show the temporary editing workspace for one project.
     */
    public function edit(Request $request, Project $project): Response
    {
        $project = $request->user()
            ->projects()
            ->findOrFail($project->id);

        return Inertia::render('projects/editor', [
            'project' => $project->only([
                'id',
                'name',
                'format',
                'status',
                'created_at',
            ]),
            'media' => $project->media()
                ->latest()
                ->get()
                ->map(fn ($media) => [
                    'id' => $media->id,
                    'type' => $media->type,
                    'name' => $media->original_name,
                    'mime_type' => $media->mime_type,
                    'size' => $media->size,
                    'url' => Storage::disk($media->disk)->url($media->path),
                    'created_at' => $media->created_at,
                ]),
            'timelineClips' => $project->timelineClips()
                ->with('media')
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($clip) => [
                    'id' => $clip->id,
                    'mediaId' => $clip->project_media_id,
                    'name' => $clip->name,
                    'type' => $clip->type,
                    'start' => (float) $clip->start,
                    'duration' => (float) $clip->duration,
                    'sourceStart' => (float) $clip->source_start,
                    'scale' => (float) $clip->scale,
                    'positionX' => (float) $clip->position_x,
                    'positionY' => (float) $clip->position_y,
                    'rotation' => (float) $clip->rotation,
                    'previewWidth' => $clip->preview_width,
                    'previewHeight' => $clip->preview_height,
                    'url' => $clip->media
                        ? Storage::disk($clip->media->disk)->url($clip->media->path)
                        : null,
                ]),
        ]);
    }

    /**
     * Show the temporary export page for one project.
     */
    public function export(Request $request, Project $project): Response
    {
        $project = $request->user()
            ->projects()
            ->findOrFail($project->id);

        return Inertia::render('projects/export', [
            'project' => $project->only([
                'id',
                'name',
                'format',
                'status',
                'created_at',
            ]),
            'media' => $project->media()
                ->latest()
                ->get()
                ->map(fn ($media) => [
                    'id' => $media->id,
                    'type' => $media->type,
                    'name' => $media->original_name,
                    'mime_type' => $media->mime_type,
                    'size' => $media->size,
                    'url' => Storage::disk($media->disk)->url($media->path),
                    'created_at' => $media->created_at,
                ]),
            'timelineClips' => $project->timelineClips()
                ->with('media')
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($clip) => [
                    'id' => $clip->id,
                    'mediaId' => $clip->project_media_id,
                    'name' => $clip->name,
                    'type' => $clip->type,
                    'start' => (float) $clip->start,
                    'duration' => (float) $clip->duration,
                    'sourceStart' => (float) $clip->source_start,
                    'scale' => (float) $clip->scale,
                    'positionX' => (float) $clip->position_x,
                    'positionY' => (float) $clip->position_y,
                    'rotation' => (float) $clip->rotation,
                    'previewWidth' => $clip->preview_width,
                    'previewHeight' => $clip->preview_height,
                    'url' => $clip->media
                        ? Storage::disk($clip->media->disk)->url($clip->media->path)
                        : null,
                ]),
        ]);
    }

    /**
     * Render the saved visual timeline into a downloadable video file.
     */
    public function renderExport(Request $request, Project $project): RedirectResponse|BinaryFileResponse
    {
        @set_time_limit(300);
        ini_set('max_execution_time', '300');

        $project = $request->user()->projects()->findOrFail($project->id);

        $validated = $request->validate([
            'file_type' => ['required', Rule::in(['mp4', 'mov'])],
            'quality' => ['required', Rule::in(['720p', '1080p', 'Original'])],
        ]);
        $clips = $project->timelineClips()
            ->with('media')
            ->orderBy('sort_order')
            ->get();
        $visualClips = $clips
            ->filter(fn ($clip) => in_array($clip->type, ['video', 'image'], true))
            ->values();
        $audioClips = $clips
            ->filter(fn ($clip) => $clip->type === 'audio')
            ->values();
        $textClips = $clips
            ->filter(fn ($clip) => $clip->type === 'text' && trim((string) $clip->name) !== '')
            ->values();

        if ($visualClips->isEmpty()) {
            return back()->withErrors([
                'export' => __('Add at least one video or image fragment before exporting.'),
            ]);
        }

        $ffmpegPath = $this->ffmpegPath();

        if ($ffmpegPath === '') {
            return back()->withErrors([
                'export' => __('FFmpeg is not installed. Install it on your Mac with: brew install ffmpeg'),
            ]);
        }

        $renderSize = $this->exportRenderSize($project->format, $validated['quality']);
        $temporaryDirectory = storage_path('app/exports');

        if (! is_dir($temporaryDirectory)) {
            mkdir($temporaryDirectory, 0755, true);
        }

        $extension = $validated['file_type'];
        $outputPath = $temporaryDirectory.'/project-'.$project->id.'-'.now()->format('YmdHis').'.'.$extension;
        $command = [$ffmpegPath, '-y'];
        $filters = [];
        $concatInputs = [];
        $audioInputs = [];
        $textOverlayPaths = [];
        $timelineEnd = (float) $clips->max(fn ($clip) => $clip->start + $clip->duration);

        foreach ($visualClips as $index => $clip) {
            $mediaPath = Storage::disk($clip->media->disk)->path($clip->media->path);

            if ($clip->type === 'image') {
                array_push(
                    $command,
                    '-loop',
                    '1',
                    '-t',
                    (string) $clip->duration,
                    '-i',
                    $mediaPath,
                );
            } else {
                $command[] = '-i';
                $command[] = $mediaPath;
            }

            $clipExportScale = $this->previewExportScale($project->format, $renderSize, $clip);
            $scaledWidth = (int) round($renderSize['width'] * ((float) $clip->scale / 100));
            $scaledHeight = (int) round($renderSize['height'] * ((float) $clip->scale / 100));
            $positionX = (int) round((float) $clip->position_x * $clipExportScale);
            $positionY = (int) round((float) $clip->position_y * $clipExportScale);

            if ($clip->type === 'image') {
                $filters[] = sprintf(
                    '[%d:v]scale=%d:%d:force_original_aspect_ratio=decrease,fps=60,setsar=1,format=rgba[clip%dscaled]',
                    $index,
                    $this->evenDimension($scaledWidth),
                    $this->evenDimension($scaledHeight),
                    $index,
                );
            } else {
                $filters[] = sprintf(
                    '[%d:v]trim=start=%F:duration=%F,setpts=PTS-STARTPTS,scale=%d:%d:force_original_aspect_ratio=decrease,fps=60,setsar=1,format=rgba[clip%dscaled]',
                    $index,
                    (float) $clip->source_start,
                    (float) $clip->duration,
                    $this->evenDimension($scaledWidth),
                    $this->evenDimension($scaledHeight),
                    $index,
                );
            }

            $filters[] = sprintf(
                'color=c=black:s=%dx%d:d=%F:r=60[clip%dcanvas]',
                $renderSize['width'],
                $renderSize['height'],
                (float) $clip->duration,
                $index,
            );
            $filters[] = sprintf(
                '[clip%dcanvas][clip%dscaled]overlay=x=\'(W-w)/2%+d\':y=\'(H-h)/2%+d\':shortest=1,format=yuv420p[v%d]',
                $index,
                $index,
                $positionX,
                $positionY,
                $index,
            );
            $concatInputs[] = '[v'.$index.']';
        }

        foreach ($audioClips as $index => $clip) {
            $inputIndex = $visualClips->count() + $index;
            $mediaPath = Storage::disk($clip->media->disk)->path($clip->media->path);
            $audioLabel = 'a'.$index;
            $delayMilliseconds = (int) round($clip->start * 1000);

            array_push(
                $command,
                '-ss',
                (string) $clip->source_start,
                '-t',
                (string) $clip->duration,
                '-i',
                $mediaPath,
            );

            // Each timeline audio clip is trimmed from its source, delayed to its timeline position, then mixed into one export track.
            $filters[] = sprintf(
                '[%d:a]asetpts=PTS-STARTPTS,adelay=%d:all=1[%s]',
                $inputIndex,
                $delayMilliseconds,
                $audioLabel,
            );
            $audioInputs[] = '['.$audioLabel.']';
        }

        foreach ($textClips as $index => $clip) {
            $textExportScale = $this->previewExportScale($project->format, $renderSize, $clip);
            $fontSize = (int) round(18 * $textExportScale * ((float) $clip->scale / 100));
            $textOverlayPath = $this->createTextOverlayImage(
                (string) $clip->name,
                max(12, min(180, $fontSize)),
                $temporaryDirectory,
                $index,
            );

            $textOverlayPaths[] = $textOverlayPath;

            array_push(
                $command,
                '-loop',
                '1',
                '-t',
                (string) $timelineEnd,
                '-i',
                $textOverlayPath,
            );
        }

        $filters[] = implode('', $concatInputs).'concat=n='.$visualClips->count().':v=1:a=0[basev]';

        $videoOutputLabel = 'basev';

        foreach ($textClips as $index => $clip) {
            $nextVideoOutputLabel = 'textv'.$index;
            $textInputIndex = $visualClips->count() + $audioClips->count() + $index;
            $textOverlayLabel = 'textoverlay'.$index;
            $textExportScale = $this->previewExportScale($project->format, $renderSize, $clip);
            $positionX = (int) round((float) $clip->position_x * $textExportScale);
            $positionY = (int) round((float) $clip->position_y * $textExportScale);

            // Text clips are first rendered as transparent PNGs, then overlaid so the export works even without FFmpeg drawtext support.
            $filters[] = sprintf('[%d:v]format=rgba[%s]', $textInputIndex, $textOverlayLabel);
            $filters[] = sprintf(
                '[%s][%s]overlay=x=\'max(0\,min(W-w\,(W-w)/2%+d))\':y=\'max(0\,min(H-h\,(H-h)/2%+d))\':enable=\'between(t,%F,%F)\'[%s]',
                $videoOutputLabel,
                $textOverlayLabel,
                $positionX,
                $positionY,
                (float) $clip->start,
                (float) ($clip->start + $clip->duration),
                $nextVideoOutputLabel,
            );

            $videoOutputLabel = $nextVideoOutputLabel;
        }

        if ($videoOutputLabel !== 'outv') {
            $filters[] = sprintf('[%s]null[outv]', $videoOutputLabel);
        }

        if ($audioClips->isNotEmpty()) {
            $filters[] = sprintf(
                '%samix=inputs=%d:duration=longest:dropout_transition=0,atrim=0:%F,asetpts=PTS-STARTPTS[outa]',
                implode('', $audioInputs),
                $audioClips->count(),
                $timelineEnd,
            );
        }

        array_push(
            $command,
            '-filter_complex',
            implode(';', $filters),
            '-map',
            '[outv]',
        );

        if ($audioClips->isNotEmpty()) {
            array_push(
                $command,
                '-map',
                '[outa]',
                '-c:a',
                'aac',
                '-b:a',
                '192k',
            );
        } else {
            $command[] = '-an';
        }

        array_push(
            $command,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '23',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            $outputPath,
        );

        $process = new Process($command);
        $process->setTimeout(300);
        $process->run();

        foreach ($textOverlayPaths as $textOverlayPath) {
            @unlink($textOverlayPath);
        }

        if (! $process->isSuccessful() || ! file_exists($outputPath)) {
            report(new \RuntimeException($process->getErrorOutput()));

            return back()->withErrors([
                'export' => __('Video export failed. Check that uploaded files are valid video or image files.'),
            ]);
        }

        return response()
            ->download($outputPath, str($project->name)->slug()->append('.'.$extension)->toString())
            ->deleteFileAfterSend();
    }

    /**
     * Save a new project to the database.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('projects', 'name')
                    ->where('user_id', $request->user()->id),
            ],
            'format' => ['required', Rule::in(['16:9', '9:16', '1:1'])],
        ]);

        $request->user()->projects()->create([
            'name' => $validated['name'],
            'format' => $validated['format'],
            'status' => 'draft',
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Project created.'),
        ]);

        return to_route('dashboard');
    }

    /**
     * Update a project's basic settings.
     */
    public function update(Request $request, Project $project): RedirectResponse
    {
        $project = $request->user()->projects()->findOrFail($project->id);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('projects', 'name')
                    ->where('user_id', $request->user()->id)
                    ->ignore($project->id),
            ],
            'format' => ['required', Rule::in(['16:9', '9:16', '1:1'])],
        ]);

        $project->update($validated);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Project updated.'),
        ]);

        return to_route('dashboard');
    }

    /**
     * Upload one media file into a project.
     */
    public function uploadMedia(Request $request, Project $project): RedirectResponse
    {
        $project = $request->user()->projects()->findOrFail($project->id);

        $validated = $request->validate([
            'type' => ['required', Rule::in(['video', 'image', 'audio'])],
            'file' => ['required', 'file'],
        ]);

        $limits = [
            'video' => 512000,
            'image' => 10240,
            'audio' => 51200,
        ];
        $mimeTypes = [
            'video' => ['video/mp4', 'video/quicktime'],
            'image' => ['image/jpeg', 'image/png'],
            'audio' => ['audio/mpeg'],
        ];

        $request->validate([
            'file' => [
                'max:'.$limits[$validated['type']],
                'mimetypes:'.implode(',', $mimeTypes[$validated['type']]),
            ],
        ]);

        $file = $request->file('file');
        $path = $file->store("projects/{$project->id}/media", 'public');

        $project->media()->create([
            'type' => $validated['type'],
            'original_name' => $file->getClientOriginalName(),
            'path' => $path,
            'disk' => 'public',
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Media uploaded.'),
        ]);

        return to_route('projects.edit', $project);
    }

    /**
     * Delete selected media files from a project.
     */
    public function destroyMedia(Request $request, Project $project): RedirectResponse
    {
        $project = $request->user()->projects()->findOrFail($project->id);

        $validated = $request->validate([
            'media_ids' => ['required', 'array', 'min:1'],
            'media_ids.*' => ['integer'],
        ]);

        $mediaItems = $project->media()
            ->whereIn('id', $validated['media_ids'])
            ->get();

        foreach ($mediaItems as $media) {
            Storage::disk($media->disk)->delete($media->path);
            $media->delete();
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Media deleted.'),
        ]);

        return to_route('projects.edit', $project);
    }

    /**
     * Save the current editor timeline for a project.
     */
    public function saveTimeline(Request $request, Project $project): RedirectResponse
    {
        $project = $request->user()->projects()->findOrFail($project->id);

        $validated = $request->validate([
            'autoSave' => ['sometimes', 'boolean'],
            'clips' => ['array'],
            'clips.*.mediaId' => ['nullable', 'integer'],
            'clips.*.name' => ['required', 'string', 'max:255'],
            'clips.*.type' => ['required', Rule::in(['video', 'image', 'audio', 'text'])],
            'clips.*.start' => ['required', 'numeric', 'min:0', 'max:3600'],
            'clips.*.duration' => ['required', 'numeric', 'min:0.01', 'max:3600'],
            'clips.*.sourceStart' => ['required', 'numeric', 'min:0', 'max:3600'],
            'clips.*.scale' => ['sometimes', 'numeric', 'min:40', 'max:1000'],
            'clips.*.positionX' => ['sometimes', 'numeric', 'min:-2000', 'max:2000'],
            'clips.*.positionY' => ['sometimes', 'numeric', 'min:-2000', 'max:2000'],
            'clips.*.rotation' => ['sometimes', 'numeric', 'min:-180', 'max:180'],
            'clips.*.previewWidth' => ['nullable', 'integer', 'min:1', 'max:4000'],
            'clips.*.previewHeight' => ['nullable', 'integer', 'min:1', 'max:4000'],
        ]);

        $clips = collect($validated['clips'] ?? []);

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
                    'start' => $clip['start'],
                    'duration' => $clip['duration'],
                    'source_start' => $clip['sourceStart'],
                    'scale' => $clip['scale'] ?? 100,
                    'position_x' => $clip['positionX'] ?? 0,
                    'position_y' => $clip['positionY'] ?? 0,
                    'rotation' => $clip['rotation'] ?? 0,
                    'preview_width' => $clip['previewWidth'] ?? null,
                    'preview_height' => $clip['previewHeight'] ?? null,
                    'sort_order' => $index,
                ]);
            }
        });

        if (! ($validated['autoSave'] ?? false)) {
            Inertia::flash('toast', [
                'type' => 'success',
                'message' => __('Timeline saved.'),
            ]);
        }

        return to_route('projects.edit', $project);
    }

    /**
     * Render a text clip to a transparent image that FFmpeg can overlay on the video.
     */
    private function createTextOverlayImage(string $text, int $fontSize, string $directory, int $index): string
    {
        $text = trim(str_replace(["\n", "\r"], ' ', $text));
        $fontPath = $this->textRenderFontPath();
        $padding = max(12, (int) round($fontSize * 0.35));

        if ($fontPath !== null) {
            $box = imagettfbbox($fontSize, 0, $fontPath, $text);
            $minX = min($box[0], $box[2], $box[4], $box[6]);
            $maxX = max($box[0], $box[2], $box[4], $box[6]);
            $minY = min($box[1], $box[3], $box[5], $box[7]);
            $maxY = max($box[1], $box[3], $box[5], $box[7]);
            $width = max(1, $maxX - $minX + $padding * 2);
            $height = max(1, $maxY - $minY + $padding * 2);
            $textX = $padding - $minX;
            $textY = $padding - $minY;
        } else {
            $width = max(1, imagefontwidth(5) * strlen($text) + $padding * 2);
            $height = imagefontheight(5) + $padding * 2;
            $textX = $padding;
            $textY = $padding;
        }

        $image = imagecreatetruecolor($width, $height);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));

        $white = imagecolorallocate($image, 255, 255, 255);
        $shadow = imagecolorallocatealpha($image, 0, 0, 0, 25);

        if ($fontPath !== null) {
            imagettftext($image, $fontSize, 0, $textX + 2, $textY + 2, $shadow, $fontPath, $text);
            imagettftext($image, $fontSize, 0, $textX, $textY, $white, $fontPath, $text);
        } else {
            imagestring($image, 5, $textX + 2, $textY + 2, $text, $shadow);
            imagestring($image, 5, $textX, $textY, $text, $white);
        }

        $path = $directory.'/text-overlay-'.now()->format('YmdHis').'-'.$index.'.png';
        imagepng($image, $path);
        imagedestroy($image);

        return $path;
    }

    private function textRenderFontPath(): ?string
    {
        $fonts = [
            '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
            '/System/Library/Fonts/Supplemental/Arial.ttf',
            '/Library/Fonts/Arial.ttf',
        ];

        foreach ($fonts as $font) {
            if (is_file($font)) {
                return $font;
            }
        }

        return null;
    }

    /**
     * Convert editor-preview pixels to export pixels for text and visual clip transforms.
     */
    private function previewExportScale(string $format, array $renderSize, ProjectTimelineClip $clip): float
    {
        $previewSize = [
            'width' => $clip->preview_width ?: null,
            'height' => $clip->preview_height ?: null,
        ];

        if (! $previewSize['width'] || ! $previewSize['height']) {
            $previewSize = match ($format) {
                '9:16' => ['width' => 405, 'height' => 720],
                '1:1' => ['width' => 540, 'height' => 540],
                default => ['width' => 740, 'height' => 416],
            };
        }

        return min(
            $renderSize['width'] / $previewSize['width'],
            $renderSize['height'] / $previewSize['height'],
        );
    }

    private function evenDimension(int $value): int
    {
        $value = max(2, $value);

        return $value % 2 === 0 ? $value : $value + 1;
    }

    /**
     * Pick the server render size from project format and export quality.
     */
    private function exportRenderSize(string $format, string $quality): array
    {
        if ($format === '9:16') {
            return $quality === '720p'
                ? ['width' => 720, 'height' => 1280]
                : ['width' => 1080, 'height' => 1920];
        }

        if ($format === '1:1') {
            return $quality === '720p'
                ? ['width' => 720, 'height' => 720]
                : ['width' => 1080, 'height' => 1080];
        }

        return $quality === '720p'
            ? ['width' => 1280, 'height' => 720]
            : ['width' => 1920, 'height' => 1080];
    }

    /**
     * MAMP/PHP may not inherit the terminal PATH, so also check Homebrew's usual FFmpeg locations.
     */
    private function ffmpegPath(): string
    {
        $paths = [
            trim((string) shell_exec('command -v ffmpeg 2>/dev/null')),
            '/opt/homebrew/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
        ];

        foreach ($paths as $path) {
            if ($path !== '' && is_file($path) && is_executable($path)) {
                return $path;
            }
        }

        return '';
    }

    /**
     * Delete a project owned by the logged-in user.
     */
    public function destroy(Request $request, Project $project): RedirectResponse
    {
        $project = $request->user()->projects()->findOrFail($project->id);
        $project->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Project deleted.'),
        ]);

        return to_route('dashboard');
    }
}
