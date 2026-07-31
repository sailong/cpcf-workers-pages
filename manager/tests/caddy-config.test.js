'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

function environment(file) {
    return Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            const separator = line.indexOf('=');
            return [line.slice(0, separator), line.slice(separator + 1)];
        }));
}

test('Caddy configuration uses explicit console and wildcard DNS-01 sites', () => {
    const caddyfile = fs.readFileSync(path.join(root, 'Caddyfile'), 'utf8');
    assert.match(caddyfile, /\{\$CONSOLE_HOST\}\s*\{/);
    assert.match(caddyfile, /\*\.\{\$PROJECTS_BASE_DOMAIN\}\s*\{/);
    assert.equal((caddyfile.match(/dns cloudflare \{\$CLOUDFLARE_API_TOKEN\}/g) || []).length, 2);
    assert.match(caddyfile, /acme_ca \{\$ACME_CA\}/);
    assert.match(caddyfile, /header_up X-CCFWP-Ingress-Token \{\$INGRESS_PROXY_TOKEN\}/);
    assert.doesNotMatch(caddyfile, /on_demand|ask\s+/i);
});

test('ACME staging fixture cannot consume production certificates', () => {
    const fixture = environment(path.join(root, '.env.acme-staging.example'));
    assert.equal(fixture.ACME_CA, 'https://acme-staging-v02.api.letsencrypt.org/directory');
    assert.equal(fixture.CONSOLE_HOST, 'console.example.com');
    assert.equal(fixture.PROJECTS_BASE_DOMAIN, 'apps.example.com');
    assert.match(fixture.CLOUDFLARE_API_TOKEN, /staging/);
    assert.ok(fixture.INGRESS_PROXY_TOKEN.length >= 32);
});
