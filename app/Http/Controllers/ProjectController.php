<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
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
                    'url' => Storage::disk($clip->media->disk)->url($clip->media->path),
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
                    'url' => Storage::disk($clip->media->disk)->url($clip->media->path),
            ]),
        ]);
    }

    /**
     * Render the saved visual timeline into a downloadable video file.
     */
    public function renderExport(Request $request, Project $project): RedirectResponse|BinaryFileResponse
    {
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
            ->filter(fn ($clip) => $clip->type !== 'audio')
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
                array_push(
                    $command,
                    '-ss',
                    (string) $clip->source_start,
                    '-t',
                    (string) $clip->duration,
                    '-i',
                    $mediaPath,
                );
            }

            $filters[] = sprintf(
                '[%d:v]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,fps=30,setsar=1,format=yuv420p[v%d]',
                $index,
                $renderSize['width'],
                $renderSize['height'],
                $renderSize['width'],
                $renderSize['height'],
                $index,
            );
            $concatInputs[] = '[v'.$index.']';
        }

        $filters[] = implode('', $concatInputs).'concat=n='.$visualClips->count().':v=1:a=0[outv]';

        array_push(
            $command,
            '-filter_complex',
            implode(';', $filters),
            '-map',
            '[outv]',
            '-an',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            $outputPath,
        );

        $process = new Process($command);
        $process->setTimeout(300);
        $process->run();

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
            'clips' => ['array'],
            'clips.*.mediaId' => ['required', 'integer'],
            'clips.*.name' => ['required', 'string', 'max:255'],
            'clips.*.type' => ['required', Rule::in(['video', 'image', 'audio'])],
            'clips.*.start' => ['required', 'numeric', 'min:0', 'max:3600'],
            'clips.*.duration' => ['required', 'numeric', 'min:0.01', 'max:3600'],
            'clips.*.sourceStart' => ['required', 'numeric', 'min:0', 'max:3600'],
            'clips.*.scale' => ['sometimes', 'numeric', 'min:40', 'max:160'],
            'clips.*.positionX' => ['sometimes', 'numeric', 'min:-100', 'max:100'],
            'clips.*.positionY' => ['sometimes', 'numeric', 'min:-100', 'max:100'],
            'clips.*.rotation' => ['sometimes', 'numeric', 'min:-180', 'max:180'],
        ]);

        $mediaIds = $project->media()
            ->whereIn('id', collect($validated['clips'] ?? [])->pluck('mediaId'))
            ->pluck('id')
            ->all();

        $project->timelineClips()->delete();

        foreach ($validated['clips'] ?? [] as $index => $clip) {
            if (! in_array($clip['mediaId'], $mediaIds)) {
                continue;
            }

            $project->timelineClips()->create([
                'project_media_id' => $clip['mediaId'],
                'name' => $clip['name'],
                'type' => $clip['type'],
                'start' => $clip['start'],
                'duration' => $clip['duration'],
                'source_start' => $clip['sourceStart'],
                'scale' => $clip['scale'] ?? 100,
                'position_x' => $clip['positionX'] ?? 0,
                'position_y' => $clip['positionY'] ?? 0,
                'rotation' => $clip['rotation'] ?? 0,
                'sort_order' => $index,
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Timeline saved.'),
        ]);

        return to_route('projects.edit', $project);
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
