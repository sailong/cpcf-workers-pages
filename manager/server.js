require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const app = express();
const MANAGER_SERVICE_PORT = process.env.MANAGER_SERVICE_PORT || 3000;

// Ensure directories exist
[config.DATA_DIR, config.UPLOADS_DIR, config.TEMP_BUILD_DIR, config.D1_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
// Reverse Proxy (Must be first to handle domain routing)
app.use(require('./middleware/proxy'));

// Static Files
app.use(express.static(path.join(__dirname, 'client/dist')));

// Standard Middleware
app.use(cors());
app.use(bodyParser.json());

// Auth Check (Applies to /api routes, with whitelist)
app.use(require('./middleware/auth'));

// Services (Auto-start projects and R2 Admin)
const runtimeService = require('./services/runtime-service');
runtimeService.startAll();

// API Routes
app.use('/api', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/build', require('./routes/build'));
app.use('/api/upload', require('./routes/upload'));

// Resource Routes
app.use('/api/resources/kv', require('./routes/resources-kv'));
app.use('/api/resources/d1', require('./routes/resources-d1'));
app.use('/api/resources/r2', require('./routes/resources-r2'));

// File Management (Mounted to match /api/projects/:id/files)
app.use('/api/projects', require('./routes/files'));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Global Error]', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// SPA Fallback (Must be after API routes)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

app.listen(MANAGER_SERVICE_PORT, () => {
    console.log(`=============================================`);
    console.log(`   CCFWP Manager Service Running             `);
    console.log(`   Port: ${MANAGER_SERVICE_PORT}             `);
    console.log(`   Domain: ${process.env.ROOT_DOMAIN || 'localhost'}`);
    console.log(`=============================================`);
});
