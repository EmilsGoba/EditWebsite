<?php

use App\Models\Project;
use App\Models\User;
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
