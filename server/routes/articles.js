const express = require('express');
const router = express.Router();
const { db } = require('../db');

/**
 * GET /api/articles
 * Query unique articles and their aggregated statistics
 */
router.get('/', (req, res) => {
    try {
        const { domain, sort_by = 'last_seen', order = 'desc', limit = 50, offset = 0 } = req.query;

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

        query += ` ORDER BY ${sortByField} ${sortOrder} LIMIT ? OFFSET ?`;
        params.push(Math.min(Number(limit) || 50, 200));
        params.push(Number(offset) || 0);

        const stmt = db.prepare(query);
        const rows = stmt.all(...params);

        // Count total unique articles
        let countQuery = `SELECT COUNT(*) AS total FROM articles WHERE 1=1`;
        const countParams = [];
        if (domain) {
            countQuery += ` AND domain LIKE ?`;
            countParams.push(`%${domain.replace(/^www\./, '')}%`);
        }
        const total = db.prepare(countQuery).get(...countParams)?.total || 0;

        res.json({
            success: true,
            total_count: total,
            returned_count: rows.length,
            limit: Math.min(Number(limit) || 50, 200),
            offset: Number(offset) || 0,
            data: rows
        });
    } catch (err) {
        console.error('Error querying articles:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error while querying articles.'
        });
    }
});

module.exports = router;
