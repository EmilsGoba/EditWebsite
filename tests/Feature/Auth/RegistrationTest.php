<?php

use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password1',
        'password_confirmation' => 'password1',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});

test('registration requires a valid name', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'A',
        'email' => 'test@example.com',
        'password' => 'password1',
        'password_confirmation' => 'password1',
    ]);

    $response->assertSessionHasErrors('name');
    $this->assertGuest();
});

test('registration requires a valid email', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'not-an-email',
        'password' => 'password1',
        'password_confirmation' => 'password1',
    ]);

    $response->assertSessionHasErrors('email');
    $this->assertGuest();
});

test('registration requires a stronger password', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertSessionHasErrors('password');
    $this->assertGuest();
});
