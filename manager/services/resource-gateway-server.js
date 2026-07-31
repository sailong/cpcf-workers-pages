'use strict';

const http = require('node:http');
const { Readable } = require('node:stream');
const { finished } = require('node:stream/promises');
const config = require('../config');
const projectService = require('./project-service');
const resourceRuntime = require('./resource-runtime');
const gatewayAuth = require('./resource-gateway-auth');
const { encode, decode } = require('./resource-gateway-codec');

const KINDS = new Set(['kv', 'd1', 'r2']);

function json(res, status, body) {
    const payload = Buffer.from(JSON.stringify(encode(body)));
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'Cache-Control': 'no-store'
    });
    res.end(payload);
}

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function decodePathComponent(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        throw badRequest('Malformed resource gateway path');
    }
}

function decodeOptionsHeader(value) {
    try {
        return decode(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    } catch {
        throw badRequest('Invalid R2 options header');
    }
}

async function readBody(req, limit) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) {
            const error = new Error('Resource request body is too large');
            error.statusCode = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function readJson(req, limit) {
    const body = await readBody(req, limit);
    if (body.length === 0) return {};
    try {
        return decode(JSON.parse(body.toString('utf8')));
    } catch (error) {
        error.statusCode = 400;
        throw error;
    }
}


function requireString(value, field) {
    if (typeof value !== 'string' || value.length === 0) throw badRequest(`${field} is required`);
    return value;
}

function requireObject(value, field) {
    if (value === undefined || value === null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) throw badRequest(`${field} must be an object`);
    return value;
}

function requireArray(value, field) {
    if (!Array.isArray(value)) throw badRequest(`${field} must be an array`);
    return value;
}

function requireInteger(value, field) {
    if (!Number.isInteger(value)) throw badRequest(`${field} must be an integer`);
    return value;
}

function projectHasBinding(project, kind, resourceId) {
    return (project.bindings?.[kind] || []).some(binding => binding.resourceId === resourceId);
}

function r2Metadata(object) {
    if (!object) return null;
    return {
        key: object.key,
        version: object.version,
        size: object.size,
        etag: object.etag,
        httpEtag: object.httpEtag,
        uploaded: object.uploaded,
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
        range: object.range,
        checksums: object.checksums
    };
}

class ResourceGatewayServer {
    constructor(options = {}) {
        this.host = options.host || '0.0.0.0';
        this.port = options.port ?? config.RESOURCE_GATEWAY_PORT;
        this.projects = options.projectService || projectService;
        this.resources = options.resourceRuntime || resourceRuntime;
        this.auth = options.auth || gatewayAuth;
        this.server = null;
    }

    async start() {
        if (this.server) return this.address();
        await this.auth.initialize();
        this.server = http.createServer((req, res) => {
            this.handle(req, res).catch(error => {
                if (res.headersSent) return res.destroy(error);
                json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Resource gateway failure' });
            });
        });
        await new Promise((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(this.port, this.host, resolve);
        });
        return this.address();
    }

    address() {
        const address = this.server?.address();
        return { host: this.host, port: typeof address === 'object' && address ? address.port : this.port };
    }

    async stop() {
        if (!this.server) return;
        const server = this.server;
        this.server = null;
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }

    async handle(req, res) {
        const url = new URL(req.url, 'http://resource-gateway.invalid');
        if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
        const match = url.pathname.match(/^\/v1\/([^/]+)\/(kv|d1|r2)\/([^/]+)\/([^/]+)$/);
        if (!match) return json(res, 404, { error: 'Not found' });
        const [, encodedProjectId, kind, encodedResourceId, operation] = match;
        const projectId = decodePathComponent(encodedProjectId);
        const resourceId = decodePathComponent(encodedResourceId);
        const bearer = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
        if (!this.auth.verifyProjectToken(projectId, bearer)) return json(res, 401, { error: 'Invalid resource token' });
        const project = this.projects.getById(projectId);
        if (!project) return json(res, 404, { error: 'Project not found' });
        if (!KINDS.has(kind) || !projectHasBinding(project, kind, resourceId)) {
            return json(res, 403, { error: 'Resource is not bound to this project' });
        }
        const bodyLimit = Math.max(1, project.limits?.uploadMb || 10) * 1024 * 1024;
        if (kind === 'kv') return this.handleKV(req, res, resourceId, operation, bodyLimit);
        if (kind === 'd1') return this.handleD1(req, res, resourceId, operation, bodyLimit);
        return this.handleR2(req, res, resourceId, operation, bodyLimit);
    }

    async handleKV(req, res, resourceId, operation, limit) {
        const body = await readJson(req, limit);
        return this.resources.withResource('kv', resourceId, async namespace => {
            if (operation === 'get') {
                const key = requireString(body.key, 'key');
                const options = requireObject(body.options, 'options');
                const result = await namespace.getWithMetadata(key, 'arrayBuffer', options);
                return json(res, 200, { found: result.value !== null, ...result });
            }
            if (operation === 'put') {
                const key = requireString(body.key, 'key');
                if (body.value === undefined || body.value === null) throw badRequest('value is required');
                if (typeof body.value !== 'string' && !(body.value instanceof ArrayBuffer) && !ArrayBuffer.isView(body.value)) {
                    throw badRequest('value must be a string or bytes');
                }
                const options = requireObject(body.options, 'options');
                await namespace.put(key, body.value, options);
                return json(res, 200, { success: true });
            }
            if (operation === 'delete') {
                const key = requireString(body.key, 'key');
                await namespace.delete(key);
                return json(res, 200, { success: true });
            }
            if (operation === 'list') {
                const options = requireObject(body.options, 'options');
                return json(res, 200, await namespace.list(options));
            }
            return json(res, 404, { error: 'Unknown KV operation' });
        });
    }

    async handleD1(req, res, resourceId, operation, limit) {
        const body = await readJson(req, limit);
        return this.resources.withResource('d1', resourceId, async database => {
            if (operation === 'exec') {
                const query = requireString(body.query, 'query');
                return json(res, 200, await database.exec(query));
            }
            if (operation === 'dump') return json(res, 200, await database.dump());
            if (operation === 'batch') {
                const statementsInput = requireArray(body.statements, 'statements');
                const statements = statementsInput.map((item, index) => {
                    if (!item || typeof item !== 'object' || Array.isArray(item)) {
                        throw badRequest(`statements[${index}] must be an object`);
                    }
                    const query = requireString(item.query, `statements[${index}].query`);
                    const bindings = item.bindings === undefined ? [] : requireArray(item.bindings, `statements[${index}].bindings`);
                    return database.prepare(query).bind(...bindings);
                });
                return json(res, 200, await database.batch(statements));
            }
            if (operation !== 'query') return json(res, 404, { error: 'Unknown D1 operation' });
            const query = requireString(body.query, 'query');
            const bindings = body.bindings === undefined ? [] : requireArray(body.bindings, 'bindings');
            const statement = database.prepare(query).bind(...bindings);
            if (body.method === 'first') {
                if (body.column !== undefined && typeof body.column !== 'string') throw badRequest('column must be a string');
                return json(res, 200, body.column === undefined ? await statement.first() : await statement.first(body.column));
            }
            if (body.method === 'run') return json(res, 200, await statement.run());
            if (body.method === 'raw') {
                const options = requireObject(body.options, 'options');
                return json(res, 200, await statement.raw(options));
            }
            if (body.method !== undefined && body.method !== 'all') throw badRequest('method must be first, run, raw, or all');
            return json(res, 200, await statement.all());
        });
    }

    async handleR2(req, res, resourceId, operation, limit) {
        if (operation === 'put') {
            const key = requireString(Buffer.from(req.headers['x-ccfwp-key'] || '', 'base64').toString('utf8'), 'key');
            const options = req.headers['x-ccfwp-options']
                ? requireObject(decodeOptionsHeader(req.headers['x-ccfwp-options']), 'options')
                : {};
            const body = await readBody(req, limit);
            return this.resources.withResource('r2', resourceId, async bucket =>
                json(res, 200, r2Metadata(await bucket.put(key, body, options))));
        }
        if (operation === 'upload-part') {
            const key = requireString(Buffer.from(req.headers['x-ccfwp-key'] || '', 'base64').toString('utf8'), 'key');
            const uploadId = requireString(Buffer.from(req.headers['x-ccfwp-upload-id'] || '', 'base64').toString('utf8'), 'uploadId');
            const partNumber = Number(req.headers['x-ccfwp-part-number']);
            if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
                return json(res, 400, { error: 'Invalid multipart upload part' });
            }
            const body = await readBody(req, limit);
            return this.resources.withResource('r2', resourceId, async bucket => {
                const upload = bucket.resumeMultipartUpload(key, uploadId);
                return json(res, 200, await upload.uploadPart(partNumber, body));
            });
        }
        const body = await readJson(req, limit);
        return this.resources.withResource('r2', resourceId, async bucket => {
            if (operation === 'create-multipart') {
                const key = requireString(body.key, 'key');
                const options = requireObject(body.options, 'options');
                const upload = await bucket.createMultipartUpload(key, options);
                return json(res, 200, { key: upload.key, uploadId: upload.uploadId });
            }
            if (operation === 'abort-multipart') {
                const key = requireString(body.key, 'key');
                const uploadId = requireString(body.uploadId, 'uploadId');
                await bucket.resumeMultipartUpload(key, uploadId).abort();
                return json(res, 200, { success: true });
            }
            if (operation === 'complete-multipart') {
                const key = requireString(body.key, 'key');
                const uploadId = requireString(body.uploadId, 'uploadId');
                const uploadedParts = requireArray(body.uploadedParts, 'uploadedParts');
                const upload = bucket.resumeMultipartUpload(key, uploadId);
                return json(res, 200, r2Metadata(await upload.complete(uploadedParts)));
            }
            if (operation === 'head') return json(res, 200, r2Metadata(await bucket.head(requireString(body.key, 'key'))));
            if (operation === 'delete') {
                const keys = body.keys !== undefined
                    ? requireArray(body.keys, 'keys').map((key, index) => requireString(key, `keys[${index}]`))
                    : [requireString(body.key, 'key')];
                await bucket.delete(keys);
                return json(res, 200, { success: true });
            }
            if (operation === 'list') {
                const listing = await bucket.list(requireObject(body.options, 'options'));
                return json(res, 200, { ...listing, objects: listing.objects.map(r2Metadata) });
            }
            if (operation === 'get') {
                const key = requireString(body.key, 'key');
                const options = requireObject(body.options, 'options');
                const object = await bucket.get(key, options);
                if (!object) return json(res, 200, null);
                const metadata = Buffer.from(JSON.stringify(encode(r2Metadata(object)))).toString('base64url');
                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': object.range?.length ?? object.size,
                    'X-CCFWP-R2-Metadata': metadata,
                    'Cache-Control': 'no-store'
                });
                const stream = Readable.fromWeb(object.body);
                stream.pipe(res);
                await finished(stream);
                return;
            }
            return json(res, 404, { error: 'Unknown R2 operation' });
        });
    }
}

const gateway = new ResourceGatewayServer();

module.exports = gateway;
module.exports.ResourceGatewayServer = ResourceGatewayServer;
module.exports.readBody = readBody;
