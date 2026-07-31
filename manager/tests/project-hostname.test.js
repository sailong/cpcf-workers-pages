'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProjectName } = require('../utils/project-hostname');

test('project names fit the full generated DNS label', () => {
    assert.equal(validateProjectName('w'.repeat(56), 'worker'), 'w'.repeat(56));
    assert.equal(validateProjectName('p'.repeat(57), 'pages'), 'p'.repeat(57));
    assert.throws(() => validateProjectName('w'.repeat(57), 'worker'), /1-56/);
    assert.throws(() => validateProjectName('p'.repeat(58), 'pages'), /1-57/);
});

test('project names reject invalid DNS labels and project types', () => {
    for (const name of ['', '-demo', 'demo-', 'demo_name', 'demo.example']) {
        assert.throws(() => validateProjectName(name, 'worker'), /letters, numbers, or hyphens/);
    }
    assert.throws(() => validateProjectName('demo', 'build'), /worker or pages/);
});
