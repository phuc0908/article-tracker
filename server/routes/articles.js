const express = require('express');
const router = express.Router();
const { db } = require('../db');

/**
 * GET /api/articles
 * Query unique articles and their aggregated statistics
 */
router.get('/', (req, res) => {
    try {
        const { domain, search, sort_by = 'last_seen', order = 'desc', limit = 50, offset = 0 } = req.query;

        const allowedSortFields = new Set([
            'last_seen',
            'first_seen',
            'total_reading_time_sec',
            'total_sessions',
            'max_scroll_percent',
            'domain',
            'title'
        ]);

        const sortByField = allowedSortFields.has(sort_by) ? sort_by : 'last_seen';
        const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        let query = `SELECT * FROM articles WHERE 1=1`;
        const params = [];

        if (domain) {
            query += ` AND domain LIKE ?`;
            params.push(`%${domain.replace(/^www\./, '')}%`);
        }

        if (search) {
            query += ` AND (title LIKE ? OR url LIKE ? OR content LIKE ? OR summary LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        query += ` ORDER BY ${sortByField} ${sortOrder} LIMIT ? OFFSET ?`;
        params.push(Math.min(Number(limit) || 50, 200));
        params.push(Number(offset) || 0);

        const stmt = db.prepare(query);
        const rows = stmt.all(...params);

        // Compute active status for each article from the latest event
        const enrichedRows = rows.map(art => {
            const latestEvent = db.prepare(`SELECT event_type, timestamp FROM events WHERE url = ? ORDER BY timestamp DESC LIMIT 1`).get(art.url);
            let status = 'COMPLETED';
            if (latestEvent) {
                if (latestEvent.event_type === 'PAGE_ENTER' || latestEvent.event_type === 'PAGE_ACTIVE') {
                    status = 'ACTIVE';
                } else if (latestEvent.event_type === 'PAGE_INACTIVE') {
                    status = 'INACTIVE';
                }
            }
            return {
                ...art,
                status
            };
        });

        // Count total unique articles
        let countQuery = `SELECT COUNT(*) AS total FROM articles WHERE 1=1`;
        const countParams = [];
        if (domain) {
            countQuery += ` AND domain LIKE ?`;
            countParams.push(`%${domain.replace(/^www\./, '')}%`);
        }
        if (search) {
            countQuery += ` AND (title LIKE ? OR url LIKE ? OR content LIKE ? OR summary LIKE ?)`;
            const s = `%${search}%`;
            countParams.push(s, s, s, s);
        }
        const total = db.prepare(countQuery).get(...countParams)?.total || 0;

        res.json({
            success: true,
            total_count: total,
            returned_count: enrichedRows.length,
            limit: Math.min(Number(limit) || 50, 200),
            offset: Number(offset) || 0,
            data: enrichedRows
        });
    } catch (err) {
        console.error('Error querying articles:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error while querying articles.'
        });
    }
});

/**
 * GET /api/articles/detail
 * Query full detail of an article by ?url=... including full timeline of events
 */
router.get('/detail', (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'Missing required "url" query parameter.'
            });
        }

        const article = db.prepare(`SELECT * FROM articles WHERE url = ?`).get(url);
        if (!article) {
            return res.status(404).json({
                success: false,
                error: 'Article not found.'
            });
        }

        const events = db.prepare(`SELECT * FROM events WHERE url = ? ORDER BY timestamp ASC`).all(url);

        const timeline = events.map(e => ({
            event_id: e.event_id,
            event_type: e.event_type,
            session_id: e.session_id,
            timestamp: e.timestamp,
            payload: safeJsonParse(e.payload)
        }));

        res.json({
            success: true,
            data: {
                ...article,
                events_count: events.length,
                timeline
            }
        });
    } catch (err) {
        console.error('Error querying article detail:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error while querying article detail.'
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
