const { parseTimeRange } = require('./dateTime');

const SLOT_EMOJIS = ['🌚', '🌅', '☀️', '🌤️', '🌆'];
const SLOT_LABELS = ['Gece Yarısı', 'Sabah', 'Öğlen', 'Öğleden Sonra', 'Akşam-Gece'];

function buildSlots(timeSlots) {
    return timeSlots.map((range, index) => {
        const parsed = parseTimeRange(range);
        if (!parsed) throw new Error(`Geçersiz vardiya aralığı: ${range}`);
        const id = `slot${index + 1}`;
        const emoji = SLOT_EMOJIS[index] || '🕒';
        const label = SLOT_LABELS[index] || `Vardiya ${index + 1}`;
        return {
            id,
            index,
            range,
            startMinutes: parsed.start,
            endMinutes: parsed.end,
            hours: (parsed.end - parsed.start) / 60,
            emoji,
            label,
            name: `${emoji} Vardiya ${index + 1} - ${label} (${range.replace('24:00', '00:00')})`
        };
    });
}

function getSlotById(timeSlots, slotId) {
    return buildSlots(timeSlots).find(slot => slot.id === slotId) || null;
}

module.exports = { buildSlots, getSlotById };
