const fs = require('fs');
const config = require('../config');

let resources = { kv: [], d1: [], r2: [] };

function load() {
    if (fs.existsSync(config.RESOURCES_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(config.RESOURCES_FILE, 'utf8'));
            resources = { ...resources, ...loaded };
        } catch (e) {
            console.error("Failed to load resources", e);
        }
    }
    // Ensure structure
    if (!resources.r2) resources.r2 = [];
    if (!resources.kv) resources.kv = [];
    if (!resources.d1) resources.d1 = [];
}

function save() {
    fs.writeFileSync(config.RESOURCES_FILE, JSON.stringify(resources, null, 2));
}

// Initial load
load();

module.exports = {
    getAll: () => resources,
    getKV: () => resources.kv,
    getD1: () => resources.d1,
    getR2: () => resources.r2,
    save
};
