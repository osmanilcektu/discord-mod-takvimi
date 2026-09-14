const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSlots, getSlotById } = require('../src/utils/slots');

const ranges = ['00:00-05:00', '05:00-10:00', '10:00-15:00', '15:00-20:00', '20:00-24:00'];

test('5 vardiya deterministik slot kimlikleri üretir', () => {
    const slots = buildSlots(ranges);
    assert.equal(slots.length, 5);
    assert.deepEqual(slots.map(slot => slot.id), ['slot1', 'slot2', 'slot3', 'slot4', 'slot5']);
    assert.equal(slots.reduce((sum, slot) => sum + slot.hours, 0), 24);
});

test('slot kimliği ile doğru vardiya bulunur', () => {
    assert.equal(getSlotById(ranges, 'slot5').range, '20:00-24:00');
    assert.equal(getSlotById(ranges, 'slot9'), null);
});
