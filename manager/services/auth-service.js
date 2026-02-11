const fs = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, '../../.platform-data/auth.json');

let runtimePassword = process.env.AUTH_PASSWORD || 'admin';
let JWT_SECRET = process.env.JWT_SECRET || null;

function load() {
    if (fs.existsSync(AUTH_FILE)) {
        try {
            const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
            if (authData.password) runtimePassword = authData.password;
            if (authData.jwtSecret) JWT_SECRET = authData.jwtSecret;
        } catch (e) { console.error("Failed to load auth file", e); }
    }

    if (!JWT_SECRET) {
        JWT_SECRET = 'jwt-secret-' + Math.random().toString(36).substring(2) + Date.now();
        save();
        console.log('Generated and persisted new JWT_SECRET');
    }
}

function save() {
    const authData = fs.existsSync(AUTH_FILE)
        ? JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
        : {};
    authData.password = runtimePassword;
    authData.jwtSecret = JWT_SECRET;
    // create dir if not exists (though server should handle it, better safe)
    const dir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
}

// Initial load
load();

module.exports = {
    getPassword: () => runtimePassword,
    setPassword: (pwd) => {
        runtimePassword = pwd;
        save();
    },
    getJwtSecret: () => JWT_SECRET
};
