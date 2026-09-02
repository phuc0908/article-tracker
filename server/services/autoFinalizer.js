const { db, insertEvent } = require('../db');
const { broadcastEvent } = require('../routes/events');

const TIMEOUT_THRESHOLD_MS = 20 * 1000; // 20 seconds timeout
const CHECK_INTERVAL_MS = 10 * 1000;    // Check every 10 seconds

/**
 * Scan for unfinalized sessions whose latest heartbeat is older than TIMEOUT_THRESHOLD_MS,
 * and synthesize a PAGE_LEAVE event with exit_type: "timeout_abrupt_exit".
 */
function checkAndFinalizeDeadSessions() {
    try {
        const now = Date.now();

        // Find the most recent event for each session where the last event is NOT 'PAGE_LEAVE'
        const activeSessionsQuery = `
            SELECT e1.*
            FROM events e1
            INNER JOIN (
                SELECT session_id, MAX(timestamp) AS max_timestamp
                FROM events
                GROUP BY session_id
            ) e2 ON e1.session_id = e2.session_id AND e1.timestamp = e2.max_timestamp
            WHERE e1.event_type != 'PAGE_LEAVE'
        `;

        const unfinalizedEvents = db.prepare(activeSessionsQuery).all();

        for (const lastEvt of unfinalizedEvents) {
            const eventTime = new Date(lastEvt.timestamp).getTime();
            const elapsed = now - eventTime;

            if (elapsed >= TIMEOUT_THRESHOLD_MS) {
                let payload = {};
                try {
                    payload = typeof lastEvt.payload === 'string' ? JSON.parse(lastEvt.payload || '{}') : (lastEvt.payload || {});
                } catch {
                    payload = {};
                }

                // Synthesize PAGE_LEAVE event matching the timestamp of the last heartbeat + 1s
                const syntheticLeaveEvent = {
                    event_id: crypto.randomUUID(),
                    event_type: 'PAGE_LEAVE',
                    session_id: lastEvt.session_id,
                    url: lastEvt.url,
                    domain: lastEvt.domain,
                    title: lastEvt.title,
                    timestamp: new Date(eventTime + 1000).toISOString(),
                    payload: {
                        ...payload,
                        exit_type: 'timeout_abrupt_exit',
                        auto_finalized: true
                    }   
                };

                const insertedId = insertEvent(syntheticLeaveEvent);
                console.log(`[Auto-Finalizer] Auto-finalized dead session [${lastEvt.session_id.substring(0, 8)}...] for "${lastEvt.title}" (Timeout: ${Math.round(elapsed / 1000)}s)`);

                if (typeof broadcastEvent === 'function') {
                    broadcastEvent({
                        type: 'NEW_EVENT',
                        event: {
                            ...syntheticLeaveEvent,
                            event_id: insertedId
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('[Auto-Finalizer] Error checking dead sessions:', err.message);
    }
}

/**
 * Start background worker interval
 */
function startAutoFinalizer(intervalMs = CHECK_INTERVAL_MS) {
    console.log(`[Auto-Finalizer] Dead Man's Switch worker active (Interval: ${intervalMs / 1000}s, Timeout: ${TIMEOUT_THRESHOLD_MS / 1000}s)`);
    // Run an initial check on startup
    checkAndFinalizeDeadSessions();
    return setInterval(checkAndFinalizeDeadSessions, intervalMs);
}

module.exports = {
    checkAndFinalizeDeadSessions,
    startAutoFinalizer
};
