'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { DEFAULT_PROJECT_LIMITS, normalizeProjectLimits } = require('../services/project-limits');
const { createProjectConcurrencyGate } = require('../middleware/project-concurrency');

function response() {
    const res = new EventEmitter();
    res.headers = {};
    res.setHeader = (name, value) => { res.headers[name] = value; };
    res.status = status => { res.statusCode = status; return res; };
    res.send = body => { res.body = body; return res; };
    return res;
}

test('project limits normalize defaults and reject invalid values', () => {
    assert.deepEqual(normalizeProjectLimits(), DEFAULT_PROJECT_LIMITS);
    assert.equal(normalizeProjectLimits({ cpu: 1.5, concurrentRequests: 12 }).cpu, 1.5);
    assert.equal(normalizeProjectLimits({ concurrentRequests: 12 }).concurrentRequests, 12);
    assert.throws(() => normalizeProjectLimits({ memoryMb: 1 }), /memoryMb/);
    assert.throws(() => normalizeProjectLimits({ concurrentRequests: 1.5 }), /integer/);
});

test('project concurrency gate rejects excess requests and releases exactly once', () => {
    const gate = createProjectConcurrencyGate();
    const project = { id: 'project-1', limits: { ...DEFAULT_PROJECT_LIMITS, concurrentRequests: 1 } };
    const firstRequest = new EventEmitter();
    const firstResponse = response();
    assert.equal(gate.acquire(project, firstRequest, firstResponse), true);
    assert.equal(gate.count(project.id), 1);

    const rejectedResponse = response();
    assert.equal(gate.acquire(project, new EventEmitter(), rejectedResponse), false);
    assert.equal(rejectedResponse.statusCode, 429);
    assert.equal(rejectedResponse.headers['Retry-After'], '1');

    firstResponse.emit('finish');
    firstResponse.emit('close');
    assert.equal(gate.count(project.id), 0);
    assert.equal(gate.acquire(project, new EventEmitter(), response()), true);
});
