'use strict';

const SESSION_COOKIE = '__Host-ccfwp_session';
const DEVELOPMENT_SESSION_COOKIE = 'ccfwp_session';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

function cookieName(secure) {
    return secure ? SESSION_COOKIE : DEVELOPMENT_SESSION_COOKIE;
}

function resolveSecure(options = {}) {
    if (typeof options.secure === 'boolean') return options.secure;
    return process.env.NODE_ENV === 'production';
}

function parseCookies(header = '') {
    const cookies = {};
    for (const pair of header.split(';')) {
        const separator = pair.indexOf('=');
        if (separator <= 0) continue;
        const key = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        try {
            cookies[key] = decodeURIComponent(value);
        } catch {
            continue;
        }
    }
    return cookies;
}

function getSessionToken(req) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[SESSION_COOKIE] || cookies[DEVELOPMENT_SESSION_COOKIE] || null;
}

function setSessionCookie(res, token, options = {}) {
    const secure = resolveSecure(options);
    res.cookie(cookieName(secure), token, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS * 1000
    });
}

function clearSessionCookie(res, options = {}) {
    const secure = resolveSecure(options);
    const attributes = {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: '/'
    };
    res.clearCookie(SESSION_COOKIE, attributes);
    res.clearCookie(DEVELOPMENT_SESSION_COOKIE, { ...attributes, secure: false });
}

module.exports = {
    SESSION_COOKIE,
    DEVELOPMENT_SESSION_COOKIE,
    SESSION_MAX_AGE_SECONDS,
    clearSessionCookie,
    getSessionToken,
    parseCookies,
    setSessionCookie
};
