const DEFAULT_TIMEZONE = 'Europe/Istanbul';

function getDateParts(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);

    return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function getLocalDateString(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
    const parts = getDateParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function getLocalTimeString(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
    const parts = getDateParts(date, timeZone);
    return `${parts.hour}:${parts.minute}`;
}

function addDaysToDateString(dateString, days) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (!match) {
        throw new Error(`Geçersiz tarih formatı: ${dateString}`);
    }

    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function isValidDateString(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function getMinutesInTimeZone(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
    const parts = getDateParts(date, timeZone);
    return Number(parts.hour) * 60 + Number(parts.minute);
}

function parseClock(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value || '');
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour === 24 && minute === 0) return 24 * 60;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
}

function parseTimeRange(range) {
    const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(range || '');
    if (!match) return null;
    const start = parseClock(match[1]);
    const endRaw = parseClock(match[2]);
    if (start === null || endRaw === null) return null;
    let end = endRaw;
    if (end <= start) end += 24 * 60;
    return { start, end, startText: match[1], endText: match[2] };
}

function isMinuteInRange(currentMinutes, range) {
    const parsed = typeof range === 'string' ? parseTimeRange(range) : range;
    if (!parsed) return false;
    let current = currentMinutes;
    if (parsed.end > 24 * 60 && current < parsed.start) current += 24 * 60;
    return current >= parsed.start && current < parsed.end;
}

module.exports = {
    DEFAULT_TIMEZONE,
    getLocalDateString,
    getLocalTimeString,
    addDaysToDateString,
    isValidDateString,
    getMinutesInTimeZone,
    parseClock,
    parseTimeRange,
    isMinuteInRange
};
