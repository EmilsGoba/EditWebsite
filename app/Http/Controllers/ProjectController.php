<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Services\Projects\TimelineExporter;
use App\Services\Projects\TimelineSaver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

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
                    'trackIndex' => $clip->track_index,
                    'start' => (float) $clip->start,
                    'duration' => (float) $clip->duration,
                    'sourceStart' => (float) $clip->source_start,
                    'scale' => (float) $clip->scale,
                    'positionX' => (float) $clip->position_x,
                    'positionY' => (float) $clip->position_y,
                    'rotation' => (float) $clip->rotation,
                    'previewWidth' => $clip->preview_width,
                    'previewHeight' => $clip->preview_height,
                    'effects' => $clip->effects ?? [],
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
                    'effects' => $clip->effects ?? [],
                    'url' => $clip->media
                        ? Storage::disk($clip->media->disk)->url($clip->media->path)
                        : null,
                ]),
        ]);
    }

    /**
     * Render the saved visual timeline into a downloadable video file.
     */
    public function renderExport(Request $request, Project $project, TimelineExporter $timelineExporter): RedirectResponse|BinaryFileResponse
    {
        $project = $request->user()->projects()->findOrFail($project->id);

        $validated = $request->validate([
            'file_type' => ['required', Rule::in(['mp4', 'mov'])],
            'quality' => ['required', Rule::in(['720p', '1080p', 'Original'])],
        ]);

        return $timelineExporter->render($project, $validated);
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
    public function saveTimeline(Request $request, Project $project, TimelineSaver $timelineSaver): RedirectResponse
    {
        $project = $request->user()->projects()->findOrFail($project->id);

        $validated = $request->validate([
            'autoSave' => ['sometimes', 'boolean'],
            'clips' => ['array'],
            'clips.*.mediaId' => ['nullable', 'integer'],
            'clips.*.name' => ['required', 'string', 'max:255'],
            'clips.*.type' => ['required', Rule::in(['video', 'image', 'audio', 'text'])],
            'clips.*.trackIndex' => ['sometimes', 'integer', 'min:1', 'max:12'],
            'clips.*.start' => ['required', 'numeric', 'min:0', 'max:3600'],
            'clips.*.duration' => ['required', 'numeric', 'min:0.01', 'max:3600'],
            'clips.*.sourceStart' => ['required', 'numeric', 'min:0', 'max:3600'],
            'clips.*.scale' => ['sometimes', 'numeric', 'min:40', 'max:1000'],
            'clips.*.positionX' => ['sometimes', 'numeric', 'min:-2000', 'max:2000'],
            'clips.*.positionY' => ['sometimes', 'numeric', 'min:-2000', 'max:2000'],
            'clips.*.rotation' => ['sometimes', 'numeric', 'min:-180', 'max:180'],
            'clips.*.previewWidth' => ['nullable', 'integer', 'min:1', 'max:4000'],
            'clips.*.previewHeight' => ['nullable', 'integer', 'min:1', 'max:4000'],
            'clips.*.effects' => ['sometimes', 'array'],
            'clips.*.effects.*.id' => ['required', 'string', Rule::in(['blur', 'glow', 'invert-color'])],
            'clips.*.effects.*.start' => ['required', 'numeric', 'min:0', 'max:3600'],
            'clips.*.effects.*.duration' => ['required', 'numeric', 'min:0.01', 'max:3600'],
        ]);

        $timelineSaver->save($project, $validated['clips'] ?? []);

        if (! ($validated['autoSave'] ?? false)) {
            Inertia::flash('toast', [
                'type' => 'success',
                'message' => __('Timeline saved.'),
            ]);
        }

        return to_route('projects.edit', $project);
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
