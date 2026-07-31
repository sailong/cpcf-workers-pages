'use strict';

function createAbortError(message = 'Build cancelled') {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}

function throwIfAborted(signal, message) {
    if (signal?.aborted) throw createAbortError(message);
}

function abortableDelay(ms, signal) {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        const timer = setTimeout(done, ms);
        const onAbort = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            reject(createAbortError());
        };
        function done() {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

module.exports = { abortableDelay, createAbortError, throwIfAborted };
