const fs = require('fs');
const path = require('path');

const KV_DATA_DIR = path.join(__dirname, '../../.platform-data/kv-data');

// Ensure KV data directory exists
if (!fs.existsSync(KV_DATA_DIR)) {
    fs.mkdirSync(KV_DATA_DIR, { recursive: true });
}

/**
 * Get KV data file path
 */
function getKVFilePath(namespaceId) {
    return path.join(KV_DATA_DIR, `${namespaceId}.json`);
}

/**
 * Load KV data for a namespace
 */
function loadKVData(namespaceId) {
    const filePath = getKVFilePath(namespaceId);
    if (!fs.existsSync(filePath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`Failed to load KV data for ${namespaceId}:`, e);
        return {};
    }
}

/**
 * Save KV data for a namespace
 */
function saveKVData(namespaceId, data) {
    const filePath = getKVFilePath(namespaceId);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * List all keys in a namespace
 */
function listKeys(namespaceId, prefix = '', limit = 1000) {
    const data = loadKVData(namespaceId);
    let keys = Object.keys(data);

    if (prefix) {
        keys = keys.filter(k => k.startsWith(prefix));
    }

    return keys.slice(0, limit).map(key => ({
        name: key,
        expiration: null,
        metadata: null
    }));
}

/**
 * Get value for a key
 */
function getValue(namespaceId, key) {
    const data = loadKVData(namespaceId);
    return data[key];
}

/**
 * Set value for a key
 */
function setValue(namespaceId, key, value) {
    const data = loadKVData(namespaceId);
    data[key] = value;
    saveKVData(namespaceId, data);
}

/**
 * Delete a key
 */
function deleteKey(namespaceId, key) {
    const data = loadKVData(namespaceId);
    delete data[key];
    saveKVData(namespaceId, data);
}

/**
 * Delete entire namespace data
 */
function deleteNamespace(namespaceId) {
    const filePath = getKVFilePath(namespaceId);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

module.exports = {
    listKeys,
    getValue,
    setValue,
    deleteKey,
    deleteNamespace
};
