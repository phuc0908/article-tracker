// =====================================================
// CONFIG
// =====================================================

const IDLE_THRESHOLD = 30 * 1000;
const CALCULATION_INTERVAL = 1000;


// =====================================================
// STATE
// =====================================================

let websiteConfig = null;
let sessionId = null;
let startTime = null;
let lastActivityTime = null;
let lastCalculationTime = null;
let readingTime = 0;
let isTabActive = document.hasFocus();
let isPageVisible = document.visibilityState === "visible";
let isUserIdle = false;
let sessionEnded = false;
let currentTrackingStatus = "INIT"; // 'INIT' | 'ACTIVE' | 'INACTIVE' | 'LEAVE'
let maxScrollPercent = 0;


// =====================================================
// STATE TRANSITIONS (DEDUPLICATION GUARDS)
// =====================================================

function transitionToActive(reason) {
    if (sessionEnded || currentTrackingStatus === "ACTIVE") {
        return;
    }

    currentTrackingStatus = "ACTIVE";
    isPageVisible = true;
    isTabActive = true;
    isUserIdle = false;
    lastActivityTime = Date.now();
    lastCalculationTime = Date.now();

    sendEvent("PAGE_ACTIVE", { reason });
}

function transitionToInactive(reason) {
    if (sessionEnded || currentTrackingStatus === "INACTIVE") {
        return;
    }

    calculateReadingTime(true);
    currentTrackingStatus = "INACTIVE";
    isTabActive = false;
    lastCalculationTime = Date.now();

    sendEvent("PAGE_INACTIVE", { reason });
}


// =====================================================
// INITIALIZATION
// =====================================================

(async function init() {

    websiteConfig = await findWebsiteConfig();

    if (!websiteConfig) {
        return;
    }

    sessionId = crypto.randomUUID();
    startTime = Date.now();
    lastActivityTime = Date.now();
    lastCalculationTime = Date.now();
    isUserIdle = false;

    // Check current visibility & tab focus state
    isPageVisible = document.visibilityState === "visible";
    isTabActive = document.hasFocus();

    // Register all listeners
    registerActivityListeners();
    registerVisibilityListener();
    registerFocusListeners();
    registerScrollListener();

    // Start timer
    startReadingTimer();

    // -------------------------------------------------
    // EMIT PAGE_ENTER EVENT
    // -------------------------------------------------
    const extractedContent = extractArticleContent();
    const extractedSummary = extractArticleSummary(extractedContent);

    sendEvent("PAGE_ENTER", {
        status: isPageVisible && isTabActive ? "active" : "inactive",
        article_found: Boolean(extractedContent),
        content: extractedContent,
        summary: extractedSummary
    });

    // Initial state transition
    if (isPageVisible && isTabActive) {
        transitionToActive("page_load");
    } else {
        currentTrackingStatus = "INACTIVE";
    }

})();


// =====================================================
// SEND EVENT HELPER
// =====================================================

function sendEvent(eventType, payload = {}) {

    if (!websiteConfig || !sessionId) {
        return;
    }

    // Do not send any more events once the session has ended (except PAGE_LEAVE itself)
    if (sessionEnded && eventType !== "PAGE_LEAVE") {
        return;
    }

    const eventObj = {
        event_id: crypto.randomUUID(),
        event_type: eventType,
        session_id: sessionId,
        url: location.href,
        domain: location.hostname,
        title: document.title || websiteConfig.name,
        timestamp: new Date().toISOString(),
        payload: {
            scroll_percent: maxScrollPercent,
            active_reading_time_sec: Math.round(readingTime / 1000),
            ...payload
        }
    };

    chrome.runtime.sendMessage({
        type: "TRACK_EVENT",
        event: eventObj
    }).catch(() => {
        // Content script might be detached or background sleeping
    });

}


// =====================================================
// FIND WEBSITE CONFIG
// =====================================================

async function findWebsiteConfig() {

    const result = await chrome.storage.local.get("websites");
    const websites = result.websites || [];
    const hostname = location.hostname.toLowerCase();

    return websites.find(site => {
        const domain = normalizeDomain(site.domain);
        return hostname === domain || hostname.endsWith("." + domain);
    }) || null;

}


// =====================================================
// NORMALIZE DOMAIN
// =====================================================

function normalizeDomain(domain) {
    return domain
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "");
}


// =====================================================
// ACTIVITY TRACKING
// =====================================================

function registerActivityListeners() {
    const events = [
        "scroll",
        "mousemove",
        "mousedown",
        "keydown",
        "touchstart"
    ];

    events.forEach(eventName => {
        window.addEventListener(
            eventName,
            handleUserActivity,
            { passive: true }
        );
    });
}

function handleUserActivity() {
    if (sessionEnded) return;

    const wasIdle = isUserIdle;
    lastActivityTime = Date.now();

    // User resumed activity after being idle
    if (wasIdle && isPageVisible && isTabActive && !sessionEnded) {
        isUserIdle = false;
        transitionToActive("user_resume");
    }
}


// =====================================================
// VISIBILITY
// =====================================================

function registerVisibilityListener() {
    document.addEventListener("visibilitychange", () => {
        if (sessionEnded) return;

        if (document.visibilityState === "hidden") {
            isPageVisible = false;
            transitionToInactive("visibility_hidden");
        } else {
            isPageVisible = true;
            if (document.hasFocus()) {
                transitionToActive("visibility_visible");
            }
        }
    });
}


// =====================================================
// WINDOW FOCUS LISTENERS
// =====================================================

function registerFocusListeners() {
    window.addEventListener("focus", () => {
        if (sessionEnded) return;

        if (document.visibilityState === "visible") {
            transitionToActive("window_focus");
        }
    });

    window.addEventListener("blur", () => {
        if (sessionEnded) return;

        transitionToInactive("window_blur");
    });
}


// =====================================================
// TAB STATE FROM BACKGROUND
// =====================================================

chrome.runtime.onMessage.addListener((message) => {
    if (sessionEnded) return;

    if (message.type === "TAB_ACTIVE") {
        if (document.visibilityState === "visible") {
            transitionToActive("tab_active");
        }
    }

    if (message.type === "TAB_INACTIVE") {
        transitionToInactive("tab_inactive");
    }
});


// =====================================================
// SCROLL
// =====================================================

function registerScrollListener() {
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
}

function updateScrollProgress() {
    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const totalScrollable = scrollHeight - viewportHeight;

    if (totalScrollable <= 0) {
        maxScrollPercent = 100;
        return;
    }

    const percent = ((scrollTop + viewportHeight) / scrollHeight) * 100;
    maxScrollPercent = Math.max(maxScrollPercent, Math.min(100, Math.round(percent)));
}


// =====================================================
// READING TIMER & HEARTBEAT
// =====================================================

let heartbeatCount = 0;

function startReadingTimer() {
    setInterval(() => {
        const now = Date.now();
        const idleTime = now - lastActivityTime;

        // Auto-pause if user has been idle for longer than IDLE_THRESHOLD (30s)
        if (!isUserIdle && idleTime > IDLE_THRESHOLD && currentTrackingStatus === "ACTIVE") {
            isUserIdle = true;
            transitionToInactive("user_idle");
        }

        // Calculate time only if active & not idle
        calculateReadingTime();

        heartbeatCount++;

        // Send active heartbeat every 5 seconds if actively reading and interacting
        if (
            heartbeatCount % 5 === 0 &&
            currentTrackingStatus === "ACTIVE" &&
            isPageVisible &&
            isTabActive &&
            !isUserIdle &&
            document.hasFocus() &&
            (now - lastActivityTime <= IDLE_THRESHOLD)
        ) {
            sendEvent("PAGE_ACTIVE", {
                reason: "heartbeat"
            });
        }
    }, CALCULATION_INTERVAL);
}


// =====================================================
// CALCULATE READING TIME
// =====================================================

function calculateReadingTime(force = false) {
    if (sessionEnded || !websiteConfig) {
        return;
    }

    const now = Date.now();

    if (!force) {
        if (!isPageVisible || !isTabActive || !document.hasFocus() || isUserIdle) {
            lastCalculationTime = now;
            return;
        }

        const idleTime = now - lastActivityTime;
        if (idleTime > IDLE_THRESHOLD) {
            lastCalculationTime = now;
            return;
        }
    }

    const delta = now - lastCalculationTime;
    if (delta > 0 && delta <= 3000) {
        readingTime += delta;
    }

    lastCalculationTime = now;
}


// =====================================================
// EXTRACT ARTICLE CONTENT
// =====================================================

function extractArticleContent() {

    if (!websiteConfig) {
        return "";
    }


    const selector =
        websiteConfig.articleSelector;


    if (!selector) {
        return "";
    }


    try {

        const element =
            document.querySelector(
                selector
            );


        if (!element) {

            console.warn(
                "[Article Tracker] Article element not found:",
                selector
            );

            return "";
        }


        return element.innerText.trim();

    } catch (error) {

        console.error(
            "[Article Tracker] Invalid selector:",
            selector,
            error
        );

        return "";
    }

}


// =====================================================
// EXTRACT ARTICLE SUMMARY
// =====================================================

function extractArticleSummary(content = "") {

    try {
        // Try known sapo/description selectors
        const sapoSelectors = [
            ".description",
            ".singular-sapo",
            ".sapo",
            ".detail-sapo",
            "meta[name='description']",
            "meta[property='og:description']"
        ];

        for (const sel of sapoSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                const text = el.tagName === "META" ? el.getAttribute("content") : el.innerText;
                if (text && text.trim().length > 20) {
                    return text.trim();
                }
            }
        }

        // Fallback to first paragraph of content
        if (content) {
            const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 30);
            if (paragraphs.length > 0) {
                return paragraphs[0].trim();
            }
        }

        return "";
    } catch {
        return "";
    }

}


// =====================================================
// CREATE SESSION DATA
// =====================================================

function createSessionData() {

    const endTime =
        Date.now();


    return {

        sessionId,

        url:
            location.href,

        domain:
            location.hostname,

        title:
            document.title,

        content:
            extractArticleContent(),

        startTime:
            new Date(
                startTime
            ).toISOString(),

        endTime:
            new Date(
                endTime
            ).toISOString(),

        readingTime:
            Math.round(
                readingTime / 1000
            ),

        maxScrollPercent

    };

}


// =====================================================
// END SESSION
// =====================================================

function endSession() {

    if (
        sessionEnded ||
        !websiteConfig
    ) {

        return;
    }

    sessionEnded = true;
    currentTrackingStatus = "LEAVE";

    // Calculate last active interval forcing bypass of focus state during page unload
    calculateReadingTime(true);


    // Emit PAGE_LEAVE event
    sendEvent("PAGE_LEAVE", {
        total_active_reading_time_sec:
            Math.round(
                readingTime / 1000
            ),
        max_scroll_percent:
            maxScrollPercent,
        exit_type:
            "pagehide"
    });


    console.log(
        "[Article Tracker] Session completed:",
        sessionId
    );

}


// =====================================================
// PAGE LEAVE
// =====================================================

window.addEventListener(
    "pagehide",
    endSession
);