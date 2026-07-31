'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { RuntimeBroker } = require('../services/runtime-broker');

test('process runtime requires explicit unisolated opt-in', () => {
    const previous = process.env.ALLOW_UNISOLATED_RUNTIME;
    try {
        delete process.env.ALLOW_UNISOLATED_RUNTIME;
        assert.throws(
            () => new RuntimeBroker(path.join(__dirname, 'uploads'), { kv: [], d1: [], r2: [] }, { providerName: 'process' }),
            /ALLOW_UNISOLATED_RUNTIME/
        );
        process.env.ALLOW_UNISOLATED_RUNTIME = 'true';
        const broker = new RuntimeBroker(path.join(__dirname, 'uploads'), { kv: [], d1: [], r2: [] }, { providerName: 'process' });
        assert.equal(broker.providerName, 'process');
    } finally {
        if (previous === undefined) delete process.env.ALLOW_UNISOLATED_RUNTIME;
        else process.env.ALLOW_UNISOLATED_RUNTIME = previous;
    }
});

test('docker remains the default runtime provider', () => {
    const previous = process.env.RUNTIME_PROVIDER;
    try {
        delete process.env.RUNTIME_PROVIDER;
        const broker = new RuntimeBroker(path.join(__dirname, 'uploads'), { kv: [], d1: [], r2: [] }, {
            provider: {
                resources: { kv: [], d1: [], r2: [] },
                processes: new Map(),
                async assertReady() { return { provider: 'docker' }; },
                isRunning() { return false; },
                getTarget() { return null; },
                async start() { return {}; },
                async stop() {},
                async restore() {},
                async runBuild() { return { success: true }; },
                async collectObservability() {},
                getMetrics() { return null; }
            }
        });
        assert.equal(broker.providerName, 'docker');
    } finally {
        if (previous === undefined) delete process.env.RUNTIME_PROVIDER;
        else process.env.RUNTIME_PROVIDER = previous;
    }
});
