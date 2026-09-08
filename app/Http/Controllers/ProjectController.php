<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

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
        ]);
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
            'video' => ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska'],
            'image' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            'audio' => ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/x-aac', 'audio/ogg', 'audio/flac'],
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
