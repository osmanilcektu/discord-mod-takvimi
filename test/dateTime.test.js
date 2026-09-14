const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseClock,
    parseTimeRange,
    isMinuteInRange,
    addDaysToDateString,
    isValidDateString
} = require('../src/utils/dateTime');

test('parseClock 24:00 değerini gün sonu olarak kabul eder', () => {
    assert.equal(parseClock('24:00'), 1440);
    assert.equal(parseClock('24:01'), null);
    assert.equal(parseClock('08:30'), 510);
});

test('gece yarısını geçen vardiya doğru ayrıştırılır', () => {
    const range = parseTimeRange('20:00-00:00');
    assert.deepEqual(range, { start: 1200, end: 1440, startText: '20:00', endText: '00:00' });
    assert.equal(isMinuteInRange(23 * 60, range), true);
    assert.equal(isMinuteInRange(19 * 60, range), false);
});

test('tarih ekleme ay/yıl geçişlerinde doğru çalışır', () => {
    assert.equal(addDaysToDateString('2026-12-31', 1), '2027-01-01');
    assert.equal(addDaysToDateString('2026-03-01', -1), '2026-02-28');
});

test('tarih doğrulaması gerçek takvim günlerini kontrol eder', () => {
    assert.equal(isValidDateString('2026-09-14'), true);
    assert.equal(isValidDateString('2026-02-30'), false);
    assert.equal(isValidDateString('14-09-2026'), false);
});
