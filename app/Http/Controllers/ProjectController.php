<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
