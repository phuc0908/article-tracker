const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { db } = require('./db');

const eventsRouter = require('./routes/events');
const sessionsRouter = require('./routes/sessions');
const articlesRouter = require('./routes/articles');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Serve static dashboard files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/events', eventsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/articles', articlesRouter);

/**
 * GET /api/stats
 * General overview statistics
 */
app.get('/api/stats', (req, res) => {
    try {
        const totalEvents = db.prepare('SELECT COUNT(*) AS c FROM events').get()?.c || 0;
        const totalArticles = db.prepare('SELECT COUNT(*) AS c FROM articles').get()?.c || 0;
        const totalSessions = db.prepare('SELECT COUNT(DISTINCT session_id) AS c FROM events').get()?.c || 0;
        const totalReadingTime = db.prepare('SELECT SUM(total_reading_time_sec) AS s FROM articles').get()?.s || 0;
        const avgScroll = db.prepare('SELECT AVG(max_scroll_percent) AS a FROM articles').get()?.a || 0;

        const topDomains = db.prepare(`
            SELECT domain, COUNT(*) AS count, SUM(total_reading_time_sec) AS total_reading_time
            FROM articles
            GROUP BY domain
            ORDER BY count DESC
            LIMIT 10
        `).all();

        // Hourly reading distribution for charts
        const hourlyDistribution = db.prepare(`
            SELECT strftime('%H', timestamp) AS hour, COUNT(*) AS event_count
            FROM events
            WHERE event_type IN ('PAGE_ENTER', 'PAGE_ACTIVE')
            GROUP BY hour
            ORDER BY hour ASC
        `).all();

        res.json({
            success: true,
            data: {
                total_events: totalEvents,
                total_sessions: totalSessions,
                total_articles: totalArticles,
                total_reading_time_sec: totalReadingTime,
                total_reading_time_min: Math.round(totalReadingTime / 60),
                avg_scroll_percent: Math.round(avgScroll),
                top_domains: topDomains,
                hourly_distribution: hourlyDistribution
            }
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error while computing statistics.'
        });
    }
});

// Reset Database endpoint
app.post('/api/reset', (req, res) => {
    try {
        db.exec(`
            DELETE FROM events;
            DELETE FROM articles;
            VACUUM;
        `);
        res.json({
            success: true,
            message: 'Database has been successfully cleared.'
        });
    } catch (err) {
        console.error('Error clearing database:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to reset database.'
        });
    }
});

// Root / Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Root Health Check & API documentation
app.get('/api', (req, res) => {
    res.json({
        name: 'Article Tracker Central Server',
        status: 'running',
        version: '1.0.0',
        endpoints: {
            'GET  /dashboard': 'Web Real-time Analytics Dashboard',
            'POST /api/events': 'Record event data from Chrome Extension',
            'GET  /api/events': 'Query raw events list',
            'GET  /api/events/stream': 'SSE Real-time live event stream',
            'GET  /api/sessions': 'Query aggregated reading sessions',
            'GET  /api/sessions/:id': 'Query single session detail with timeline',
            'GET  /api/articles': 'Query tracked unique articles and stats',
            'GET  /api/articles/detail': 'Query single article with full content & timeline',
            'GET  /api/stats': 'Overview statistics'
        }
    });
});

// 404 Not Found Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Route '${req.method} ${req.originalUrl}' not found.`
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
        success: false,
        error: 'An unexpected internal server error occurred.'
    });
});

const { startAutoFinalizer } = require('./services/autoFinalizer');

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🚀 Article Tracker Central Server running on:`);
        console.log(`   http://localhost:${PORT}`);
        console.log(`   Endpoints:`);
        console.log(`   - POST http://localhost:${PORT}/api/events`);
        console.log(`   - GET  http://localhost:${PORT}/api/sessions`);
        console.log(`   - GET  http://localhost:${PORT}/api/articles`);
        console.log(`   - GET  http://localhost:${PORT}/api/stats`);
        console.log(`====================================================`);

        // Start Dead Man's Switch / Auto-Finalizer background worker
        startAutoFinalizer(10000);
    });
}

module.exports = app;
