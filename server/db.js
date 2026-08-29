const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'tracker.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys for performance and consistency
db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
`);

// Initialize Database Schema
db.exec(`
    -- Raw Events Table
    CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL CHECK (event_type IN ('PAGE_ENTER', 'PAGE_ACTIVE', 'PAGE_INACTIVE', 'PAGE_LEAVE')),
        session_id TEXT NOT NULL,
        url TEXT NOT NULL,
        domain TEXT,
        title TEXT,
        timestamp TEXT NOT NULL,
        payload TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_url ON events(url);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

    -- Articles Summary Table (auto updated upon events)
    CREATE TABLE IF NOT EXISTS articles (
        url TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        title TEXT,
        content TEXT,
        summary TEXT,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        total_sessions INTEGER DEFAULT 1,
        total_reading_time_sec INTEGER DEFAULT 0,
        max_scroll_percent INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_articles_domain ON articles(domain);
    CREATE INDEX IF NOT EXISTS idx_articles_last_seen ON articles(last_seen);
`);

// Auto-migrate articles table if content/summary columns do not exist
try {
    const tableInfo = db.prepare(`PRAGMA table_info(articles)`).all();
    const columnNames = new Set(tableInfo.map(col => col.name));
    if (!columnNames.has('content')) {
        db.exec(`ALTER TABLE articles ADD COLUMN content TEXT;`);
    }
    if (!columnNames.has('summary')) {
        db.exec(`ALTER TABLE articles ADD COLUMN summary TEXT;`);
    }
} catch (migErr) {
    console.warn('Migration note:', migErr.message);
}

/**
 * Intelligent extractive text summarizer helper
 */
function generateSmartSummary(content, maxSentences = 3) {
    if (!content || typeof content !== 'string') return '';
    const clean = content.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
    if (clean.length <= 250) return clean;

    // Split sentences respecting Vietnamese and English punctuation
    const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) || [clean];
    const picked = sentences.slice(0, maxSentences).join(' ').trim();
    if (picked.length > 350) {
        return picked.substring(0, 347) + '...';
    }
    return picked || clean.substring(0, 300) + '...';
}

/**
 * Insert a single validated event and update article summary
 */
function insertEvent(event) {
    const payloadStr = typeof event.payload === 'object' ? JSON.stringify(event.payload) : (event.payload || '{}');
    const eventId = event.event_id || crypto.randomUUID();
    const domain = event.domain || extractDomain(event.url);
    const title = event.title || 'Untitled';
    const timestamp = event.timestamp || new Date().toISOString();

    // Server-side Deduplication: Ignore/merge identical consecutive events for the same session within 1000ms
    if (event.session_id && event.event_type !== 'PAGE_ENTER') {
        const lastEvt = db.prepare(`
            SELECT event_id, event_type, timestamp 
            FROM events 
            WHERE session_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 1
        `).get(event.session_id);

        if (lastEvt && lastEvt.event_type === event.event_type) {
            const timeDiff = Math.abs(new Date(timestamp).getTime() - new Date(lastEvt.timestamp).getTime());
            if (timeDiff < 1000) {
                db.prepare(`UPDATE events SET timestamp = ?, payload = ? WHERE event_id = ?`)
                  .run(timestamp, payloadStr, lastEvt.event_id);
                updateArticleSummary(event.url, domain, title, timestamp, event);
                return lastEvt.event_id;
            }
        }
    }

    const insertEventStmt = db.prepare(`
        INSERT OR REPLACE INTO events (event_id, event_type, session_id, url, domain, title, timestamp, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertEventStmt.run(
        eventId,
        event.event_type,
        event.session_id,
        event.url,
        domain,
        title,
        timestamp,
        payloadStr
    );

    // Update article summary table
    updateArticleSummary(event.url, domain, title, timestamp, event);

    return eventId;
}

/**
 * Update aggregated article record
 */
function updateArticleSummary(url, domain, title, timestamp, event) {
    const payload = typeof event.payload === 'string' ? JSON.parse(event.payload || '{}') : (event.payload || {});
    const readingTime = Number(payload.active_reading_time_sec || payload.total_active_reading_time_sec || 0);
    const scrollPercent = Number(payload.scroll_percent || payload.max_scroll_percent || 0);
    const content = payload.content || event.content || null;
    let summary = payload.summary || event.summary || (content ? generateSmartSummary(content) : null);

    const existingStmt = db.prepare(`SELECT * FROM articles WHERE url = ?`);
    const existing = existingStmt.get(url);

    if (existing) {
        const finalContent = content || existing.content || '';
        const finalSummary = summary || existing.summary || (finalContent ? generateSmartSummary(finalContent) : '');

        const updateStmt = db.prepare(`
            UPDATE articles
            SET title = COALESCE(NULLIF(?, ''), title),
                content = COALESCE(NULLIF(?, ''), content),
                summary = COALESCE(NULLIF(?, ''), summary),
                last_seen = ?,
                max_scroll_percent = MAX(max_scroll_percent, ?),
                total_reading_time_sec = MAX(total_reading_time_sec, total_reading_time_sec + ?)
            WHERE url = ?
        `);
        updateStmt.run(title, finalContent, finalSummary, timestamp, scrollPercent, event.event_type === 'PAGE_LEAVE' ? readingTime : 0, url);
    } else {
        const finalSummary = summary || (content ? generateSmartSummary(content) : '');
        const insertStmt = db.prepare(`
            INSERT INTO articles (url, domain, title, content, summary, first_seen, last_seen, total_sessions, total_reading_time_sec, max_scroll_percent)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `);
        insertStmt.run(url, domain, title, content || '', finalSummary, timestamp, timestamp, readingTime, scrollPercent);
    }
}

function extractDomain(urlStr) {
    try {
        const parsed = new URL(urlStr);
        return parsed.hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

module.exports = {
    db,
    insertEvent,
    generateSmartSummary
};
