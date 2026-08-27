const express = require('express');
const router = express.Router();
const { db } = require('../db');

/**
 * GET /api/sessions
 * Query reading sessions aggregated from events
 */
router.get('/', (req, res) => {
    try {
        const { domain, status, limit = 50, offset = 0 } = req.query;

        // Fetch events ordered chronologically
        const stmt = db.prepare(`SELECT * FROM events ORDER BY timestamp ASC`);
        const allEvents = stmt.all();

        const sessionMap = new Map();

        for (const event of allEvents) {
            const sid = event.session_id;
            if (!sid) continue;

            const payload = safeJsonParse(event.payload);

            if (!sessionMap.has(sid)) {
                sessionMap.set(sid, {
                    session_id: sid,
                    url: event.url,
                    domain: event.domain || '',
                    title: event.title || 'Untitled',
                    start_time: event.timestamp,
                    end_time: event.timestamp,
                    reading_time_sec: 0,
                    max_scroll_percent: 0,
                    status: 'ACTIVE',
                    events_count: 0
                });
            }

            const session = sessionMap.get(sid);
            session.events_count++;
            session.end_time = event.timestamp;
            if (event.title) session.title = event.title;
            if (event.domain) session.domain = event.domain;
            if (event.url) session.url = event.url;

            // Scroll percent
            const scroll = payload.scroll_percent || payload.max_scroll_percent || 0;
            session.max_scroll_percent = Math.max(session.max_scroll_percent, Number(scroll) || 0);

            // Reading time
            if (payload.total_active_reading_time_sec !== undefined) {
                session.reading_time_sec = Math.max(session.reading_time_sec, Number(payload.total_active_reading_time_sec) || 0);
            } else if (payload.active_reading_time_sec !== undefined) {
                session.reading_time_sec = Math.max(session.reading_time_sec, Number(payload.active_reading_time_sec) || 0);
            }

            // Status transition
            if (event.event_type === 'PAGE_LEAVE') {
                session.status = 'COMPLETED';
            } else if (event.event_type === 'PAGE_INACTIVE') {
                session.status = 'INACTIVE';
            } else if (event.event_type === 'PAGE_ACTIVE' || event.event_type === 'PAGE_ENTER') {
                session.status = 'ACTIVE';
            }
        }

        let sessions = Array.from(sessionMap.values()).sort((a, b) => {
            return new Date(b.end_time).getTime() - new Date(a.end_time).getTime();
        });

        // Apply filters
        if (domain) {
            const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
            sessions = sessions.filter(s => s.domain.toLowerCase().includes(normalizedDomain));
        }

        if (status) {
            sessions = sessions.filter(s => s.status.toLowerCase() === status.toLowerCase());
        }

        const totalCount = sessions.length;
        const pageLimit = Math.min(Number(limit) || 50, 200);
        const pageOffset = Number(offset) || 0;
        const pagedSessions = sessions.slice(pageOffset, pageOffset + pageLimit);

        res.json({
            success: true,
            total_count: totalCount,
            returned_count: pagedSessions.length,
            limit: pageLimit,
            offset: pageOffset,
            data: pagedSessions
        });
    } catch (err) {
        console.error('Error querying sessions:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error while querying sessions.'
        });
    }
});

/**
 * GET /api/sessions/:id
 * Query specific session with its event timeline
 */
router.get('/:id', (req, res) => {
    try {
        const sessionId = req.params.id;

        const stmt = db.prepare(`
            SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC
        `);
        const events = stmt.all(sessionId);

        if (!events || events.length === 0) {
            return res.status(404).json({
                success: false,
                error: `Session with ID '${sessionId}' not found.`
            });
        }

        let title = 'Untitled';
        let domain = '';
        let url = '';
        let readingTime = 0;
        let maxScroll = 0;
        let status = 'ACTIVE';
        const startTime = events[0].timestamp;
        const endTime = events[events.length - 1].timestamp;

        const timeline = events.map(e => {
            const payload = safeJsonParse(e.payload);
            if (e.title) title = e.title;
            if (e.domain) domain = e.domain;
            if (e.url) url = e.url;

            const scroll = payload.scroll_percent || payload.max_scroll_percent || 0;
            maxScroll = Math.max(maxScroll, Number(scroll) || 0);

            if (payload.total_active_reading_time_sec !== undefined) {
                readingTime = Math.max(readingTime, Number(payload.total_active_reading_time_sec) || 0);
            } else if (payload.active_reading_time_sec !== undefined) {
                readingTime = Math.max(readingTime, Number(payload.active_reading_time_sec) || 0);
            }

            if (e.event_type === 'PAGE_LEAVE') status = 'COMPLETED';
            else if (e.event_type === 'PAGE_INACTIVE') status = 'INACTIVE';
            else if (e.event_type === 'PAGE_ACTIVE' || e.event_type === 'PAGE_ENTER') status = 'ACTIVE';

            return {
                event_id: e.event_id,
                event_type: e.event_type,
                timestamp: e.timestamp,
                payload
            };
        });

        res.json({
            success: true,
            data: {
                session_id: sessionId,
                url,
                domain,
                title,
                start_time: startTime,
                end_time: endTime,
                reading_time_sec: readingTime,
                max_scroll_percent: maxScroll,
                status,
                events_count: events.length,
                timeline
            }
        });
    } catch (err) {
        console.error('Error querying session detail:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error while querying session detail.'
        });
    }
});

function safeJsonParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return {};
    }
}

module.exports = router;
