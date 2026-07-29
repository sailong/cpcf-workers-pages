'use strict';

const SESSION_COOKIE = '__Host-ccfwp_session';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

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
    return parseCookies(req.headers.cookie)[SESSION_COOKIE] || null;
}

function setSessionCookie(res, token) {
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS * 1000
    });
}

function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/'
    });
}

module.exports = {
    SESSION_COOKIE,
    SESSION_MAX_AGE_SECONDS,
    clearSessionCookie,
    getSessionToken,
    parseCookies,
    setSessionCookie
};
