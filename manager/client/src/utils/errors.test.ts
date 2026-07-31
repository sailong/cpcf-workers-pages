import { describe, expect, it } from 'vitest';
import axios, { AxiosError } from 'axios';
import { getErrorMessage, hasHttpStatus } from './errors';

function httpError(status: number, message = 'request failed') {
    const error = new AxiosError(message);
    error.response = { status, statusText: '', headers: {}, config: {} as never, data: { error: message } };
    return error;
}

describe('HTTP error presentation', () => {
    it('adds actionable hints for resource-management status codes', () => {
        expect(getErrorMessage(httpError(400, 'invalid key'), 'fallback')).toContain('(HTTP 400)');
        expect(getErrorMessage(httpError(403, 'not bound'), 'fallback')).toContain('(HTTP 403)');
        expect(getErrorMessage(httpError(409, 'reserved'), 'fallback')).toContain('(HTTP 409)');
    });

    it('preserves generic errors and exposes status checks', () => {
        const error = httpError(503, 'temporarily unavailable');
        expect(getErrorMessage(error, 'fallback')).toBe('temporarily unavailable');
        expect(hasHttpStatus(error, 503)).toBe(true);
        expect(hasHttpStatus(error, 400)).toBe(false);
        expect(getErrorMessage(new Error('local failure'), 'fallback')).toBe('local failure');
        expect(getErrorMessage(null, 'fallback')).toBe('fallback');
        expect(axios.isAxiosError(error)).toBe(true);
    });
});
