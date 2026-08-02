'use strict';

const http = require('node:http');

class DockerEngineError extends Error {
    constructor(message, statusCode, body) {
        super(message);
        this.name = 'DockerEngineError';
        this.statusCode = statusCode;
        this.body = body;
    }
}

class DockerEngineClient {
    constructor(options = {}) {
        this.socketPath = options.socketPath || process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
        this.apiVersion = options.apiVersion || process.env.DOCKER_API_VERSION || 'v1.41';
    }

    request(method, endpoint, options = {}) {
        const expected = options.expected || [200, 201, 204];
        const payload = options.body === undefined ? null : Buffer.from(JSON.stringify(options.body));
        const apiPath = endpoint === '/_ping' ? endpoint : `/${this.apiVersion}${endpoint}`;

        return new Promise((resolve, reject) => {
            const request = http.request({
                socketPath: this.socketPath,
                method,
                path: apiPath,
                headers: payload ? {
                    'Content-Type': 'application/json',
                    'Content-Length': payload.length
                } : undefined
            }, response => {
                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', () => {
                    const raw = Buffer.concat(chunks);
                    const text = raw.toString('utf8');
                    if (!expected.includes(response.statusCode)) {
                        let details = text;
                        try { details = JSON.parse(text).message || text; } catch { }
                        reject(new DockerEngineError(
                            `Docker Engine ${method} ${endpoint} failed (${response.statusCode}): ${details}`,
                            response.statusCode,
                            text
                        ));
                        return;
                    }
                    if (options.raw) return resolve(raw);
                    if (!text) return resolve(null);
                    try { resolve(JSON.parse(text)); } catch { resolve(text); }
                });
            });
            request.once('error', error => reject(new DockerEngineError(
                `Cannot connect to Docker Engine at ${this.socketPath}: ${error.message}`,
                0,
                null
            )));
            if (payload) request.write(payload);
            request.end();
        });
    }

    ping() {
        return this.request('GET', '/_ping', { expected: [200] });
    }

    version() {
        return this.request('GET', '/version', { expected: [200] });
    }

    info() {
        return this.request('GET', '/info', { expected: [200] });
    }

    inspectImage(image) {
        return this.request('GET', `/images/${encodeURIComponent(image)}/json`, { expected: [200] });
    }

    createNetwork(configuration) {
        return this.request('POST', '/networks/create', { body: configuration, expected: [201] });
    }

    inspectNetwork(idOrName) {
        return this.request('GET', `/networks/${encodeURIComponent(idOrName)}`, { expected: [200] });
    }

    connectNetwork(idOrName, container, aliases = [], options = {}) {
        const endpointConfiguration = { Aliases: aliases };
        if (Number.isInteger(options.gatewayPriority)) {
            endpointConfiguration.GwPriority = options.gatewayPriority;
        }
        return this.request('POST', `/networks/${encodeURIComponent(idOrName)}/connect`, {
            body: { Container: container, EndpointConfig: endpointConfiguration },
            expected: [200]
        });
    }

    disconnectNetwork(idOrName, container) {
        return this.request('POST', `/networks/${encodeURIComponent(idOrName)}/disconnect`, {
            body: { Container: container, Force: true },
            expected: [200]
        });
    }

    removeNetwork(idOrName) {
        return this.request('DELETE', `/networks/${encodeURIComponent(idOrName)}`, { expected: [204] });
    }

    createContainer(name, configuration) {
        return this.request('POST', `/containers/create?name=${encodeURIComponent(name)}`, {
            body: configuration,
            expected: [201]
        });
    }

    inspectContainer(idOrName) {
        return this.request('GET', `/containers/${encodeURIComponent(idOrName)}/json`, { expected: [200] });
    }

    startContainer(idOrName) {
        return this.request('POST', `/containers/${encodeURIComponent(idOrName)}/start`, { expected: [204] });
    }

    restartContainer(idOrName, timeoutSeconds = 10) {
        return this.request('POST', `/containers/${encodeURIComponent(idOrName)}/restart?t=${timeoutSeconds}`, { expected: [204] });
    }

    stopContainer(idOrName, timeoutSeconds = 3) {
        return this.request('POST', `/containers/${encodeURIComponent(idOrName)}/stop?t=${timeoutSeconds}`, {
            expected: [204, 304]
        });
    }

    removeContainer(idOrName) {
        return this.request('DELETE', `/containers/${encodeURIComponent(idOrName)}?force=1&v=1`, {
            expected: [204]
        });
    }

    containerLogs(idOrName, options = {}) {
        const tail = Math.max(1, Math.min(Number.parseInt(options.tail, 10) || 200, 2000));
        return this.request('GET', `/containers/${encodeURIComponent(idOrName)}/logs?stdout=1&stderr=1&tail=${tail}`, {
            expected: [200],
            raw: true
        });
    }

    containerStats(idOrName) {
        return this.request('GET', `/containers/${encodeURIComponent(idOrName)}/stats?stream=false`, { expected: [200] });
    }
}

module.exports = { DockerEngineClient, DockerEngineError };
