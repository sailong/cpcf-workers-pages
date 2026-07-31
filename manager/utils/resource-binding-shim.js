'use strict';

function createResourceBindingShim(project, options) {
    const bindings = {};
    for (const kind of ['kv', 'd1', 'r2']) {
        for (const binding of project.bindings?.[kind] || []) {
            bindings[binding.varName] = { kind, resourceId: binding.resourceId };
        }
    }
    const entry = JSON.stringify(options.entry);
    const settings = JSON.stringify({
        gatewayUrl: options.gatewayUrl,
        projectId: project.id,
        token: options.token,
        bindings
    });

    return `import userWorker from ${entry};
export * from ${entry};

const SETTINGS = ${settings};
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

async function bodyToArrayBuffer(value) {
    if (value instanceof ReadableStream) return new Response(value).arrayBuffer();
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value.arrayBuffer();
    return value;
}

function encode(value) {
    if (value instanceof ArrayBuffer) return { $type: 'bytes', data: bytesToBase64(new Uint8Array(value)) };
    if (ArrayBuffer.isView(value)) return { $type: 'bytes', data: bytesToBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
    if (value instanceof Date) return { $type: 'date', value: value.toISOString() };
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    return value;
}

function decode(value) {
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === 'object') {
        if (value.$type === 'bytes') {
            const bytes = base64ToBytes(value.data);
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        }
        if (value.$type === 'date') return new Date(value.value);
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
    }
    return value;
}

async function request(binding, operation, body = {}) {
    const url = SETTINGS.gatewayUrl + '/v1/' + encodeURIComponent(SETTINGS.projectId) + '/' + binding.kind + '/' + encodeURIComponent(binding.resourceId) + '/' + operation;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + SETTINGS.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(encode(body))
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || ('Resource gateway returned HTTP ' + response.status));
    return decode(payload);
}

function kvType(options) {
    if (typeof options === 'string') return options;
    return options?.type || 'text';
}

function kvOptions(options) {
    return typeof options === 'object' && options ? { cacheTtl: options.cacheTtl } : {};
}

function decodeKVValue(value, type) {
    if (value === null) return null;
    const bytes = new Uint8Array(value);
    if (type === 'arrayBuffer') return value;
    if (type === 'stream') return new Response(bytes).body;
    const text = decoder.decode(bytes);
    return type === 'json' ? JSON.parse(text) : text;
}

class KVNamespace {
    constructor(binding) { this.binding = binding; }
    async get(key, options) {
        const result = await request(this.binding, 'get', { key, options: kvOptions(options) });
        return result.found ? decodeKVValue(result.value, kvType(options)) : null;
    }
    async getWithMetadata(key, options) {
        const result = await request(this.binding, 'get', { key, options: kvOptions(options) });
        return {
            value: result.found ? decodeKVValue(result.value, kvType(options)) : null,
            metadata: result.metadata ?? null,
            cacheStatus: null
        };
    }
    async put(key, value, options = {}) {
        value = await bodyToArrayBuffer(value);
        return request(this.binding, 'put', { key, value, options });
    }
    async delete(key) { await request(this.binding, 'delete', { key }); }
    list(options = {}) { return request(this.binding, 'list', { options }); }
}

class D1PreparedStatement {
    constructor(database, query, bindings = []) { this.database = database; this.query = query; this.bindings = bindings; }
    bind(...values) { return new D1PreparedStatement(this.database, this.query, values); }
    first(column) { return request(this.database.binding, 'query', { query: this.query, bindings: this.bindings, method: 'first', column }); }
    run() { return request(this.database.binding, 'query', { query: this.query, bindings: this.bindings, method: 'run' }); }
    all() { return request(this.database.binding, 'query', { query: this.query, bindings: this.bindings, method: 'all' }); }
    raw(options = {}) { return request(this.database.binding, 'query', { query: this.query, bindings: this.bindings, method: 'raw', options }); }
}

class D1Database {
    constructor(binding) { this.binding = binding; }
    prepare(query) { return new D1PreparedStatement(this, query); }
    batch(statements) {
        return request(this.binding, 'batch', { statements: statements.map(statement => ({
            query: statement.query, bindings: statement.bindings
        })) });
    }
    exec(query) { return request(this.binding, 'exec', { query }); }
    dump() { return request(this.binding, 'dump'); }
    withSession() {
        const database = this;
        return {
            prepare: query => database.prepare(query),
            batch: statements => database.batch(statements),
            getBookmark: () => null
        };
    }
}

class R2Object {
    constructor(metadata) { Object.assign(this, metadata); }
    writeHttpMetadata(headers) {
        const metadata = this.httpMetadata || {};
        const mapping = {
            contentType: 'content-type', contentLanguage: 'content-language', contentDisposition: 'content-disposition',
            contentEncoding: 'content-encoding', cacheControl: 'cache-control', cacheExpiry: 'expires'
        };
        for (const [key, header] of Object.entries(mapping)) {
            if (metadata[key] !== undefined) headers.set(header, metadata[key] instanceof Date ? metadata[key].toUTCString() : String(metadata[key]));
        }
    }
}

class R2ObjectBody extends R2Object {
    constructor(metadata, body) { super(metadata); this.body = body; }
    get bodyUsed() { return this.body.locked; }
    async arrayBuffer() { return new Response(this.body).arrayBuffer(); }
    async text() { return new Response(this.body).text(); }
    async json() { return JSON.parse(await this.text()); }
    async blob() { return new Response(this.body, { headers: { 'Content-Type': this.httpMetadata?.contentType || '' } }).blob(); }
}

function r2BodyBytes(value) {
    if (typeof value === 'string') return encoder.encode(value);
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return encoder.encode(String(value));
}

class R2MultipartUpload {
    constructor(binding, key, uploadId) {
        this.binding = binding;
        this.key = key;
        this.uploadId = uploadId;
    }
    async uploadPart(partNumber, value) {
        value = await bodyToArrayBuffer(value);
        const response = await fetch(SETTINGS.gatewayUrl + '/v1/' + encodeURIComponent(SETTINGS.projectId) + '/r2/' + encodeURIComponent(this.binding.resourceId) + '/upload-part', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + SETTINGS.token,
                'Content-Type': 'application/octet-stream',
                'X-CCFWP-Key': bytesToBase64(encoder.encode(this.key)),
                'X-CCFWP-Upload-Id': bytesToBase64(encoder.encode(this.uploadId)),
                'X-CCFWP-Part-Number': String(partNumber)
            },
            body: r2BodyBytes(value)
        });
        const payload = decode(await response.json());
        if (!response.ok) throw new Error(payload.error || ('Resource gateway returned HTTP ' + response.status));
        return payload;
    }
    abort() { return request(this.binding, 'abort-multipart', { key: this.key, uploadId: this.uploadId }); }
    async complete(uploadedParts) {
        const object = await request(this.binding, 'complete-multipart', {
            key: this.key,
            uploadId: this.uploadId,
            uploadedParts
        });
        return new R2Object(object);
    }
}

class R2Bucket {
    constructor(binding) { this.binding = binding; }
    head(key) { return request(this.binding, 'head', { key }).then(value => value && new R2Object(value)); }
    async get(key, options = {}) {
        const url = SETTINGS.gatewayUrl + '/v1/' + encodeURIComponent(SETTINGS.projectId) + '/r2/' + encodeURIComponent(this.binding.resourceId) + '/get';
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + SETTINGS.token, 'Content-Type': 'application/json' },
            body: JSON.stringify(encode({ key, options }))
        });
        if (!response.ok) {
            const payload = decode(await response.json());
            throw new Error(payload.error || ('Resource gateway returned HTTP ' + response.status));
        }
        const encodedMetadata = response.headers.get('x-ccfwp-r2-metadata');
        if (!encodedMetadata) return null;
        const metadata = decode(JSON.parse(decoder.decode(base64ToBytes(encodedMetadata))));
        return new R2ObjectBody(metadata, response.body);
    }
    async put(key, value, options = {}) {
        value = await bodyToArrayBuffer(value);
        const bytes = r2BodyBytes(value);
        const url = SETTINGS.gatewayUrl + '/v1/' + encodeURIComponent(SETTINGS.projectId) + '/r2/' + encodeURIComponent(this.binding.resourceId) + '/put';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + SETTINGS.token,
                'Content-Type': 'application/octet-stream',
                'X-CCFWP-Key': bytesToBase64(encoder.encode(key)),
                'X-CCFWP-Options': bytesToBase64(encoder.encode(JSON.stringify(encode(options))))
            },
            body: bytes
        });
        const payload = decode(await response.json());
        if (!response.ok) throw new Error(payload.error || ('Resource gateway returned HTTP ' + response.status));
        return new R2Object(payload);
    }
    delete(keys) { return request(this.binding, 'delete', { keys }); }
    async list(options = {}) {
        const result = await request(this.binding, 'list', { options });
        return { ...result, objects: result.objects.map(object => new R2Object(object)) };
    }
    async createMultipartUpload(key, options = {}) {
        const upload = await request(this.binding, 'create-multipart', { key, options });
        return new R2MultipartUpload(this.binding, upload.key, upload.uploadId);
    }
    resumeMultipartUpload(key, uploadId) { return new R2MultipartUpload(this.binding, key, uploadId); }
}

const RESOURCE_BINDINGS = Object.fromEntries(Object.entries(SETTINGS.bindings).map(([name, binding]) => [name,
    binding.kind === 'kv' ? new KVNamespace(binding) : binding.kind === 'd1' ? new D1Database(binding) : new R2Bucket(binding)
]));

function withBindings(env) {
    const bound = Object.create(env || null);
    for (const [name, value] of Object.entries(RESOURCE_BINDINGS)) Object.defineProperty(bound, name, { value, enumerable: true });
    return bound;
}

const wrapped = {};
for (const handler of ['fetch', 'scheduled', 'queue', 'email', 'tail', 'trace']) {
    if (typeof userWorker?.[handler] === 'function') {
        wrapped[handler] = (...args) => {
            if (args.length > 1) args[1] = withBindings(args[1]);
            return userWorker[handler](...args);
        };
    }
}

export default wrapped;
`;
}

module.exports = { createResourceBindingShim };
