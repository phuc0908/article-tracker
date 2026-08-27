const ALLOWED_EVENT_TYPES = new Set([
    'PAGE_ENTER',
    'PAGE_ACTIVE',
    'PAGE_INACTIVE',
    'PAGE_LEAVE'
]);

function validateEvent(req, res, next) {
    const data = req.body;

    if (!data) {
        return res.status(400).json({
            success: false,
            error: 'Request body cannot be empty.'
        });
    }

    // Support both single event or batch events
    const events = Array.isArray(data) ? data : [data];

    if (events.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Events array must contain at least one event.'
        });
    }

    for (let i = 0; i < events.length; i++) {
        const item = events[i];
        const prefix = events.length > 1 ? `Item [${i}]: ` : '';

        if (!item || typeof item !== 'object') {
            return res.status(400).json({
                success: false,
                error: `${prefix}Event must be a valid JSON object.`
            });
        }

        // Validate event_type
        if (!item.event_type || typeof item.event_type !== 'string' || !ALLOWED_EVENT_TYPES.has(item.event_type)) {
            return res.status(400).json({
                success: false,
                error: `${prefix}Invalid or missing 'event_type'. Must be one of: ${Array.from(ALLOWED_EVENT_TYPES).join(', ')}.`
            });
        }

        // Validate session_id
        if (!item.session_id || typeof item.session_id !== 'string' || item.session_id.trim() === '') {
            return res.status(400).json({
                success: false,
                error: `${prefix}'session_id' is required and must be a non-empty string.`
            });
        }

        // Validate url
        if (!item.url || typeof item.url !== 'string') {
            return res.status(400).json({
                success: false,
                error: `${prefix}'url' is required and must be a valid URL string.`
            });
        }

        try {
            new URL(item.url);
        } catch {
            return res.status(400).json({
                success: false,
                error: `${prefix}'url' must be a valid absolute URL (e.g., https://example.com/article).`
            });
        }

        // Validate timestamp (if provided)
        if (item.timestamp) {
            const parsedTime = Date.parse(item.timestamp);
            if (isNaN(parsedTime)) {
                return res.status(400).json({
                    success: false,
                    error: `${prefix}'timestamp' must be a valid ISO 8601 date string.`
                });
            }
        }
    }

    req.validatedEvents = events;
    next();
}

module.exports = {
    validateEvent
};
