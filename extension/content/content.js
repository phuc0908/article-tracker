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

let sessionEnded = false;

let maxScrollPercent = 0;


// =====================================================
// INITIALIZATION
// =====================================================

(async function init() {

    websiteConfig =
        await findWebsiteConfig();


    // Website không nằm trong danh sách
    if (!websiteConfig) {

        console.log(
            "[Article Tracker] Ignored:",
            location.hostname
        );

        return;
    }


    console.log(
        "[Article Tracker] Tracking:",
        websiteConfig.name
    );


    // Create session
    sessionId =
        crypto.randomUUID();


    startTime =
        Date.now();


    lastActivityTime =
        Date.now();


    lastCalculationTime =
        Date.now();


    // Check current visibility & tab focus state
    isPageVisible =
        document.visibilityState === "visible";

    isTabActive =
        document.hasFocus();


    // Track activity
    registerActivityListeners();


    // Track visibility
    registerVisibilityListener();


    // Track scroll
    registerScrollListener();


    // Start timer
    startReadingTimer();


    console.log(
        "[Article Tracker] Session started:",
        sessionId
    );


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


    // If tab is currently active and focused, also emit PAGE_ACTIVE
    if (isPageVisible && isTabActive) {
        sendEvent("PAGE_ACTIVE", {
            reason: "page_load"
        });
    }

})();


// =====================================================
// SEND EVENT HELPER
// =====================================================

function sendEvent(eventType, payload = {}) {

    if (!websiteConfig || !sessionId) {
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

    const result =
        await chrome.storage.local.get(
            "websites"
        );


    const websites =
        result.websites || [];


    const hostname =
        location.hostname
            .toLowerCase();


    return websites.find(site => {

        const domain =
            normalizeDomain(
                site.domain
            );


        return (
            hostname === domain ||
            hostname.endsWith(
                "." + domain
            )
        );

    }) || null;

}


// =====================================================
// NORMALIZE DOMAIN
// =====================================================

function normalizeDomain(domain) {

    return domain
        .toLowerCase()
        .trim()
        .replace(
            /^https?:\/\//,
            ""
        )
        .replace(
            /^www\./,
            ""
        )
        .replace(
            /\/.*$/,
            ""
        );

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
            {
                passive: true
            }
        );

    });

}


// =====================================================
// USER ACTIVITY
// =====================================================

function handleUserActivity() {

    lastActivityTime =
        Date.now();

}


// =====================================================
// VISIBILITY
// =====================================================

function registerVisibilityListener() {

    document.addEventListener(
        "visibilitychange",
        () => {

            if (document.visibilityState === "hidden") {

                calculateReadingTime(true);

                isPageVisible = false;

                sendEvent("PAGE_INACTIVE", {
                    reason: "visibility_hidden"
                });

            } else {

                isPageVisible = true;

                lastActivityTime =
                    Date.now();

                lastCalculationTime =
                    Date.now();

                sendEvent("PAGE_ACTIVE", {
                    reason: "visibility_visible"
                });

            }

        }
    );

}


// =====================================================
// TAB STATE FROM BACKGROUND
// =====================================================

chrome.runtime.onMessage.addListener(
    (message) => {

        if (
            message.type === "TAB_ACTIVE"
        ) {

            isTabActive = true;

            lastActivityTime =
                Date.now();

            lastCalculationTime =
                Date.now();

            sendEvent("PAGE_ACTIVE", {
                reason: "tab_active"
            });

        }


        if (
            message.type === "TAB_INACTIVE"
        ) {

            calculateReadingTime(true);

            isTabActive = false;

            lastCalculationTime =
                Date.now();

            sendEvent("PAGE_INACTIVE", {
                reason: "tab_inactive"
            });

        }

    }
);


// =====================================================
// SCROLL
// =====================================================

function registerScrollListener() {

    window.addEventListener(
        "scroll",
        updateScrollProgress,
        {
            passive: true
        }
    );

}


function updateScrollProgress() {

    const scrollHeight =
        document.documentElement.scrollHeight;


    const viewportHeight =
        window.innerHeight;


    const scrollTop =
        window.scrollY;


    const totalScrollable =
        scrollHeight -
        viewportHeight;


    if (totalScrollable <= 0) {

        maxScrollPercent = 100;

        return;
    }


    const percent =
        (
            (scrollTop + viewportHeight) /
            scrollHeight
        ) * 100;


    maxScrollPercent =
        Math.max(
            maxScrollPercent,
            Math.min(
                100,
                Math.round(percent)
            )
        );

}


// =====================================================
// READING TIMER
// =====================================================

let heartbeatCount = 0;

function startReadingTimer() {

    setInterval(() => {

        calculateReadingTime();

        heartbeatCount++;

        // Send active heartbeat every 5 seconds if active
        if (
            heartbeatCount % 5 === 0 &&
            isPageVisible &&
            isTabActive &&
            document.hasFocus() &&
            (Date.now() - lastActivityTime <= IDLE_THRESHOLD)
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

    if (
        sessionEnded ||
        !websiteConfig
    ) {

        return;
    }


    const now =
        Date.now();


    // -----------------------------------------------
    // CHECK VISIBILITY & FOCUS (UNLESS FORCED)
    // -----------------------------------------------

    if (!force) {

        if (!isPageVisible) {

            lastCalculationTime = now;

            return;
        }


        if (!isTabActive) {

            lastCalculationTime = now;

            return;
        }


        if (!document.hasFocus()) {

            lastCalculationTime = now;

            return;
        }

    }


    // -----------------------------------------------
    // USER IDLE
    // -----------------------------------------------

    const idleTime =
        now -
        lastActivityTime;


    if (
        idleTime >
        IDLE_THRESHOLD
    ) {

        lastCalculationTime =
            now;

        return;
    }


    // -----------------------------------------------
    // ADD ACTIVE TIME
    // -----------------------------------------------

    const delta =
        now -
        lastCalculationTime;


    if (
        delta > 0 &&
        delta <= 3000
    ) {

        readingTime += delta;

    }


    lastCalculationTime =
        now;

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