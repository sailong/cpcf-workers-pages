'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { errorStatus } = require('../utils/http-error');

test('errorStatus accepts only valid HTTP error status codes', () => {
    assert.equal(errorStatus({ statusCode: 422 }), 422);
    assert.equal(errorStatus({ status: 404 }), 404);
    assert.equal(errorStatus({ statusCode: 399 }), 500);
    assert.equal(errorStatus({ statusCode: '503' }), 503);
    assert.equal(errorStatus(new Error('internal')), 500);
    assert.equal(errorStatus(null, 502), 502);
});
