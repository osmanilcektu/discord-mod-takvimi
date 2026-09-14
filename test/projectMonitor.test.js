const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVersions, formatBytes, formatUptime } = require('../src/utils/versionUtils');

test('sürüm karşılaştırması v önekini ve patch farkını işler', () => {
    assert.equal(compareVersions('v2.2.1', '2.2.0'), 1);
    assert.equal(compareVersions('2.1.0', 'v2.1.0'), 0);
    assert.equal(compareVersions('2.0.9', '2.1.0'), -1);
});

test('byte formatı okunabilir değer üretir', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1024), '1.00 KB');
});

test('uptime formatı gün saat dakika üretir', () => {
    assert.equal(formatUptime(90061), '1g 1s 1dk');
});
