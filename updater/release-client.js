'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { SEMVER, normalizeVersion } = require('../manager/services/application-version-service');

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function compareVersions(left, right) {
    const parse = value => {
        const [, major, minor, patch] = normalizeVersion(value).match(/^v(\d+)\.(\d+)\.(\d+)$/);
        return { major: Number(major), minor: Number(minor), patch: Number(patch) };
    };
    const a = parse(left); const b = parse(right);
    for (const key of ['major', 'minor', 'patch']) if (a[key] !== b[key]) return a[key] - b[key];
    return 0;
}

function repositoryFromEnvironment(environment = process.env) {
    const repository = String(environment.CCFWP_GITHUB_REPOSITORY || '').trim();
    if (!REPOSITORY_PATTERN.test(repository)) throw new Error('CCFWP_GITHUB_REPOSITORY must be owner/name');
    return repository;
}

function signerIdentityForRelease(repository, version) {
    return `https://github.com/${repository}/.github/workflows/app-release.yml@refs/tags/${normalizeVersion(version)}`;
}

function architecture(platform = process.arch) {
    if (platform === 'x64') return 'amd64';
    if (platform === 'arm64') return 'arm64';
    throw new Error(`Unsupported release architecture: ${platform}`);
}

async function getJson(url) {
    const response = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'ccfwp-updater' } });
    const body = await response.text();
    let payload;
    try { payload = body ? JSON.parse(body) : {}; } catch { payload = { message: body }; }
    if (!response.ok) throw new Error(payload.message || `GitHub request failed (${response.status})`);
    return payload;
}

async function getRelease(version, environment = process.env) {
    const tag = normalizeVersion(version);
    const repository = repositoryFromEnvironment(environment);
    const release = await getJson(`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`);
    if (release.draft || release.prerelease) throw new Error(`Release ${tag} must be a published stable release`);
    return release;
}

async function findRelease(version, environment = process.env) {
    if (version) return getRelease(version, environment);
    const repository = repositoryFromEnvironment(environment);
    const releases = await getJson(`https://api.github.com/repos/${repository}/releases?per_page=100`);
    const candidates = releases.filter(release => !release.draft && !release.prerelease && SEMVER.test(release.tag_name));
    if (!candidates.length) throw new Error('No signed SemVer release was found');
    candidates.sort((left, right) => compareVersions(right.tag_name, left.tag_name));
    return candidates[0];
}

async function download(url, target, maxBytes) {
    const response = await fetch(url, { headers: { 'user-agent': 'ccfwp-updater' } });
    if (!response.ok) throw new Error(`Failed to download release asset (${response.status})`);
    if (!response.body) throw new Error('Release asset response has no body');
    const declaredSize = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) throw new Error(`Release asset exceeds the ${maxBytes} byte limit`);
    let downloaded = 0;
    const limiter = new Transform({
        transform(chunk, encoding, callback) {
            downloaded += chunk.length;
            if (downloaded > maxBytes) callback(new Error(`Release asset exceeds the ${maxBytes} byte limit`));
            else callback(null, chunk);
        }
    });
    try {
        await pipeline(Readable.fromWeb(response.body), limiter, fs.createWriteStream(target, { flags: 'wx', mode: 0o600 }));
        return downloaded;
    } catch (error) {
        await fs.promises.rm(target, { force: true });
        throw error;
    }
}

function asset(release, name) {
    const found = release.assets?.find(item => item.name === name);
    if (!found) throw new Error(`Release ${release.tag_name} is missing asset ${name}`);
    return found;
}

async function verifyCosign(manifestPath, signaturePath, version, environment = process.env) {
    const issuer = String(environment.CCFWP_RELEASE_SIGNER_ISSUER || 'https://token.actions.githubusercontent.com').trim();
    const repository = repositoryFromEnvironment(environment);
    const identity = signerIdentityForRelease(repository, version);
    await execFileAsync('cosign', [
        'verify-blob',
        '--certificate-identity', identity,
        '--certificate-oidc-issuer', issuer,
        '--bundle', signaturePath,
        manifestPath
    ], { maxBuffer: 1024 * 1024 });
}

function verifyDigest(file, expected) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== String(expected).toLowerCase()) throw new Error(`Release checksum mismatch for ${path.basename(file)}`);
    return actual;
}

async function downloadAndVerify(version, destination, options = {}) {
    const environment = options.environment || process.env;
    const release = await findRelease(version, environment);
    const tag = normalizeVersion(release.tag_name);
    const arch = architecture(options.architecture || process.arch);
    const bundleName = `ccfwp-app-${tag}-linux-${arch}.tar.zst`;
    const manifestAsset = asset(release, 'manifest.json');
    const signatureAsset = asset(release, 'manifest.sig');
    const checksumsAsset = asset(release, 'checksums.txt');
    const bundleAsset = asset(release, bundleName);
    await fs.promises.mkdir(destination, { recursive: true, mode: 0o700 });
    const manifestPath = path.join(destination, 'manifest.json');
    const signaturePath = path.join(destination, 'manifest.sig');
    const checksumsPath = path.join(destination, 'checksums.txt');
    const bundlePath = path.join(destination, bundleName);
    const metadataLimit = 2 * 1024 * 1024;
    const maxBundleBytes = Number.parseInt(environment.CCFWP_MAX_RELEASE_BYTES || String(2 * 1024 * 1024 * 1024), 10);
    if (!Number.isSafeInteger(maxBundleBytes) || maxBundleBytes < 1024 * 1024) {
        throw new Error('CCFWP_MAX_RELEASE_BYTES must be an integer of at least 1048576');
    }
    await Promise.all([
        download(manifestAsset.browser_download_url, manifestPath, metadataLimit),
        download(signatureAsset.browser_download_url, signaturePath, metadataLimit)
    ]);
    await verifyCosign(manifestPath, signaturePath, tag, environment);
    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
    if (manifest.schemaVersion !== 1 || manifest.version !== tag || !SEMVER.test(manifest.version)) {
        throw new Error('Signed release manifest version does not match the requested tag');
    }
    if (!/^[a-f0-9]{40}$/i.test(manifest.gitSha || '')) throw new Error('Signed release manifest is missing a full Git commit SHA');
    const bundle = manifest.bundles?.[`linux-${arch}`];
    if (!bundle || bundle.asset !== bundleName) throw new Error('Signed release manifest does not contain the selected architecture bundle');
    if (!Number.isSafeInteger(bundle.size) || bundle.size <= 0 || bundle.size > maxBundleBytes) {
        throw new Error('Signed release bundle size is invalid or exceeds the configured limit');
    }
    if (Number(bundleAsset.size) !== bundle.size) throw new Error('GitHub release asset size does not match the signed manifest');
    await Promise.all([
        download(checksumsAsset.browser_download_url, checksumsPath, metadataLimit),
        download(bundleAsset.browser_download_url, bundlePath, maxBundleBytes)
    ]);
    if (fs.statSync(bundlePath).size !== bundle.size) throw new Error('Downloaded release bundle size does not match the signed manifest');
    verifyDigest(bundlePath, bundle.sha256);
    const checksumLine = (await fs.promises.readFile(checksumsPath, 'utf8')).split('\n').find(line => line.endsWith(`  ${bundleName}`));
    if (!checksumLine || checksumLine.split(/\s+/)[0] !== bundle.sha256) throw new Error('Release checksums.txt does not match the signed manifest');
    return { release, tag, arch, bundlePath, manifest };
}

module.exports = {
    architecture,
    compareVersions,
    downloadAndVerify,
    findRelease,
    normalizeVersion,
    signerIdentityForRelease,
    verifyCosign
};
