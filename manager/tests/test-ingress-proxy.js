'use strict';

const http = require('node:http');

const listenPort = Number.parseInt(process.env.TEST_INGRESS_PORT || '8001', 10);
const targetHost = process.env.TEST_INGRESS_TARGET_HOST || 'ccfwp-test';
const targetPort = Number.parseInt(process.env.TEST_INGRESS_TARGET_PORT || '8001', 10);

const server = http.createServer((request, response) => {
    const upstream = http.request({
        hostname: targetHost,
        port: targetPort,
        method: request.method,
        path: request.url,
        headers: request.headers
    }, upstreamResponse => {
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
    });

    upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' });
        response.end('Bad Gateway');
    });
    request.on('aborted', () => upstream.destroy());
    request.pipe(upstream);
});

server.listen(listenPort, '0.0.0.0');

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(() => process.exit(0)));
}
