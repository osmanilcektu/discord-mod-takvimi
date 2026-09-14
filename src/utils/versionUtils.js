function normalizeVersion(value) {
    return String(value || '')
        .trim()
        .replace(/^v/i, '')
        .split('-')[0]
        .split('.')
        .map(part => Number.parseInt(part, 10) || 0)
        .slice(0, 3)
        .concat([0, 0, 0])
        .slice(0, 3);
}

function compareVersions(left, right) {
    const a = normalizeVersion(left);
    const b = normalizeVersion(right);
    for (let i = 0; i < 3; i += 1) {
        if (a[i] > b[i]) return 1;
        if (a[i] < b[i]) return -1;
    }
    return 0;
}

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let unit = units[0];
    for (let i = 1; i < units.length && size >= 1024; i += 1) {
        size /= 1024;
        unit = units[i];
    }
    return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}

function formatUptime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${days}g ${hours}s ${minutes}dk`;
}

module.exports = { normalizeVersion, compareVersions, formatBytes, formatUptime };
