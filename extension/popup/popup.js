// =====================================================
// ELEMENTS
// =====================================================

const sessionsContainer =
    document.getElementById(
        "sessions"
    );

const refreshButton =
    document.getElementById(
        "refreshButton"
    );

const settingsButton =
    document.getElementById(
        "settingsButton"
    );

const clearButton =
    document.getElementById(
        "clearButton"
    );


// =====================================================
// REFRESH
// =====================================================

refreshButton.addEventListener(
    "click",
    async () => {

        refreshButton.disabled = true;
        refreshButton.innerText = "⏳ Loading...";

        await loadSessions();

        refreshButton.disabled = false;
        refreshButton.innerText = "🔄 Refresh";

    }
);


// =====================================================
// SETTINGS
// =====================================================

settingsButton.addEventListener(
    "click",
    () => {

        chrome.runtime.openOptionsPage();

    }
);


// =====================================================
// CLEAR
// =====================================================

clearButton.addEventListener(
    "click",
    async () => {

        const confirmed =
            confirm(
                "Xóa toàn bộ lịch sử đọc?"
            );


        if (!confirmed) {
            return;
        }


        await chrome.runtime.sendMessage({
            type: "CLEAR_SESSIONS"
        });


        loadSessions();

    }
);


// =====================================================
// LOAD
// =====================================================

async function loadSessions() {

    const response =
        await chrome.runtime.sendMessage({
            type: "GET_SESSIONS"
        });


    if (
        !response ||
        !response.success
    ) {

        sessionsContainer.innerHTML =
            `<p>Không thể tải dữ liệu.</p>`;

        return;
    }


    renderSessions(
        response.sessions
    );

}


// =====================================================
// RENDER
// =====================================================

function renderSessions(
    sessions
) {

    if (
        !sessions ||
        sessions.length === 0
    ) {

        sessionsContainer.innerHTML = `
            <div class="empty">
                <div class="empty-icon">
                    📖
                </div>

                <p>
                    Chưa có phiên đọc nào.
                </p>
            </div>
        `;

        return;
    }


    sessionsContainer.innerHTML =
        sessions
            .map(renderSession)
            .join("");

}


// =====================================================
// SESSION CARD
// =====================================================

function renderSession(
    session
) {

    const title =
        escapeHtml(
            session.title ||
            "Untitled"
        );


    const domain =
        escapeHtml(
            session.domain ||
            ""
        );


    const url =
        escapeHtml(
            session.url ||
            ""
        );


    const start =
        formatDate(
            session.startTime
        );


    const readingTime =
        formatDuration(
            session.readingTime
        );


    const scroll =
        session.maxScrollPercent || 0;


    // Status badge configuration
    let statusClass = "completed";
    let statusText = "🏁 Đã xong";

    if (session.status === "ACTIVE") {
        statusClass = "active";
        statusText = "🟢 Đang đọc";
    } else if (session.status === "INACTIVE") {
        statusClass = "inactive";
        statusText = "⏸️ Tạm dừng";
    }


    return `
        <div class="session-card">

            <div class="session-header">
                <div class="session-title">
                    ${title}
                </div>
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
            </div>

            <div class="session-domain">
                ${domain}
            </div>

            <div class="session-url">
                ${url}
            </div>

            <div class="session-info">

                <span>
                    🕐 ${start}
                </span>

                <span>
                    📖 ${readingTime}
                </span>

                <span>
                    ↕ ${scroll}%
                </span>

            </div>

        </div>
    `;
}


// =====================================================
// FORMAT DURATION
// =====================================================

function formatDuration(
    seconds
) {

    seconds =
        Number(seconds) || 0;


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        seconds % 60;


    if (minutes === 0) {

        return `${remainingSeconds}s`;

    }


    return `${minutes}m ${remainingSeconds}s`;

}


// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(
    value
) {

    if (!value) {
        return "-";
    }


    return new Date(
        value
    ).toLocaleString(
        "vi-VN"
    );

}


// =====================================================
// ESCAPE
// =====================================================

function escapeHtml(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// INIT
// =====================================================

loadSessions();