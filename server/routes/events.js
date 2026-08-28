const express = require('express');
const router = express.Router();
const { db, insertEvent } = require('../db');
const { validateEvent } = require('../middleware/validator');

// SSE Clients registry for real-time live events
const sseClients = new Set();

function broadcastEvent(event) {
    if (sseClients.size === 0) return;
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(data);
        } catch {
            sseClients.delete(client);
        }
    }
}

/**
 * GET /api/events/stream
 * Server-Sent Events (SSE) stream for real-time live dashboard updates
 */
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Initial connection ping
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

/**
 * POST /api/events
 * Receive and store event(s) from Chrome Extension
 */
router.post('/', validateEvent, (req, res) => {
    try {
        const events = req.validatedEvents;
        const insertedIds = [];

        for (const event of events) {
            const eventId = insertEvent(event);
            insertedIds.push(eventId);
            broadcastEvent({
                type: 'NEW_EVENT',
                event: {
                    ...event,
                    event_id: eventId
                }
            });
        }

        res.status(201).json({
            success: true,
            message: `Successfully recorded ${insertedIds.length} event(s).`,
            data: {
                inserted_count: insertedIds.length,
                event_ids: insertedIds
            }
        });
    } catch (err) {
        console.error('Error inserting event:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error while saving event data.'
        });
    }
});

/**
 * GET /api/events
 * Query raw events with optional filters
 */
router.get('/', (req, res) => {
    try {
        const { session_id, url, event_type, limit = 50, offset = 0 } = req.query;

        let query = 'SELECT * FROM events WHERE 1=1';
        const params = [];

        if (session_id) {
            query += ' AND session_id = ?';
            params.push(session_id);
        }
        if (url) {
            query += ' AND url = ?';
            params.push(url);
        }
        if (event_type) {
            query += ' AND event_type = ?';
            params.push(event_type);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(Math.min(Number(limit) || 50, 500));
        params.push(Number(offset) || 0);

        const stmt = db.prepare(query);
        const rows = stmt.all(...params);

        const parsedRows = rows.map(r => ({
            ...r,
            payload: safeJsonParse(r.payload)
        }));

        res.json({
            success: true,
            count: parsedRows.length,
            data: parsedRows
        });
    } catch (err) {
        console.error('Error querying events:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error while querying events.'
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
