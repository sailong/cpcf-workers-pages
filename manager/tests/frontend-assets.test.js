'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

test('SPA fallback serves the console from a dot-prefixed application release path', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-frontend-'));
    const clientDistDirectory = path.join(
        root,
        '.platform-data',
        'app-releases',
        'versions',
        'v1.0.0',
        'manager',
        'client',
        'dist'
    );
    fs.mkdirSync(clientDistDirectory, { recursive: true });
    fs.writeFileSync(path.join(clientDistDirectory, 'index.html'), '<!doctype html><title>CCFWP test console</title>');

    const server = await new Promise((resolve, reject) => {
        const listener = createApp({ clientDistDirectory }).listen(0, '127.0.0.1', () => resolve(listener));
        listener.once('error', reject);
    });
    t.after(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        fs.rmSync(root, { recursive: true, force: true });
    });

    const response = await fetch(`http://127.0.0.1:${server.address().port}/login`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /CCFWP test console/);
});
