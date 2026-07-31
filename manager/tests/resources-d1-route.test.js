'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const resourceService = require('../services/resource-service');
const d1Helper = require('../utils/d1-helper');
const d1Migrations = require('../services/d1-migration-service');
const auditService = require('../services/audit-service');
const router = require('../routes/resources-d1');

async function request(app, path, options = {}) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    try {
        return await new Promise((resolve, reject) => {
            const body = options.body === undefined ? null : JSON.stringify(options.body);
            const req = http.request(`http://127.0.0.1:${server.address().port}${path}`, {
                method: options.method || 'GET',
                headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
            }, response => {
                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', () => resolve({
                    status: response.statusCode,
                    body: JSON.parse(Buffer.concat(chunks).toString())
                }));
            });
            req.on('error', reject);
            if (body) req.write(body);
            req.end();
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test('D1 table query awaits async results and reports async failures', async () => {
    const originalGetD1 = resourceService.getD1;
    const originalQueryTable = d1Helper.queryTable;
    const app = express().use('/api/d1', router);
    resourceService.getD1 = () => [{ id: 'db-1', name: 'test' }];

    try {
        d1Helper.queryTable = async (id, table, limit) => ({ id, table, limit, rows: [[1]] });
        const success = await request(app, '/api/d1/db-1/query?table=items&limit=25');
        assert.equal(success.status, 200);
        assert.deepEqual(success.body, { id: 'db-1', table: 'items', limit: 25, rows: [[1]] });

        d1Helper.queryTable = async () => {
            const error = new Error('query failed');
            error.statusCode = 422;
            throw error;
        };
        const failure = await request(app, '/api/d1/db-1/query?table=items');
        assert.equal(failure.status, 422);
        assert.deepEqual(failure.body, { error: 'query failed' });
    } finally {
        resourceService.getD1 = originalGetD1;
        d1Helper.queryTable = originalQueryTable;
    }
});

test('D1 migration routes expose status and audit names without SQL content', async () => {
    const originalList = d1Migrations.list;
    const originalApply = d1Migrations.apply;
    const originalRecord = auditService.record;
    const events = [];
    const app = express().use(express.json()).use('/api/d1', router);

    try {
        d1Migrations.list = async id => ({ table: 'd1_migrations', applied: [{ id: 1, name: `${id}.sql` }] });
        d1Migrations.apply = async (id, migrations) => ({
            table: 'd1_migrations',
            applied: migrations.map(migration => migration.name),
            skipped: [],
            migrations: migrations.map((migration, index) => ({ id: index + 1, name: migration.name }))
        });
        auditService.record = (...args) => events.push(args);

        const listed = await request(app, '/api/d1/database-one/migrations');
        assert.equal(listed.status, 200);
        assert.deepEqual(listed.body.applied, [{ id: 1, name: 'database-one.sql' }]);

        const applied = await request(app, '/api/d1/database-one/migrations/apply', {
            method: 'POST',
            body: { migrations: [{ name: '1_create.sql', sql: 'CREATE TABLE secret_data (value TEXT);' }] }
        });
        assert.equal(applied.status, 200);
        assert.deepEqual(applied.body.applied, ['1_create.sql']);
        assert.equal(events.length, 1);
        assert.deepEqual(events[0], [
            'd1.migrations.apply',
            'resource',
            'database-one',
            { names: ['1_create.sql'], appliedCount: 1, skippedCount: 0 }
        ]);
        assert.doesNotMatch(JSON.stringify(events), /CREATE TABLE|secret_data/);
    } finally {
        d1Migrations.list = originalList;
        d1Migrations.apply = originalApply;
        auditService.record = originalRecord;
    }
});
