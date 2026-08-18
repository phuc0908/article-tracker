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
            "sessions"
        ]);

    if (!result.websites) {

        await chrome.storage.local.set({
            websites: DEFAULT_WEBSITES
        });
    }

    if (!result.sessions) {

        await chrome.storage.local.set({
            sessions: []
        });
    }

});


// =====================================================
// TAB ACTIVATED
// =====================================================

chrome.tabs.onActivated.addListener(async (activeInfo) => {

    try {

        const tabs =
            await chrome.tabs.query({
                active: true,
                lastFocusedWindow: true
            });

        const activeTab = tabs[0];

        if (!activeTab) {
            return;
        }

        sendTabState(
            activeTab.id,
            true
        );

    } catch (error) {

        console.error(
            "Error handling tab activation:",
            error
        );

    }

});


// =====================================================
// WINDOW FOCUS
// =====================================================

chrome.windows.onFocusChanged.addListener(
    async (windowId) => {

        if (
            windowId === chrome.windows.WINDOW_ID_NONE
        ) {

            // Chrome lost focus.
            // Notify all tabs.

            const tabs =
                await chrome.tabs.query({});

            tabs.forEach(tab => {

                sendTabState(
                    tab.id,
                    false
                );

            });

            return;
        }


        try {

            const tabs =
                await chrome.tabs.query({
                    active: true,
                    windowId: windowId
                });

            const activeTab = tabs[0];

            if (!activeTab) {
                return;
            }

            sendTabState(
                activeTab.id,
                true
            );

        } catch (error) {

            console.error(error);

        }

    }
);


// =====================================================
// SEND TAB STATE
// =====================================================

function sendTabState(
    tabId,
    active
) {

    chrome.tabs.sendMessage(
        tabId,
        {
            type: active
                ? "TAB_ACTIVE"
                : "TAB_INACTIVE"
        }
    ).catch(() => {
        // Content script may not exist on this page.
    });

}


// =====================================================
// MESSAGE FROM CONTENT SCRIPT
// =====================================================

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (
            message.type === "ARTICLE_SESSION_COMPLETED"
        ) {

            saveSession(
                message.session
            );

            sendResponse({
                success: true
            });

            return true;
        }


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


        if (
            message.type === "GET_SESSIONS"
        ) {

            chrome.storage.local
                .get("sessions")
                .then(result => {

                    sendResponse({
                        success: true,
                        sessions:
                            result.sessions || []
                    });

                });

            return true;
        }


        if (
            message.type === "CLEAR_SESSIONS"
        ) {

            chrome.storage.local
                .set({
                    sessions: []
                })
                .then(() => {

                    sendResponse({
                        success: true
                    });

                });

            return true;
        }

    }
);


// =====================================================
// SAVE SESSION
// =====================================================

async function saveSession(session) {

    if (!session || !session.url) {
        return;
    }


    const result =
        await chrome.storage.local.get("sessions");

    const sessions =
        result.sessions || [];


    const existingIndex =
        sessions.findIndex(
            s => s.url === session.url
        );


    if (existingIndex !== -1) {

        const existing =
            sessions[existingIndex];


        existing.readingTime =
            (Number(existing.readingTime) || 0) +
            (Number(session.readingTime) || 0);


        existing.maxScrollPercent =
            Math.max(
                Number(existing.maxScrollPercent) || 0,
                Number(session.maxScrollPercent) || 0
            );


        existing.endTime =
            session.endTime;


        if (session.title) {
            existing.title = session.title;
        }


        if (session.content) {
            existing.content = session.content;
        }


        // Remove from current position and move to top
        sessions.splice(existingIndex, 1);
        sessions.unshift(existing);

    } else {

        sessions.unshift(session);

    }


    // Keep latest 100 sessions
    const limitedSessions =
        sessions.slice(0, 100);


    await chrome.storage.local.set({
        sessions: limitedSessions
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