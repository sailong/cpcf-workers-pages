'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Miniflare } = require('miniflare');
const config = require('../config');

const RESOURCE_KINDS = ['kv', 'd1', 'r2'];
const WORKER_SCRIPT = 'export default { fetch() { return new Response("resource runtime"); } };';

function bindingName(kind, id) {
    return `${kind.toUpperCase()}_${String(id).replace(/[^A-Za-z0-9_]/g, '_')}`;
}

function normalizeResources(resources = {}) {
    return Object.fromEntries(RESOURCE_KINDS.map(kind => [kind, [...(resources[kind] || [])]]));
}

class LifecycleGate {
    constructor() {
        this.active = 0;
        this.blocked = false;
        this.waiters = [];
        this.drainWaiters = [];
        this.lifecycleTail = Promise.resolve();
    }

    async run(operation) {
        while (this.blocked) await new Promise(resolve => this.waiters.push(resolve));
        this.active++;
        try {
            return await operation();
        } finally {
            this.active--;
            if (this.active === 0) this.drainWaiters.splice(0).forEach(resolve => resolve());
        }
    }

    exclusive(operation) {
        const previous = this.lifecycleTail;
        let release;
        this.lifecycleTail = new Promise(resolve => { release = resolve; });
        return (async () => {
            await previous;
            this.blocked = true;
            if (this.active > 0) await new Promise(resolve => this.drainWaiters.push(resolve));
            try {
                return await operation();
            } finally {
                this.blocked = false;
                this.waiters.splice(0).forEach(resolve => resolve());
                release();
            }
        })();
    }
}

class ResourceRuntime {
    constructor(options = {}) {
        this.wranglerPersistDir = options.wranglerPersistDir || config.WRANGLER_STATE_DIR;
        this.r2PersistDir = options.r2PersistDir || config.R2_STATE_DIR;
        this.kvDataDir = options.kvDataDir || config.KV_DATA_DIR;
        this.logger = options.logger || console;
        this.resources = normalizeResources();
        this.excluded = new Set();
        this.instance = null;
        this.gate = new LifecycleGate();
        this.legacyKVImported = false;
    }

    options() {
        const active = kind => this.resources[kind].filter(resource => !this.excluded.has(resource.id));
        return {
            script: WORKER_SCRIPT,
            modules: true,
            compatibilityDate: '2025-04-28',
            kvNamespaces: Object.fromEntries(active('kv').map(resource => [bindingName('kv', resource.id), resource.id])),
            d1Databases: Object.fromEntries(active('d1').map(resource => [bindingName('d1', resource.id), resource.id])),
            r2Buckets: Object.fromEntries(active('r2').map(resource => [bindingName('r2', resource.id), resource.id])),
            kvPersist: this.wranglerPersistDir,
            d1Persist: this.wranglerPersistDir,
            r2Persist: this.r2PersistDir
        };
    }

    async ensureInstance() {
        if (!this.instance) this.instance = new Miniflare(this.options());
        await this.instance.ready;
    }

    async start(resources) {
        return this.gate.exclusive(async () => {
            this.resources = normalizeResources(resources);
            await fs.promises.mkdir(this.wranglerPersistDir, { recursive: true, mode: 0o700 });
            await fs.promises.mkdir(this.r2PersistDir, { recursive: true, mode: 0o700 });
            await this.ensureInstance();
            await this.importLegacyKV();
            return { provider: 'miniflare', authoritative: true };
        });
    }

    async sync(resources) {
        return this.gate.exclusive(async () => {
            this.resources = normalizeResources(resources);
            const knownIds = new Set(RESOURCE_KINDS.flatMap(kind => this.resources[kind].map(resource => resource.id)));
            for (const id of this.excluded) if (!knownIds.has(id)) this.excluded.delete(id);
            if (this.instance) await this.instance.setOptions(this.options());
            else await this.ensureInstance();
            await this.importLegacyKV();
        });
    }

    async importLegacyKV() {
        if (this.legacyKVImported || !this.instance) return;
        let completed = true;
        for (const resource of this.resources.kv) {
            const legacyFile = path.join(this.kvDataDir, `${resource.id}.json`);
            if (!fs.existsSync(legacyFile)) continue;
            let entries;
            try {
                entries = Object.entries(JSON.parse(await fs.promises.readFile(legacyFile, 'utf8')));
            } catch (error) {
                completed = false;
                this.logger.error(`[Resource Runtime] Cannot import legacy KV ${resource.id}:`, error);
                continue;
            }
            try {
                const namespace = await this.instance.getKVNamespace(bindingName('kv', resource.id));
                for (const [key, value] of entries) {
                    if (await namespace.get(key) !== null) continue;
                    if (typeof value === 'string') await namespace.put(key, value);
                    else await namespace.put(key, JSON.stringify(value), { metadata: { ccfwpEncoding: 'json' } });
                }
            } catch (error) {
                completed = false;
                this.logger.error(`[Resource Runtime] Failed to import legacy KV ${resource.id}:`, error);
            }
        }
        // Only mark complete after a full successful pass so transient Miniflare
        // or disk failures can be retried on the next start/sync.
        this.legacyKVImported = completed;
    }

    hasResource(kind, id) {
        return RESOURCE_KINDS.includes(kind)
            && !this.excluded.has(id)
            && this.resources[kind].some(resource => resource.id === id);
    }

    async withResource(kind, id, operation) {
        return this.gate.run(async () => {
            if (!this.hasResource(kind, id)) {
                const error = new Error(`${kind.toUpperCase()} resource not found`);
                error.statusCode = 404;
                throw error;
            }
            await this.ensureInstance();
            const name = bindingName(kind, id);
            const handle = kind === 'kv'
                ? await this.instance.getKVNamespace(name)
                : kind === 'd1'
                    ? await this.instance.getD1Database(name)
                    : await this.instance.getR2Bucket(name);
            return operation(handle);
        });
    }

    getKVNamespace(id) { return this.withResource('kv', id, namespace => namespace); }
    getD1Database(id) { return this.withResource('d1', id, database => database); }
    getR2Bucket(id) { return this.withResource('r2', id, bucket => bucket); }

    async suspendResource(resource, cleanup) {
        return this.gate.exclusive(async () => {
            this.excluded.add(resource.id);
            if (this.instance) {
                await this.instance.dispose();
                this.instance = null;
            }
            try {
                await cleanup();
            } catch (error) {
                this.excluded.delete(resource.id);
                await this.ensureInstance();
                throw error;
            }
            await this.ensureInstance();
        });
    }

    async dispose() {
        return this.gate.exclusive(async () => {
            if (!this.instance) return;
            await this.instance.dispose();
            this.instance = null;
        });
    }
}

const runtime = new ResourceRuntime();

module.exports = runtime;
module.exports.ResourceRuntime = ResourceRuntime;
module.exports.bindingName = bindingName;
