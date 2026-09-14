const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { getSlotById } = require('../utils/slots');

class Database {
    constructor(dbPath = './data/bot.db', timeSlots = null) {
        this.dbPath = dbPath;
        this.timeSlots = timeSlots;
        this.db = null;

        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    }

    async connect() {
        if (this.db) return;
        await new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, err => {
                if (err) return reject(err);
                resolve();
            });
        });
        await this.run('PRAGMA foreign_keys = ON');
        await this.run('PRAGMA journal_mode = WAL');
        await this.run('PRAGMA busy_timeout = 5000');
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('Veritabanı bağlantısı açık değil.'));
            this.db.run(sql, params, function onRun(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('Veritabanı bağlantısı açık değil.'));
            this.db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('Veritabanı bağlantısı açık değil.'));
            this.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
        });
    }

    exec(sql) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('Veritabanı bağlantısı açık değil.'));
            this.db.exec(sql, err => (err ? reject(err) : resolve()));
        });
    }

    async init() {
        await this.exec(`
            CREATE TABLE IF NOT EXISTS mod_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                period TEXT NOT NULL,
                availability TEXT,
                excuse TEXT,
                responded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS discipline_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                violation_type TEXT NOT NULL,
                period TEXT NOT NULL,
                ban_days INTEGER NOT NULL,
                ban_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                ban_end DATETIME NOT NULL,
                applied BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS survey_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period TEXT UNIQUE NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                survey_sent_at DATETIME,
                deadline DATETIME NOT NULL,
                published BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS survey_deliveries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period TEXT NOT NULL,
                user_id TEXT NOT NULL,
                status TEXT NOT NULL,
                error TEXT,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(period, user_id)
            );

            CREATE TABLE IF NOT EXISTS moderators (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                display_name TEXT,
                roles TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                day_restriction BOOLEAN DEFAULT FALSE,
                night_restriction BOOLEAN DEFAULT FALSE,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_time_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                permission_type TEXT NOT NULL CHECK(permission_type IN ('allow','restrict')),
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS permanent_shifts (
                user_id TEXT PRIMARY KEY,
                slot_id TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS absent_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                date TEXT NOT NULL,
                reason TEXT NOT NULL,
                punishment_type TEXT NOT NULL,
                punishment_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                punishment_end DATETIME NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                violation_count INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS schedule_status (
                date TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                survey_sent_at DATETIME,
                survey_deadline DATETIME,
                completed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await this.ensureDailyAssignmentsSchema();
        await this.ensureColumn('absent_users', 'updated_at', 'DATETIME');
        await this.run('UPDATE absent_users SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL');

        await this.exec(`
            CREATE INDEX IF NOT EXISTS idx_responses_period ON mod_responses(period);
            CREATE INDEX IF NOT EXISTS idx_responses_user_period ON mod_responses(user_id, period);
            CREATE INDEX IF NOT EXISTS idx_survey_deliveries_period ON survey_deliveries(period, status);
            CREATE INDEX IF NOT EXISTS idx_discipline_user ON discipline_records(user_id);
            CREATE INDEX IF NOT EXISTS idx_discipline_period ON discipline_records(period);
            CREATE INDEX IF NOT EXISTS idx_moderators_active ON moderators(is_active);
            CREATE INDEX IF NOT EXISTS idx_time_permissions_user ON user_time_permissions(user_id, is_active);
            CREATE INDEX IF NOT EXISTS idx_absent_users_date ON absent_users(date);
            CREATE INDEX IF NOT EXISTS idx_absent_users_active ON absent_users(is_active);
            CREATE INDEX IF NOT EXISTS idx_schedule_status_date ON schedule_status(date);
            CREATE INDEX IF NOT EXISTS idx_daily_assignments_user_date ON daily_assignments(user_id, date);
        `);
    }

    async ensureDailyAssignmentsSchema() {
        const existing = await this.all("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_assignments'");
        if (existing.length > 0) {
            const columns = await this.all('PRAGMA table_info(daily_assignments)');
            const names = new Set(columns.map(column => column.name));
            const isCurrent = ['date', 'user_id', 'slot_id', 'slot_name'].every(name => names.has(name));
            if (!isCurrent) {
                const suffix = Date.now();
                await this.run(`ALTER TABLE daily_assignments RENAME TO daily_assignments_legacy_${suffix}`);
            }
        }

        await this.exec(`
            CREATE TABLE IF NOT EXISTS daily_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                user_id TEXT NOT NULL,
                slot_id TEXT NOT NULL,
                slot_name TEXT NOT NULL,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                assignment_type TEXT DEFAULT 'automatic',
                assigned_by TEXT,
                UNIQUE(date, slot_id)
            );
        `);
    }

    async ensureColumn(table, column, definition) {
        const columns = await this.all(`PRAGMA table_info(${table})`);
        if (!columns.some(item => item.name === column)) {
            await this.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        }
    }

    parseRoles(row) {
        if (!row) return null;
        try {
            return { ...row, roles: JSON.parse(row.roles || '[]') };
        } catch {
            return { ...row, roles: [] };
        }
    }

    parseResponse(row) {
        if (!row) return null;
        try {
            return { ...row, availability: JSON.parse(row.availability || '[]') };
        } catch {
            return { ...row, availability: [] };
        }
    }

    async saveModResponse(userId, username, period, availability, excuse = '') {
        await this.run('DELETE FROM mod_responses WHERE user_id = ? AND period = ?', [userId, period]);
        const result = await this.run(`
            INSERT INTO mod_responses (user_id, username, period, availability, excuse, responded_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [userId, username, period, JSON.stringify(availability || []), excuse || '']);
        return result.lastID;
    }

    async getResponsesForPeriod(period) {
        const rows = await this.all('SELECT * FROM mod_responses WHERE period = ? ORDER BY responded_at ASC', [period]);
        return rows.map(row => this.parseResponse(row));
    }

    async getResponsesForDate(date) {
        return this.getResponsesForPeriod(date);
    }

    async addDisciplineRecord(userId, username, violationType, period, banDays) {
        const banEnd = new Date(Date.now() + banDays * 86400000).toISOString();
        const result = await this.run(`
            INSERT INTO discipline_records (user_id, username, violation_type, period, ban_days, ban_end)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, username, violationType, period, banDays, banEnd]);
        return result.lastID;
    }

    async getViolationCount(userId) {
        const row = await this.get('SELECT COUNT(*) AS count FROM discipline_records WHERE user_id = ?', [userId]);
        return row?.count || 0;
    }

    async saveSurveyPeriod(period, startDate, endDate, deadline) {
        await this.run(`
            INSERT INTO survey_periods (period, start_date, end_date, deadline, survey_sent_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(period) DO UPDATE SET
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                deadline = excluded.deadline,
                survey_sent_at = CURRENT_TIMESTAMP
        `, [period, startDate, endDate, deadline]);
    }

    async getSurveyPeriod(period) {
        return this.get('SELECT * FROM survey_periods WHERE period = ?', [period]);
    }

    async recordSurveyDelivery(period, userId, status, error = null) {
        await this.run(`
            INSERT INTO survey_deliveries (period, user_id, status, error, sent_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(period, user_id) DO UPDATE SET
                status = excluded.status,
                error = excluded.error,
                sent_at = CURRENT_TIMESTAMP
        `, [period, userId, status, error]);
    }

    async getSuccessfullySurveyedUserIds(period) {
        const rows = await this.all(
            "SELECT user_id FROM survey_deliveries WHERE period = ? AND status = 'sent'",
            [period]
        );
        return rows.map(row => row.user_id);
    }

    async updateModerator(userId, username, displayName, roles, dayRestriction = null, nightRestriction = null) {
        await this.run(`
            INSERT INTO moderators (user_id, username, display_name, roles, is_active, day_restriction, night_restriction, last_seen, updated_at)
            VALUES (?, ?, ?, ?, TRUE, COALESCE(?, FALSE), COALESCE(?, FALSE), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                display_name = excluded.display_name,
                roles = excluded.roles,
                is_active = TRUE,
                day_restriction = CASE WHEN ? IS NULL THEN moderators.day_restriction ELSE ? END,
                night_restriction = CASE WHEN ? IS NULL THEN moderators.night_restriction ELSE ? END,
                last_seen = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `, [
            userId, username, displayName, JSON.stringify(roles || []), dayRestriction, nightRestriction,
            dayRestriction, dayRestriction, nightRestriction, nightRestriction
        ]);
    }

    async updateModeratorRestrictions(userId, dayRestriction, nightRestriction) {
        const result = await this.run(`
            UPDATE moderators SET day_restriction = ?, night_restriction = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `, [Boolean(dayRestriction), Boolean(nightRestriction), userId]);
        return result.changes;
    }

    async addModerator(userId, username, displayName, roles) {
        await this.updateModerator(userId, username, displayName, roles);
        return userId;
    }

    async deactivateMissingModerators(activeUserIds) {
        if (!Array.isArray(activeUserIds)) throw new Error('activeUserIds bir dizi olmalıdır.');
        if (activeUserIds.length === 0) {
            const result = await this.run('UPDATE moderators SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE is_active = TRUE');
            return result.changes;
        }
        const placeholders = activeUserIds.map(() => '?').join(',');
        const result = await this.run(`
            UPDATE moderators SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE user_id NOT IN (${placeholders}) AND is_active = TRUE
        `, activeUserIds);
        return result.changes;
    }

    async getModerator(userId) {
        return this.parseRoles(await this.get('SELECT * FROM moderators WHERE user_id = ?', [userId]));
    }

    async getActiveModerators() {
        const rows = await this.all('SELECT * FROM moderators WHERE is_active = TRUE ORDER BY username ASC');
        return rows.map(row => this.parseRoles(row));
    }

    async getAvailableModerators(shiftType = null) {
        let sql = 'SELECT * FROM moderators WHERE is_active = TRUE';
        if (shiftType === 'day') sql += ' AND day_restriction = FALSE';
        if (shiftType === 'night') sql += ' AND night_restriction = FALSE';
        sql += ' ORDER BY username ASC';
        const rows = await this.all(sql);
        return rows.map(row => this.parseRoles(row));
    }

    async setUserTimePermission(userId, startTime, endTime, permissionType, description = '') {
        const result = await this.run(`
            INSERT INTO user_time_permissions (user_id, start_time, end_time, permission_type, description, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)
        `, [userId, startTime, endTime, permissionType, description]);
        return result.lastID;
    }

    async getUserTimePermissions(userId) {
        return this.all('SELECT * FROM user_time_permissions WHERE user_id = ? AND is_active = TRUE ORDER BY id ASC', [userId]);
    }

    async setPermanentShift(userId, slotId, description = '') {
        const slot = this.timeSlots ? getSlotById(this.timeSlots, slotId) : { id: slotId };
        if (!slot) throw new Error(`Geçersiz vardiya: ${slotId}`);
        await this.run(`
            INSERT INTO permanent_shifts (user_id, slot_id, description, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                slot_id = excluded.slot_id,
                description = excluded.description,
                updated_at = CURRENT_TIMESTAMP
        `, [userId, slotId, description]);
    }

    async getPermanentShift(userId) {
        return this.get('SELECT * FROM permanent_shifts WHERE user_id = ?', [userId]);
    }

    async getAllPermanentShifts() {
        return this.all('SELECT * FROM permanent_shifts ORDER BY slot_id ASC');
    }

    async assignToSlot(date, userId, slotId, assignmentType = 'automatic', assignedBy = null) {
        const slot = this.timeSlots ? getSlotById(this.timeSlots, slotId) : null;
        const slotName = slot?.name || slotId;

        const occupied = await this.getAssignmentForSlot(date, slotId);
        if (occupied && occupied.user_id !== userId) {
            throw new Error(`${slotId} vardiyası ${date} tarihinde zaten atanmış.`);
        }

        const existingUserAssignment = await this.get(`
            SELECT * FROM daily_assignments WHERE date = ? AND user_id = ? AND slot_id <> ? LIMIT 1
        `, [date, userId, slotId]);
        if (existingUserAssignment) {
            throw new Error(`Kullanıcı ${date} tarihinde zaten ${existingUserAssignment.slot_id} vardiyasına atanmış.`);
        }

        await this.run(`
            INSERT INTO daily_assignments (date, user_id, slot_id, slot_name, assigned_at, assignment_type, assigned_by)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
            ON CONFLICT(date, slot_id) DO UPDATE SET
                user_id = excluded.user_id,
                slot_name = excluded.slot_name,
                assigned_at = CURRENT_TIMESTAMP,
                assignment_type = excluded.assignment_type,
                assigned_by = excluded.assigned_by
        `, [date, userId, slotId, slotName, assignmentType, assignedBy]);
    }

    async saveScheduleAssignments(date, assignments) {
        if (!Array.isArray(assignments)) throw new Error('assignments bir dizi olmalıdır.');
        await this.run('BEGIN IMMEDIATE');
        try {
            await this.run('DELETE FROM daily_assignments WHERE date = ?', [date]);
            for (const assignment of assignments) {
                await this.assignToSlot(
                    date,
                    assignment.user_id,
                    assignment.slot_id,
                    assignment.assignment_type || 'automatic',
                    assignment.assigned_by || null
                );
            }
            await this.run('COMMIT');
        } catch (error) {
            await this.run('ROLLBACK').catch(() => {});
            throw error;
        }
    }

    async saveDailySlotAssignment(assignment) {
        return this.assignToSlot(
            assignment.date,
            assignment.user_id,
            assignment.slot_id,
            assignment.assignment_type || 'automatic',
            assignment.assigned_by || null
        );
    }

    async saveSlotAssignment(assignment) {
        return this.saveDailySlotAssignment(assignment);
    }

    async updateDailySlotAssignment(date, slotId, userId, assignmentType = 'manual', assignedBy = null) {
        return this.replaceSlotAssignment(date, slotId, userId, assignmentType, assignedBy);
    }

    async replaceSlotAssignment(date, slotId, userId, assignmentType = 'manual', assignedBy = null) {
        const other = await this.get('SELECT * FROM daily_assignments WHERE date = ? AND user_id = ? AND slot_id <> ? LIMIT 1', [date, userId, slotId]);
        if (other) throw new Error(`Kullanıcı ${date} tarihinde zaten ${other.slot_id} vardiyasına atanmış.`);
        const slot = this.timeSlots ? getSlotById(this.timeSlots, slotId) : null;
        const result = await this.run(`
            UPDATE daily_assignments
            SET user_id = ?, slot_name = ?, assignment_type = ?, assigned_by = ?, assigned_at = CURRENT_TIMESTAMP
            WHERE date = ? AND slot_id = ?
        `, [userId, slot?.name || slotId, assignmentType, assignedBy, date, slotId]);
        if (result.changes === 0) {
            await this.assignToSlot(date, userId, slotId, assignmentType, assignedBy);
        }
    }

    async changeUserShift(userId, newSlotId, date, reason = '') {
        const current = await this.get('SELECT * FROM daily_assignments WHERE user_id = ? AND date = ? LIMIT 1', [userId, date]);
        if (!current) return { success: false, error: 'Bu tarih için kullanıcı ataması bulunamadı.' };

        const occupied = await this.getAssignmentForSlot(date, newSlotId);
        if (occupied && occupied.user_id !== userId) {
            return { success: false, error: 'Hedef vardiya başka bir moderatöre atanmış.' };
        }

        const slot = this.timeSlots ? getSlotById(this.timeSlots, newSlotId) : null;
        const result = await this.run(`
            UPDATE daily_assignments
            SET slot_id = ?, slot_name = ?, assignment_type = 'manual_change', assigned_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [newSlotId, slot?.name || newSlotId, current.id]);

        return result.changes > 0 ? { success: true, reason } : { success: false, error: 'Vardiya güncellenemedi.' };
    }

    async getAssignmentForSlot(date, slotId) {
        return this.get('SELECT * FROM daily_assignments WHERE date = ? AND slot_id = ?', [date, slotId]);
    }

    async getAssignmentsForDate(date) {
        return this.all('SELECT * FROM daily_assignments WHERE date = ? ORDER BY slot_id ASC', [date]);
    }

    async getDailySlotAssignments(date) {
        return this.getAssignmentsForDate(date);
    }

    async getUserAssignmentsForDate(userId, date) {
        return this.all('SELECT * FROM daily_assignments WHERE user_id = ? AND date = ? ORDER BY slot_id ASC', [userId, date]);
    }

    async getSlotAssignments(period, slotId) {
        return this.all('SELECT * FROM daily_assignments WHERE date LIKE ? AND slot_id = ? ORDER BY date ASC', [`%${period}%`, slotId]);
    }

    async hasScheduleForDate(date) {
        const row = await this.get('SELECT COUNT(*) AS count FROM daily_assignments WHERE date = ?', [date]);
        return (row?.count || 0) > 0;
    }

    async deleteScheduleForDate(date) {
        const result = await this.run('DELETE FROM daily_assignments WHERE date = ?', [date]);
        await this.run('DELETE FROM schedule_status WHERE date = ?', [date]);
        return result.changes;
    }

    async saveDailyAssignment(date, dayMod1, dayMod2, nightMod1, nightMod2) {
        await this.deleteScheduleForDate(date);
        const users = [dayMod1, dayMod2, nightMod1, nightMod2].filter(Boolean);
        for (let index = 0; index < users.length; index += 1) {
            await this.assignToSlot(date, users[index], `slot${index + 1}`, 'legacy');
        }
    }

    async getDailyAssignment(date) {
        const assignments = await this.getAssignmentsForDate(date);
        if (assignments.length === 0) return null;
        return {
            date,
            assignments,
            day_mod_1: assignments[0]?.user_id || null,
            day_mod_2: assignments[1]?.user_id || null,
            night_mod_1: assignments[2]?.user_id || null,
            night_mod_2: assignments[3]?.user_id || null
        };
    }

    async saveScheduleStatus(date, status, surveyDeadline = null) {
        const completedAt = status === 'completed' ? new Date().toISOString() : null;
        await this.run(`
            INSERT INTO schedule_status (date, status, survey_sent_at, survey_deadline, completed_at, updated_at)
            VALUES (?, ?, CASE WHEN ? = 'survey_sent' THEN CURRENT_TIMESTAMP ELSE NULL END, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(date) DO UPDATE SET
                status = excluded.status,
                survey_sent_at = CASE WHEN excluded.status = 'survey_sent' THEN CURRENT_TIMESTAMP ELSE schedule_status.survey_sent_at END,
                survey_deadline = COALESCE(excluded.survey_deadline, schedule_status.survey_deadline),
                completed_at = COALESCE(excluded.completed_at, schedule_status.completed_at),
                updated_at = CURRENT_TIMESTAMP
        `, [date, status, status, surveyDeadline, completedAt]);
    }

    async getScheduleStatus(date) {
        return this.get('SELECT * FROM schedule_status WHERE date = ?', [date]);
    }

    async getDueScheduleStatuses() {
        return this.all(`
            SELECT * FROM schedule_status
            WHERE status = 'survey_sent'
              AND survey_deadline IS NOT NULL
              AND datetime(survey_deadline) <= datetime('now')
            ORDER BY survey_deadline ASC
        `);
    }

    async recordAbsentUser(userId, username, date, reason, punishmentType, punishmentEnd) {
        const previous = await this.get('SELECT COUNT(*) AS count FROM absent_users WHERE user_id = ?', [userId]);
        const violationCount = (previous?.count || 0) + 1;

        const existing = await this.get(`
            SELECT id FROM absent_users WHERE user_id = ? AND date = ? AND reason = ? LIMIT 1
        `, [userId, date, reason]);
        if (existing) return { id: existing.id, violationCount: Math.max(1, violationCount - 1), duplicate: true };

        const result = await this.run(`
            INSERT INTO absent_users
            (user_id, username, date, reason, punishment_type, punishment_end, is_active, violation_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, CURRENT_TIMESTAMP)
        `, [userId, username, date, reason, punishmentType, punishmentEnd, violationCount]);
        return { id: result.lastID, violationCount, duplicate: false };
    }

    async getPunishedUsers() {
        return this.all(`
            SELECT * FROM absent_users
            WHERE is_active = TRUE AND datetime(punishment_end) > datetime('now')
            ORDER BY datetime(punishment_end) ASC
        `);
    }

    async getExpiredPunishments() {
        return this.all(`
            SELECT * FROM absent_users
            WHERE is_active = TRUE AND datetime(punishment_end) <= datetime('now')
            ORDER BY datetime(punishment_end) ASC
        `);
    }

    async deactivatePunishment(id) {
        const result = await this.run(`
            UPDATE absent_users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND is_active = TRUE
        `, [id]);
        return result.changes > 0;
    }

    async getActivePunishmentsForUser(userId) {
        return this.all(`
            SELECT * FROM absent_users
            WHERE user_id = ? AND is_active = TRUE AND datetime(punishment_end) > datetime('now')
            ORDER BY datetime(punishment_end) ASC
        `, [userId]);
    }

    async removeBan(userId) {
        const result = await this.run(`
            UPDATE absent_users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND is_active = TRUE
        `, [userId]);
        return result.changes === 0
            ? { success: false, error: 'Aktif ceza bulunamadı' }
            : { success: true, count: result.changes };
    }

    async getViolationHistory(userId) {
        return this.all('SELECT * FROM absent_users WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    }

    async close() {
        if (!this.db) return;
        const db = this.db;
        this.db = null;
        await new Promise(resolve => db.close(() => resolve()));
    }
}

module.exports = Database;
