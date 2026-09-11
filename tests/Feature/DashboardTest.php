<?php

use App\Models\Project;
use App\Models\ProjectMedia;
use App\Models\ProjectTimelineClip;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk();
});

test('dashboard shows only the current users projects', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $project = Project::factory()->for($user)->create([
        'name' => 'My database project',
    ]);

    Project::factory()->for($otherUser)->create([
        'name' => 'Someone elses project',
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->has('projects', 1)
            ->where('projects.0.id', $project->id)
            ->where('projects.0.name', 'My database project'),
        );
});

test('users can open their own project editor', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create([
        'name' => 'Editor project',
    ]);
    $media = $project->media()->create([
        'type' => 'video',
        'original_name' => 'lesson-video.mp4',
        'path' => 'projects/'.$project->id.'/media/lesson-video.mp4',
        'disk' => 'public',
        'mime_type' => 'video/mp4',
        'size' => 1024,
    ]);
    $clip = $project->timelineClips()->create([
        'project_media_id' => $media->id,
        'type' => 'video',
        'name' => 'lesson-video.mp4',
        'start' => 0,
        'duration' => 7,
        'source_start' => 0,
        'sort_order' => 0,
    ]);

    $this->actingAs($user)
        ->get(route('projects.edit', $project))
        ->assertInertia(fn (Assert $page) => $page
            ->component('projects/editor')
            ->where('project.id', $project->id)
            ->where('project.name', 'Editor project')
            ->has('media', 1)
            ->where('media.0.id', $media->id)
            ->where('media.0.name', 'lesson-video.mp4')
            ->has('timelineClips', 1)
            ->where('timelineClips.0.id', $clip->id)
            ->where('timelineClips.0.mediaId', $media->id)
            ->where('timelineClips.0.duration', 7),
        );
});

test('users cannot open another users project editor', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $project = Project::factory()->for($otherUser)->create();

    $this->actingAs($user)
        ->get(route('projects.edit', $project))
        ->assertNotFound();
});

test('users can open their own project export page', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create([
        'name' => 'Export project',
    ]);

    $this->actingAs($user)
        ->get(route('projects.export', $project))
        ->assertInertia(fn (Assert $page) => $page
            ->component('projects/export')
            ->where('project.id', $project->id)
            ->where('project.name', 'Export project'),
        );
});

test('users cannot open another users project export page', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $project = Project::factory()->for($otherUser)->create();

    $this->actingAs($user)
        ->get(route('projects.export', $project))
        ->assertNotFound();
});

test('users can create a project', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('projects.store'), [
            'name' => 'Graduation video',
            'format' => '16:9',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('dashboard'));

    $this->assertDatabaseHas('projects', [
        'user_id' => $user->id,
        'name' => 'Graduation video',
        'format' => '16:9',
        'status' => 'draft',
    ]);
});

test('users cannot create two projects with the same name', function () {
    $user = User::factory()->create();

    Project::factory()->for($user)->create([
        'name' => 'Graduation video',
    ]);

    $this->actingAs($user)
        ->post(route('projects.store'), [
            'name' => 'Graduation video',
            'format' => '16:9',
        ])
        ->assertSessionHasErrors('name');

    expect($user->projects()->where('name', 'Graduation video')->count())
        ->toBe(1);
});

test('different users can use the same project name', function () {
    $firstUser = User::factory()->create();
    $secondUser = User::factory()->create();

    Project::factory()->for($firstUser)->create([
        'name' => 'Graduation video',
    ]);

    $this->actingAs($secondUser)
        ->post(route('projects.store'), [
            'name' => 'Graduation video',
            'format' => '9:16',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('dashboard'));

    $this->assertDatabaseHas('projects', [
        'user_id' => $secondUser->id,
        'name' => 'Graduation video',
        'format' => '9:16',
    ]);
});

test('users can update their own project settings', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create([
        'name' => 'Old project name',
        'format' => '16:9',
    ]);

    $this->actingAs($user)
        ->put(route('projects.update', $project), [
            'name' => 'Updated project name',
            'format' => '1:1',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('dashboard'));

    $this->assertDatabaseHas('projects', [
        'id' => $project->id,
        'name' => 'Updated project name',
        'format' => '1:1',
    ]);
});

test('users cannot rename a project to a duplicate name', function () {
    $user = User::factory()->create();

    Project::factory()->for($user)->create([
        'name' => 'Existing project',
    ]);

    $project = Project::factory()->for($user)->create([
        'name' => 'Second project',
    ]);

    $this->actingAs($user)
        ->put(route('projects.update', $project), [
            'name' => 'Existing project',
            'format' => '16:9',
        ])
        ->assertSessionHasErrors('name');

    expect($project->refresh()->name)->toBe('Second project');
});

test('users cannot update another users project', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $project = Project::factory()->for($otherUser)->create([
        'name' => 'Private project',
    ]);

    $this->actingAs($user)
        ->put(route('projects.update', $project), [
            'name' => 'Changed by wrong user',
            'format' => '16:9',
        ])
        ->assertNotFound();

    expect($project->refresh()->name)->toBe('Private project');
});

test('users can upload media to their own project', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $file = UploadedFile::fake()->create('sample-video.mp4', 2048, 'video/mp4');

    $this->actingAs($user)
        ->post(route('projects.media.store', $project), [
            'type' => 'video',
            'file' => $file,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('projects.edit', $project));

    $media = ProjectMedia::firstOrFail();

    expect($media->project_id)->toBe($project->id)
        ->and($media->type)->toBe('video')
        ->and($media->original_name)->toBe('sample-video.mp4');

    Storage::disk('public')->assertExists($media->path);
});

test('users cannot upload media to another users project', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $project = Project::factory()->for($otherUser)->create();
    $file = UploadedFile::fake()->image('cover-image.jpg');

    $this->actingAs($user)
        ->post(route('projects.media.store', $project), [
            'type' => 'image',
            'file' => $file,
        ])
        ->assertNotFound();

    expect(ProjectMedia::count())->toBe(0);
});

test('video uploads cannot be larger than five hundred megabytes', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $file = UploadedFile::fake()->create('too-large.mp4', 512001, 'video/mp4');

    $this->actingAs($user)
        ->post(route('projects.media.store', $project), [
            'type' => 'video',
            'file' => $file,
        ])
        ->assertSessionHasErrors('file');

    expect(ProjectMedia::count())->toBe(0);
});

test('users can delete selected media from their own project', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    Storage::disk('public')->put('projects/'.$project->id.'/media/delete-me.mp4', 'video');
    $media = $project->media()->create([
        'type' => 'video',
        'original_name' => 'delete-me.mp4',
        'path' => 'projects/'.$project->id.'/media/delete-me.mp4',
        'disk' => 'public',
        'mime_type' => 'video/mp4',
        'size' => 1024,
    ]);

    $this->actingAs($user)
        ->delete(route('projects.media.destroy', $project), [
            'media_ids' => [$media->id],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('projects.edit', $project));

    $this->assertDatabaseMissing('project_media', [
        'id' => $media->id,
    ]);
    Storage::disk('public')->assertMissing($media->path);
});

test('users cannot delete media through another users project', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $project = Project::factory()->for($otherUser)->create();
    Storage::disk('public')->put('projects/'.$project->id.'/media/private.mp4', 'video');
    $media = $project->media()->create([
        'type' => 'video',
        'original_name' => 'private.mp4',
        'path' => 'projects/'.$project->id.'/media/private.mp4',
        'disk' => 'public',
        'mime_type' => 'video/mp4',
        'size' => 1024,
    ]);

    $this->actingAs($user)
        ->delete(route('projects.media.destroy', $project), [
            'media_ids' => [$media->id],
        ])
        ->assertNotFound();

    $this->assertDatabaseHas('project_media', [
        'id' => $media->id,
    ]);
    Storage::disk('public')->assertExists($media->path);
});

test('users can save their project timeline', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $media = $project->media()->create([
        'type' => 'video',
        'original_name' => 'timeline-video.mp4',
        'path' => 'projects/'.$project->id.'/media/timeline-video.mp4',
        'disk' => 'public',
        'mime_type' => 'video/mp4',
        'size' => 1024,
    ]);

    $this->actingAs($user)
        ->put(route('projects.timeline.save', $project), [
            'clips' => [
                [
                    'mediaId' => $media->id,
                    'name' => 'timeline-video.mp4',
                    'type' => 'video',
                    'start' => 0.5,
                    'duration' => 7.25,
                    'sourceStart' => 0,
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('projects.edit', $project));

    $this->assertDatabaseHas('project_timeline_clips', [
        'project_id' => $project->id,
        'project_media_id' => $media->id,
        'name' => 'timeline-video.mp4',
        'type' => 'video',
        'start' => 0.5,
        'duration' => 7.25,
        'source_start' => 0,
    ]);
});

test('saving a project timeline replaces old clips', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $media = $project->media()->create([
        'type' => 'image',
        'original_name' => 'cover.jpg',
        'path' => 'projects/'.$project->id.'/media/cover.jpg',
        'disk' => 'public',
        'mime_type' => 'image/jpeg',
        'size' => 1024,
    ]);
    $oldClip = $project->timelineClips()->create([
        'project_media_id' => $media->id,
        'type' => 'image',
        'name' => 'old-cover.jpg',
        'start' => 0,
        'duration' => 5,
        'source_start' => 0,
        'sort_order' => 0,
    ]);

    $this->actingAs($user)
        ->put(route('projects.timeline.save', $project), [
            'clips' => [
                [
                    'mediaId' => $media->id,
                    'name' => 'cover.jpg',
                    'type' => 'image',
                    'start' => 2,
                    'duration' => 4,
                    'sourceStart' => 0,
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $this->assertDatabaseMissing('project_timeline_clips', [
        'id' => $oldClip->id,
    ]);
    $this->assertDatabaseHas('project_timeline_clips', [
        'project_id' => $project->id,
        'name' => 'cover.jpg',
        'start' => 2,
        'duration' => 4,
    ]);
});

test('users cannot save another users project timeline', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $project = Project::factory()->for($otherUser)->create();
    $media = $project->media()->create([
        'type' => 'audio',
        'original_name' => 'private.mp3',
        'path' => 'projects/'.$project->id.'/media/private.mp3',
        'disk' => 'public',
        'mime_type' => 'audio/mpeg',
        'size' => 1024,
    ]);

    $this->actingAs($user)
        ->put(route('projects.timeline.save', $project), [
            'clips' => [
                [
                    'mediaId' => $media->id,
                    'name' => 'private.mp3',
                    'type' => 'audio',
                    'start' => 0,
                    'duration' => 12,
                    'sourceStart' => 0,
                ],
            ],
        ])
        ->assertNotFound();

    expect(ProjectTimelineClip::count())->toBe(0);
});

test('users can delete their own project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->delete(route('projects.destroy', $project))
        ->assertRedirect(route('dashboard'));

    $this->assertDatabaseMissing('projects', [
        'id' => $project->id,
    ]);
});

test('users cannot delete another users project', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $project = Project::factory()->for($otherUser)->create();

    $this->actingAs($user)
        ->delete(route('projects.destroy', $project))
        ->assertNotFound();

    $this->assertDatabaseHas('projects', [
        'id' => $project->id,
    ]);
});
