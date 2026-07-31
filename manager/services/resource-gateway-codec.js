'use strict';

function encode(value) {
    if (value instanceof ArrayBuffer) {
        return { $type: 'bytes', data: Buffer.from(value).toString('base64') };
    }
    if (ArrayBuffer.isView(value)) {
        return { $type: 'bytes', data: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') };
    }
    if (value instanceof Date) return { $type: 'date', value: value.toISOString() };
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    }
    return value;
}

function decode(value) {
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === 'object') {
        if (value.$type === 'bytes' && typeof value.data === 'string') {
            const buffer = Buffer.from(value.data, 'base64');
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
        if (value.$type === 'date' && typeof value.value === 'string') return new Date(value.value);
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
    }
    return value;
}

module.exports = { encode, decode };
