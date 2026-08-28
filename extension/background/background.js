const DEFAULT_WEBSITES = [
    {
        id: "vnexpress",
        name: "VnExpress",
        domain: "vnexpress.net",
        articleSelector: ".fck_detail"
    },
    {
        id: "dantri",
        name: "Dân Trí",
        domain: "dantri.com.vn",
        articleSelector: ".singular-content"
    },
    {
        id: "tuoitre",
        name: "Tuổi Trẻ",
        domain: "tuoitre.vn",
        articleSelector: ".detail-content"
    }
];


// =====================================================
// INSTALL
// =====================================================

chrome.runtime.onInstalled.addListener(async () => {

    const result =
        await chrome.storage.local.get([
            "websites",
            "events"
        ]);

    if (!result.websites) {
        await chrome.storage.local.set({
            websites: DEFAULT_WEBSITES
        });
    }

    if (!result.events) {
        await chrome.storage.local.set({
            events: []
        });
    }

});


// Active tab and open session tracking
let currentActiveTabId = null;
const tabSessionMap = new Map(); // tabId -> latest event info

// =====================================================
// TAB ACTIVATED
// =====================================================

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const newTabId = activeInfo.tabId;

        // Notify previous active tab that it is now inactive
        if (currentActiveTabId && currentActiveTabId !== newTabId) {
            sendTabState(currentActiveTabId, false);
        }

        currentActiveTabId = newTabId;

        // Notify new active tab that it is active
        sendTabState(newTabId, true);
    } catch (error) {
        console.error("Error handling tab activation:", error);
    }
});

// =====================================================
// TAB REMOVED (CLOSED)
// =====================================================

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabSessionMap.has(tabId)) {
        const lastEvt = tabSessionMap.get(tabId);
        tabSessionMap.delete(tabId);

        // Synthesize PAGE_LEAVE event to immediately close session
        const leaveEvent = {
            event_id: crypto.randomUUID(),
            event_type: "PAGE_LEAVE",
            session_id: lastEvt.session_id,
            url: lastEvt.url,
            domain: lastEvt.domain,
            title: lastEvt.title,
            timestamp: new Date().toISOString(),
            payload: {
                exit_type: "tab_closed",
                scroll_percent: lastEvt.payload?.scroll_percent || lastEvt.payload?.max_scroll_percent || 0,
                total_active_reading_time_sec: lastEvt.payload?.active_reading_time_sec || lastEvt.payload?.total_active_reading_time_sec || 0
            }
        };

        saveEvent(leaveEvent);
    }

    if (tabId === currentActiveTabId) {
        currentActiveTabId = null;
    }
});

// =====================================================
// WINDOW FOCUS
// =====================================================

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Chrome window lost focus completely -> notify active tab
        if (currentActiveTabId) {
            sendTabState(currentActiveTabId, false);
        }
        return;
    }

    try {
        const tabs = await chrome.tabs.query({
            active: true,
            windowId: windowId
        });

        const activeTab = tabs[0];
        if (activeTab) {
            if (currentActiveTabId && currentActiveTabId !== activeTab.id) {
                sendTabState(currentActiveTabId, false);
            }
            currentActiveTabId = activeTab.id;
            sendTabState(activeTab.id, true);
        }
    } catch (error) {
        console.error(error);
    }
});

// =====================================================
// SEND TAB STATE
// =====================================================

function sendTabState(tabId, active) {
    chrome.tabs.sendMessage(
        tabId,
        {
            type: active ? "TAB_ACTIVE" : "TAB_INACTIVE"
        }
    ).catch(() => {
        // Content script may not exist on this page.
    });
}

// =====================================================
// MESSAGE LISTENER
// =====================================================

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        // Handle Event Tracking
        if (message.type === "TRACK_EVENT") {
            if (sender?.tab?.id) {
                tabSessionMap.set(sender.tab.id, message.event);
            }

            saveEvent(message.event)
                .then(() => {
                    sendResponse({
                        success: true
                    });
                });

            return true;
        }


        // Query Raw Events
        if (
            message.type === "GET_EVENTS"
        ) {

            chrome.storage.local
                .get("events")
                .then(result => {

                    sendResponse({
                        success: true,
                        events:
                            result.events || []
                    });

                });

            return true;
        }


        // Query Aggregated Sessions for Popup UI
        if (
            message.type === "GET_SESSIONS"
        ) {

            chrome.storage.local
                .get("events")
                .then(result => {

                    const events =
                        result.events || [];

                    const sessions =
                        getAggregatedSessions(events);

                    sendResponse({
                        success: true,
                        sessions
                    });

                });

            return true;
        }


        // Clear All Events / History
        if (
            message.type === "CLEAR_SESSIONS" ||
            message.type === "CLEAR_EVENTS"
        ) {

            chrome.storage.local
                .set({
                    events: [],
                    sessions: []
                })
                .then(() => {

                    sendResponse({
                        success: true
                    });

                });

            return true;
        }


        // Get Current Active Tab
        if (
            message.type === "GET_CURRENT_TAB"
        ) {

            getCurrentTab()
                .then(tab => {

                    sendResponse({
                        success: true,
                        tab
                    });

                });

            return true;
        }

    }
);


// =====================================================
// SAVE EVENT & SYNC TO CENTRAL SERVER
// =====================================================

const SERVER_API_URL = "http://localhost:3000/api/events";

async function saveEvent(event) {

    if (!event || !event.event_type) {
        return;
    }

    // 1. Save locally in chrome.storage.local
    const result =
        await chrome.storage.local.get("events");

    const events =
        result.events || [];

    // Add new event at the beginning
    events.unshift(event);

    // Keep up to latest 1000 events
    const limitedEvents =
        events.slice(0, 1000);

    await chrome.storage.local.set({
        events: limitedEvents
    });

    // 2. Sync to Central Server asynchronously
    syncEventToServer(event);

}

async function syncEventToServer(event) {

    try {
        await fetch(SERVER_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(event)
        });
    } catch {
        // Central server might be offline, ignore gracefully
    }

}


// =====================================================
// AGGREGATE SESSIONS FROM EVENTS (GROUP BY URL)
// =====================================================

function getAggregatedSessions(events) {

    if (!events || !Array.isArray(events) || events.length === 0) {
        return [];
    }

    const sessionMap = new Map();

    // Sort chronologically (oldest to newest) to replay state
    const sortedEvents =
        [...events].sort((a, b) => {
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });

    for (const event of sortedEvents) {

        // Group by URL so reloads of the same article merge into 1 card
        const key = event.url;

        if (!key) {
            continue;
        }

        if (!sessionMap.has(key)) {
            sessionMap.set(key, {
                sessionId: event.session_id,
                url: event.url,
                domain: event.domain,
                title: event.title || "Untitled",
                startTime: event.timestamp,
                endTime: event.timestamp,
                readingTime: 0,
                maxScrollPercent: 0,
                status: "ACTIVE", // ACTIVE | INACTIVE | COMPLETED
                eventsCount: 0,
                _sessionTimes: new Map()
            });
        }

        const session = sessionMap.get(key);

        session.eventsCount++;
        session.endTime = event.timestamp;

        if (event.title) {
            session.title = event.title;
        }
        if (event.domain) {
            session.domain = event.domain;
        }

        // Calculate max scroll
        const scroll =
            event.payload?.scroll_percent ||
            event.payload?.max_scroll_percent ||
            0;

        session.maxScrollPercent =
            Math.max(
                session.maxScrollPercent,
                Number(scroll) || 0
            );

        // Update active reading time per session_id to accumulate across reloads
        const sid = event.session_id || 'default';
        const sTime = Number(event.payload?.total_active_reading_time_sec ?? event.payload?.active_reading_time_sec ?? 0);
        const currentSidTime = session._sessionTimes.get(sid) || 0;
        session._sessionTimes.set(sid, Math.max(currentSidTime, sTime));

        let totalTime = 0;
        for (const t of session._sessionTimes.values()) {
            totalTime += t;
        }
        session.readingTime = totalTime;

        // Determine session status from latest event of this URL
        if (event.event_type === "PAGE_LEAVE") {
            session.status = "COMPLETED";
        } else if (event.event_type === "PAGE_INACTIVE") {
            session.status = "INACTIVE";
        } else if (
            event.event_type === "PAGE_ACTIVE" ||
            event.event_type === "PAGE_ENTER"
        ) {
            session.status = "ACTIVE";
        }

    }

    // Convert map to array and clean up temporary properties
    const now = Date.now();
    const ACTIVE_TTL_MS = 15 * 1000;
    const INACTIVE_TTL_MS = 45 * 1000;

    const sessions = Array.from(sessionMap.values()).map(s => {
        const { _sessionTimes, ...cleanSession } = s;
        const elapsed = now - new Date(cleanSession.endTime).getTime();

        let finalStatus = cleanSession.status;
        if (cleanSession.status === "ACTIVE" && elapsed > ACTIVE_TTL_MS) {
            finalStatus = elapsed <= INACTIVE_TTL_MS ? "INACTIVE" : "COMPLETED";
        } else if (cleanSession.status === "INACTIVE" && elapsed > INACTIVE_TTL_MS) {
            finalStatus = "COMPLETED";
        }

        return {
            ...cleanSession,
            status: finalStatus
        };
    });

    // Sort by latest activity (endTime descending)
    return sessions.sort((a, b) => {
        return new Date(b.endTime).getTime() - new Date(a.endTime).getTime();
    });

}


// =====================================================
// CURRENT TAB
// =====================================================

async function getCurrentTab() {

    const tabs =
        await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

    return tabs[0] || null;
}