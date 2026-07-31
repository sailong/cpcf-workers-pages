'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const multer = require('multer');
const {
    handleUploadError,
    resolveUploadLimitMb
} = require('../middleware/upload');

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

test('pre-creation upload limits are validated and project limits take precedence', () => {
    assert.equal(resolveUploadLimitMb({ requestedUploadMb: '7' }), 7);
    assert.equal(resolveUploadLimitMb({
        projectId: 'worker-one',
        project: { limits: { uploadMb: 3 } },
        requestedUploadMb: '100'
    }), 3);
    assert.throws(
        () => resolveUploadLimitMb({ requestedUploadMb: '2048' }),
        /uploadMb must be between/
    );
    assert.throws(
        () => resolveUploadLimitMb({ projectId: 'missing', project: null }),
        error => error.statusCode === 404
    );
});

test('file-size violations return 413 with the selected upload limit', () => {
    const error = new multer.MulterError('LIMIT_FILE_SIZE');
    const res = response();
    handleUploadError(error, { uploadMaxFileSize: 3 * 1024 * 1024 }, res, () => {
        throw new Error('unexpected next');
    });

    assert.equal(res.statusCode, 413);
    assert.match(res.body.error, /3MB/);
});
