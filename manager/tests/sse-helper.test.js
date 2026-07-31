'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createRecordedSSEManager, createSSEManager } = require('../utils/sse-helper');

function responseFixture() {
    const req = new EventEmitter();
    const res = new EventEmitter();
    res.req = req;
    res.headers = {};
    res.output = '';
    res.writableEnded = false;
    res.setHeader = (name, value) => { res.headers[name] = value; };
    res.flushHeaders = () => {};
    res.write = chunk => { res.output += chunk; return true; };
    res.end = () => { res.writableEnded = true; res.emit('close'); };
    return { req, res };
}

test('normal request completion does not close an asynchronous SSE response', () => {
    const { req, res } = responseFixture();
    const sse = createSSEManager(res, { timeout: 60_000, heartbeatInterval: 60_000 });
    req.emit('close');
    assert.equal(sse.isClosed(), false);
    assert.equal(sse.sendResult({ success: true }), true);
    assert.match(res.output, /"type":"result"/);
    sse.close();
    assert.equal(res.writableEnded, true);
});

test('aborted requests close the SSE response', () => {
    const { req, res } = responseFixture();
    const sse = createSSEManager(res, { timeout: 60_000, heartbeatInterval: 60_000 });
    req.emit('aborted');
    assert.equal(sse.isClosed(), true);
    assert.equal(res.writableEnded, true);
});

test('successfully sent SSE events are forwarded to the persistence callback', () => {
    const { res } = responseFixture();
    const events = [];
    const sse = createSSEManager(res, {
        timeout: 60_000,
        heartbeatInterval: 60_000,
        onEvent: (type, data) => events.push({ type, data })
    });
    sse.sendLog('build output');
    sse.sendError('failed');
    assert.deepEqual(events, [
        { type: 'log', data: { content: 'build output' } },
        { type: 'error', data: { content: 'failed' } }
    ]);
    sse.close();
});

test('recorded SSE persists terminal events after the client disconnects', () => {
    const { req, res } = responseFixture();
    const events = [];
    const sse = createRecordedSSEManager(res, {
        onEvent: (type, data) => events.push({ type, data })
    }, { timeout: 60_000, heartbeatInterval: 60_000 });

    req.emit('aborted');
    assert.equal(sse.sendLog('continued in background'), false);
    assert.equal(sse.sendResult({ success: true }), false);
    assert.deepEqual(events, [
        { type: 'log', data: { content: 'continued in background' } },
        { type: 'result', data: { success: true } }
    ]);
});
