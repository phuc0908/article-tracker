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
        "[Article Tracker] Session:",
        sessionId
    );

})();


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

            } else {

                isPageVisible = true;

                lastActivityTime =
                    Date.now();

                lastCalculationTime =
                    Date.now();

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

        }


        if (
            message.type === "TAB_INACTIVE"
        ) {

            calculateReadingTime(true);

            isTabActive = false;

            lastCalculationTime =
                Date.now();

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

function startReadingTimer() {

    setInterval(
        calculateReadingTime,
        CALCULATION_INTERVAL
    );

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


    const session =
        createSessionData();


    console.log(
        "[Article Tracker] Session completed:",
        session
    );


    chrome.runtime.sendMessage({
        type:
            "ARTICLE_SESSION_COMPLETED",

        session
    });

}


// =====================================================
// PAGE LEAVE
// =====================================================

window.addEventListener(
    "pagehide",
    endSession
);