'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { getDatabase } = require('./database');
const { normalizeProjectLimits } = require('./project-limits');
const { assertWithinByteLimit, getDirectorySize } = require('../utils/fs-helper');
const { resolveWithin } = require('../utils/path-helper');

const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const RUNTIME_UID = Number(process.env.PROJECT_RUNTIME_UID || 10001);
const RUNTIME_GID = Number(process.env.PROJECT_RUNTIME_GID || 10001);

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function assertRegularTree(root) {
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink()) throw new Error('Release source must not contain symbolic links');
        if (stat.isDirectory()) {
            for (const name of fs.readdirSync(current)) pending.push(path.join(current, name));
        } else if (!stat.isFile()) {
            throw new Error('Release source contains an unsupported file type');
        }
    }
}

function makeRuntimeReadableTree(root) {
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        const stat = fs.lstatSync(current);
        let runtimeOwned = true;
        try {
            fs.chownSync(current, RUNTIME_UID, RUNTIME_GID);
        } catch (error) {
            if (process.platform !== 'win32' && error.code !== 'EPERM') throw error;
            runtimeOwned = false;
        }
        if (stat.isDirectory()) {
            fs.chmodSync(current, runtimeOwned ? 0o750 : 0o755);
            for (const name of fs.readdirSync(current)) pending.push(path.join(current, name));
        } else if (stat.isFile()) {
            fs.chmodSync(current, runtimeOwned ? 0o640 : 0o644);
        } else {
            throw new Error('Release contains an unsupported file type');
        }
    }
}

function hashDirectory(root) {
    const hash = crypto.createHash('sha256');
    const files = [];
    const visit = (directory, prefix = '') => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const absolute = path.join(directory, entry.name);
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isSymbolicLink()) throw new Error('Release must not contain symbolic links');
            if (entry.isDirectory()) visit(absolute, relative);
            else if (entry.isFile()) files.push({ absolute, relative });
            else throw new Error('Release contains an unsupported file type');
        }
    };
    visit(root);
    for (const file of files) {
        hash.update(Buffer.from(`${file.relative}\0`, 'utf8'));
        hash.update(fs.readFileSync(file.absolute));
        hash.update(Buffer.from('\0', 'utf8'));
    }
    return hash.digest('hex');
}

function copyPayload(source, destination) {
    const stat = fs.lstatSync(source);
    assertRegularTree(source);
    if (stat.isDirectory()) {
        fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
        fs.cpSync(source, destination, { recursive: true, force: false, errorOnExist: true });
        return { isDirectory: true, basename: null };
    }
    fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
    const basename = path.basename(source);
    fs.copyFileSync(source, path.join(destination, basename), fs.constants.COPYFILE_EXCL);
    return { isDirectory: false, basename };
}

function isPathWithin(root, target) {
    const relative = path.relative(path.resolve(root), path.resolve(target));
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function hydrate(row, activeReleaseId) {
    return {
        id: row.id,
        projectId: row.project_id,
        checksum: row.checksum,
        entryPath: row.entry_path,
        metadata: JSON.parse(row.payload),
        createdAt: row.created_at,
        activatedAt: row.activated_at,
        active: row.id === activeReleaseId
    };
}

function createReleaseService(options = {}) {
    const db = options.db || getDatabase();
    const dataDir = options.dataDir || config.DATA_DIR;
    const projectsDir = options.projectsDir || path.join(dataDir, 'projects');
    const uploadsDir = options.uploadsDir || config.UPLOADS_DIR;
    const now = options.now || (() => new Date());
    const beforeCommit = options.beforeCommit || (() => {});
    const maxReleases = options.maxReleases ?? config.MAX_RELEASES_PER_PROJECT;
    const maxActivations = options.maxActivations ?? config.MAX_ACTIVATIONS_PER_PROJECT;
    const locks = new Map();
    if (!Number.isInteger(maxReleases) || maxReleases < 2) throw new Error('Release retention must keep at least two versions');
    if (!Number.isInteger(maxActivations) || maxActivations < 1) throw new Error('Activation retention must be a positive integer');

    async function withProjectLock(projectId, operation) {
        const previous = locks.get(projectId) || Promise.resolve();
        let releaseGate;
        const gate = new Promise(resolve => { releaseGate = resolve; });
        const queued = previous.catch(() => {}).then(() => gate);
        locks.set(projectId, queued);
        await previous.catch(() => {});
        try {
            return await operation();
        } finally {
            releaseGate();
            if (locks.get(projectId) === queued) locks.delete(projectId);
        }
    }

    function projectPaths(projectId, releaseId) {
        if (!ID_PATTERN.test(projectId) || !ID_PATTERN.test(releaseId)) throw new Error('Invalid project or release ID');
        const projectRoot = resolveWithin(projectsDir, projectId);
        return {
            projectRoot,
            staging: resolveWithin(projectRoot, path.join('staging', releaseId)),
            final: resolveWithin(projectRoot, path.join('releases', releaseId))
        };
    }

    function getProjectLimits(projectRow) {
        let payload = {};
        try { payload = JSON.parse(projectRow.payload || '{}'); } catch { }
        return normalizeProjectLimits(payload.limits || {});
    }

    function assertReleaseLimits(projectRow, input, locations) {
        const limits = getProjectLimits(projectRow);
        const uploadLimitBytes = limits.uploadMb * 1024 * 1024;
        const artifactBytes = getDirectorySize(input.artifactPath);
        assertWithinByteLimit(
            artifactBytes,
            uploadLimitBytes,
            `Release artifact exceeds upload limit (${limits.uploadMb} MB)`
        );

        // Source snapshots generated by builds may include installed dependencies;
        // only source trees retained under the upload root count as user uploads.
        if (input.sourcePath && input.sourcePath !== input.artifactPath && isPathWithin(uploadsDir, input.sourcePath)) {
            assertWithinByteLimit(
                getDirectorySize(input.sourcePath),
                uploadLimitBytes,
                `Release source exceeds upload limit (${limits.uploadMb} MB)`
            );
        }

        assertWithinByteLimit(
            getDirectorySize(locations.projectRoot),
            limits.diskMb * 1024 * 1024,
            `Project release storage exceeds disk limit (${limits.diskMb} MB)`
        );
    }

    function activateRow(projectId, release, reason) {
        return db.transaction(() => {
            const project = db.prepare('SELECT active_release_id FROM projects WHERE id = ?').get(projectId);
            if (!project) throw new Error('Project not found');
            const activatedAt = now().toISOString();
            db.prepare('UPDATE releases SET activated_at = ? WHERE id = ?').run(activatedAt, release.id);
            db.prepare('UPDATE projects SET active_release_id = ?, main_file = ? WHERE id = ?')
                .run(release.id, release.entry_path, projectId);
            db.prepare('INSERT INTO deployments (id, project_id, status, payload, created_at) VALUES (?, ?, ?, ?, ?)')
                .run(crypto.randomUUID(), projectId, 'activated', JSON.stringify({
                    releaseId: release.id,
                    previousReleaseId: project.active_release_id || null,
                    reason
                }), activatedAt);
            return { previousReleaseId: project.active_release_id || null, activatedAt };
        })();
    }

    function pruneProject(projectId) {
        const project = db.prepare('SELECT active_release_id FROM projects WHERE id = ?').get(projectId);
        if (!project) return { releases: [], activations: [] };
        const latestDeployment = db.prepare("SELECT payload FROM deployments WHERE project_id = ? AND status = 'activated' ORDER BY created_at DESC, rowid DESC LIMIT 1")
            .get(projectId);
        let previousReleaseId = null;
        try { previousReleaseId = JSON.parse(latestDeployment?.payload || '{}').previousReleaseId || null; } catch { }

        const rows = db.prepare('SELECT id FROM releases WHERE project_id = ? ORDER BY created_at DESC, id DESC').all(projectId);
        const retained = new Set([project.active_release_id, previousReleaseId].filter(Boolean));
        for (const row of rows) {
            if (retained.size >= maxReleases) break;
            retained.add(row.id);
        }
        const candidates = rows.filter(row => !retained.has(row.id));
        const removedReleases = [];
        for (const candidate of candidates) {
            const locations = projectPaths(projectId, candidate.id);
            const pruningRoot = resolveWithin(locations.projectRoot, 'pruning');
            const quarantine = resolveWithin(pruningRoot, candidate.id);
            fs.mkdirSync(pruningRoot, { recursive: true, mode: 0o700 });
            fs.rmSync(quarantine, { recursive: true, force: true });
            if (fs.existsSync(locations.final)) fs.renameSync(locations.final, quarantine);
            try {
                db.prepare('DELETE FROM releases WHERE id = ? AND project_id = ? AND id != ?')
                    .run(candidate.id, projectId, project.active_release_id);
                fs.rmSync(quarantine, { recursive: true, force: true });
                removedReleases.push(candidate.id);
            } catch (error) {
                if (fs.existsSync(quarantine) && !fs.existsSync(locations.final)) fs.renameSync(quarantine, locations.final);
                throw error;
            }
        }

        const activationRows = db.prepare("SELECT id FROM deployments WHERE project_id = ? AND status = 'activated' ORDER BY created_at DESC, rowid DESC")
            .all(projectId);
        const removedActivations = activationRows.slice(maxActivations).map(row => row.id);
        const deleteActivation = db.prepare('DELETE FROM deployments WHERE id = ?');
        db.transaction(ids => ids.forEach(id => deleteActivation.run(id)))(removedActivations);
        return { releases: removedReleases, activations: removedActivations };
    }

    function safePrune(projectId) {
        try {
            return pruneProject(projectId);
        } catch (error) {
            console.warn(`[Release] Retention cleanup failed for ${projectId}: ${error.message}`);
            return { releases: [], activations: [] };
        }
    }

    function pruneAll() {
        return db.prepare('SELECT id FROM projects').all().map(row => ({ projectId: row.id, ...safePrune(row.id) }));
    }

    async function create(projectId, input) {
        return withProjectLock(projectId, async () => {
            const project = db.prepare('SELECT id, active_release_id, payload FROM projects WHERE id = ?').get(projectId);
            if (!project) throw new Error('Project not found');
            if (!input || !input.artifactPath) throw new Error('Release artifact is required');

            const releaseId = `release-${crypto.randomUUID()}`;
            const locations = projectPaths(projectId, releaseId);
            fs.mkdirSync(path.dirname(locations.staging), { recursive: true, mode: 0o700 });
            fs.mkdirSync(path.dirname(locations.final), { recursive: true, mode: 0o700 });
            fs.mkdirSync(locations.staging, { recursive: false, mode: 0o700 });

            try {
                if (input.sourcePath) copyPayload(input.sourcePath, path.join(locations.staging, 'source'));
                const artifact = copyPayload(input.artifactPath, path.join(locations.staging, 'artifact'));
                const entryWithinArtifact = input.entryRelativePath || (artifact.isDirectory ? '' : artifact.basename);
                const entryAbsolute = entryWithinArtifact
                    ? resolveWithin(path.join(locations.staging, 'artifact'), entryWithinArtifact)
                    : path.join(locations.staging, 'artifact');
                if (!fs.existsSync(entryAbsolute)) throw new Error('Release entry path does not exist');

                const createdAt = now().toISOString();
                const metadata = { ...(input.metadata || {}), reason: input.reason || 'deploy', createdAt };
                fs.writeFileSync(path.join(locations.staging, 'release.json'), JSON.stringify(metadata, null, 2), { mode: 0o600 });
                makeRuntimeReadableTree(locations.staging);
                assertReleaseLimits(project, input, locations);
                const checksum = hashDirectory(locations.staging);
                fs.renameSync(locations.staging, locations.final);

                const finalEntry = path.join(locations.final, path.relative(locations.staging, entryAbsolute));
                const entryPath = toPosix(path.relative(dataDir, finalEntry));
                const release = { id: releaseId, entry_path: entryPath };
                if (typeof input.beforeActivate === 'function') {
                    await input.beforeActivate({
                        id: releaseId,
                        projectId,
                        checksum,
                        entryPath,
                        metadata,
                        createdAt,
                        activatedAt: null,
                        active: false
                    });
                }
                await beforeCommit({ projectId, releaseId, finalPath: locations.final, checksum });
                const activation = db.transaction(() => {
                    db.prepare('INSERT INTO releases (id, project_id, checksum, entry_path, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                        .run(releaseId, projectId, checksum, entryPath, JSON.stringify(metadata), createdAt);
                    return activateRow(projectId, release, input.reason || 'deploy');
                })();
                const row = db.prepare('SELECT * FROM releases WHERE id = ?').get(releaseId);
                const result = { ...hydrate(row, releaseId), previousReleaseId: activation.previousReleaseId };
                safePrune(projectId);
                return result;
            } catch (error) {
                fs.rmSync(locations.staging, { recursive: true, force: true });
                fs.rmSync(locations.final, { recursive: true, force: true });
                throw error;
            }
        });
    }

    function list(projectId) {
        const project = db.prepare('SELECT active_release_id FROM projects WHERE id = ?').get(projectId);
        if (!project) return null;
        return db.prepare('SELECT * FROM releases WHERE project_id = ? ORDER BY created_at DESC, id DESC')
            .all(projectId).map(row => hydrate(row, project.active_release_id));
    }

    async function activate(projectId, releaseId, reason = 'manual', options = {}) {
        return withProjectLock(projectId, async () => {
            const row = db.prepare('SELECT * FROM releases WHERE id = ? AND project_id = ?').get(releaseId, projectId);
            if (!row) return null;
            const project = db.prepare('SELECT active_release_id FROM projects WHERE id = ?').get(projectId);
            if (project.active_release_id === releaseId) return hydrate(row, releaseId);
            const locations = projectPaths(projectId, releaseId);
            if (!fs.existsSync(locations.final) || hashDirectory(locations.final) !== row.checksum) {
                throw new Error('Release checksum verification failed');
            }
            if (typeof options.beforeActivate === 'function') {
                await options.beforeActivate(hydrate(row, project.active_release_id));
            }
            const activation = activateRow(projectId, row, reason);
            const result = { ...hydrate(db.prepare('SELECT * FROM releases WHERE id = ?').get(releaseId), releaseId), ...activation };
            safePrune(projectId);
            return result;
        });
    }

    async function rollback(projectId, options = {}) {
        const latest = db.prepare("SELECT payload FROM deployments WHERE project_id = ? AND status = 'activated' ORDER BY created_at DESC, rowid DESC LIMIT 1")
            .get(projectId);
        if (!latest) return null;
        const previousReleaseId = JSON.parse(latest.payload).previousReleaseId;
        if (!previousReleaseId) return null;
        return activate(projectId, previousReleaseId, 'rollback', options);
    }

    async function migrateLegacyProjects() {
        const rows = db.prepare('SELECT id, type, main_file FROM projects WHERE active_release_id IS NULL AND main_file IS NOT NULL ORDER BY created_at, id').all();
        const result = { migrated: [], skipped: [] };
        for (const project of rows) {
            let artifactPath;
            try {
                artifactPath = resolveWithin(uploadsDir, project.main_file);
            } catch (error) {
                result.skipped.push({ id: project.id, reason: error.message });
                continue;
            }
            if (!fs.existsSync(artifactPath)) {
                result.skipped.push({ id: project.id, reason: 'Legacy project files are missing' });
                continue;
            }

            const sourceCandidate = fs.lstatSync(artifactPath).isDirectory()
                ? path.join(path.dirname(artifactPath), 'source')
                : artifactPath;
            const sourcePath = fs.existsSync(sourceCandidate) ? sourceCandidate : artifactPath;
            const release = await create(project.id, {
                sourcePath,
                artifactPath,
                reason: 'legacy-migration',
                metadata: { projectType: project.type, migratedFrom: project.main_file }
            });
            const legacyRoot = resolveWithin(uploadsDir, project.main_file.split(/[/\\]/)[0]);
            fs.rmSync(legacyRoot, { recursive: true, force: true });
            result.migrated.push({ id: project.id, releaseId: release.id });
        }
        return result;
    }

    return { activate, create, hashDirectory, list, migrateLegacyProjects, pruneAll, pruneProject, rollback, withProjectLock };
}

let singleton;
function service() {
    if (!singleton) singleton = createReleaseService();
    return singleton;
}

module.exports = {
    createReleaseService,
    create: (...args) => service().create(...args),
    list: (...args) => service().list(...args),
    activate: (...args) => service().activate(...args),
    migrateLegacyProjects: (...args) => service().migrateLegacyProjects(...args),
    pruneAll: (...args) => service().pruneAll(...args),
    rollback: (...args) => service().rollback(...args),
    hashDirectory
};
