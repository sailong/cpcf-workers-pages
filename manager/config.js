const path = require('path');
const DATA_DIR = path.join(__dirname, '../.platform-data');

module.exports = {
    DATA_DIR,
    UPLOADS_DIR: path.join(DATA_DIR, 'uploads'),
    TEMP_BUILD_DIR: path.join(DATA_DIR, 'temp_builds'),
    D1_DIR: path.join(DATA_DIR, 'd1-databases'),
    PROJECTS_FILE: path.join(DATA_DIR, 'projects.json'),
    RESOURCES_FILE: path.join(DATA_DIR, 'resources.json'),
    AUTH_FILE: path.join(DATA_DIR, 'auth.json'),
};
