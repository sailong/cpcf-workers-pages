'use strict';

function errorStatus(error, fallback = 500) {
    const candidate = Number(error?.statusCode ?? error?.status);
    return Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
        ? candidate
        : fallback;
}

module.exports = { errorStatus };
