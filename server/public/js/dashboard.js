/**
 * ARTICLE TRACKER - REAL-TIME DASHBOARD CONTROLLER
 */

// State
let allArticles = [];
let filteredArticles = [];
let currentStats = {};
let activeModalArticle = null;
let currentModalTab = 'summary';
let sseSource = null;

// DOM Elements
const elements = {
    // Header & SSE
    liveStatusText: document.getElementById('liveStatusText'),
    pulseDot: document.getElementById('pulseDot'),
    lastUpdatedTime: document.getElementById('lastUpdatedTime'),
    refreshBtn: document.getElementById('refreshBtn'),
    tickerText: document.getElementById('tickerText'),

    // KPI Cards
    kpiArticles: document.getElementById('kpiArticles'),
    kpiTime: document.getElementById('kpiTime'),
    kpiScroll: document.getElementById('kpiScroll'),
    kpiSessions: document.getElementById('kpiSessions'),

    // Filter controls
    searchInput: document.getElementById('searchInput'),
    domainFilter: document.getElementById('domainFilter'),
    statusFilter: document.getElementById('statusFilter'),
    sortSelect: document.getElementById('sortSelect'),
    articlesTableBody: document.getElementById('articlesTableBody'),
    tableCountText: document.getElementById('tableCountText'),

    // Modal
    articleModal: document.getElementById('articleModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalTitle: document.getElementById('modalTitle'),
    modalUrlLink: document.getElementById('modalUrlLink'),
    modalDomainBadge: document.getElementById('modalDomainBadge'),
    modalStatusBadge: document.getElementById('modalStatusBadge'),
    modalReadingTime: document.getElementById('modalReadingTime'),
    modalScroll: document.getElementById('modalScroll'),
    modalSessions: document.getElementById('modalSessions'),
    modalEventsCount: document.getElementById('modalEventsCount'),
    modalTabSummary: document.getElementById('modalTabSummary'),
    modalTabContent: document.getElementById('modalTabContent'),
    modalTabTimeline: document.getElementById('modalTabTimeline'),
    modalSummaryView: document.getElementById('modalSummaryView'),
    modalContentView: document.getElementById('modalContentView'),
    modalTimelineView: document.getElementById('modalTimelineView'),
    wordCountBadge: document.getElementById('wordCountBadge')
};

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    ChartManager.init();
    setupEventListeners();
    setupSSE();
    loadDashboardData();

    // Auto-refresh interval fallback every 10 seconds
    setInterval(() => {
        loadDashboardData(false);
    }, 10000);
});

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        elements.refreshBtn.classList.add('loading');
        loadDashboardData(true).finally(() => {
            elements.refreshBtn.classList.remove('loading');
        });
    });

    // Search and filter inputs
    elements.searchInput.addEventListener('input', debounce(applyFiltersAndRender, 250));
    elements.domainFilter.addEventListener('change', applyFiltersAndRender);
    elements.statusFilter.addEventListener('change', applyFiltersAndRender);
    elements.sortSelect.addEventListener('change', applyFiltersAndRender);

    // Modal tabs
    elements.modalTabSummary.addEventListener('click', () => switchModalTab('summary'));
    elements.modalTabContent.addEventListener('click', () => switchModalTab('content'));
    elements.modalTabTimeline.addEventListener('click', () => switchModalTab('timeline'));

    // Modal close
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.articleModal.addEventListener('click', (e) => {
        if (e.target === elements.articleModal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// =====================================================
// REAL-TIME SERVER-SENT EVENTS (SSE)
// =====================================================

function setupSSE() {
    try {
        if (sseSource) {
            sseSource.close();
        }

        sseSource = new EventSource('/api/events/stream');

        sseSource.onopen = () => {
            elements.liveStatusText.textContent = 'Real-time Live';
            elements.pulseDot.style.backgroundColor = 'var(--accent-emerald)';
        };

        sseSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'NEW_EVENT') {
                    handleLiveEvent(data.event);
                }
            } catch (err) {
                console.error('SSE Message parsing error:', err);
            }
        };

        sseSource.onerror = () => {
            elements.liveStatusText.textContent = 'Reconnecting...';
            elements.pulseDot.style.backgroundColor = 'var(--accent-amber)';
        };
    } catch (err) {
        console.warn('SSE connection failed:', err);
    }
}

function handleLiveEvent(evt) {
    // Update live ticker
    const eventType = evt.event_type || 'PAGE_ACTIVE';
    const domain = evt.domain || 'web';
    const title = evt.title || evt.url || 'Bài viết';
    const timeStr = new Date(evt.timestamp || Date.now()).toLocaleTimeString('vi-VN');

    let badgeColor = 'var(--accent-indigo)';
    if (eventType === 'PAGE_ENTER') badgeColor = 'var(--accent-emerald)';
    else if (eventType === 'PAGE_LEAVE') badgeColor = 'var(--accent-rose)';
    else if (eventType === 'PAGE_INACTIVE') badgeColor = 'var(--accent-amber)';

    elements.tickerText.innerHTML = `
        <span class="ticker-tag" style="background: ${badgeColor}; color: white;">${eventType}</span>
        <strong>[${domain}]</strong> ${escapeHtml(title.substring(0, 70))} 
        <span style="color: var(--text-muted); font-size: 11px;">(${timeStr})</span>
    `;

    // Trigger instant refresh of stats and table data
    loadDashboardData(false);

    // If modal is open for this article, refresh timeline
    if (activeModalArticle && (activeModalArticle.url === evt.url || activeModalArticle.session_id === evt.session_id)) {
        openArticleModal(activeModalArticle.url, false);
    }
}

// =====================================================
// DATA FETCHING
// =====================================================

async function loadDashboardData(showVisualUpdate = true) {
    try {
        const [statsRes, articlesRes] = await Promise.all([
            fetch('/api/stats').then(r => r.json()),
            fetch('/api/articles?limit=100').then(r => r.json())
        ]);

        if (statsRes.success) {
            currentStats = statsRes.data;
            renderKPIs(currentStats);
            renderDomainOptions(currentStats.top_domains);
            ChartManager.renderDomainChart(currentStats.top_domains);
            ChartManager.renderHourlyChart(currentStats.hourly_distribution);
        }

        if (articlesRes.success) {
            allArticles = articlesRes.data || [];
            ChartManager.renderTrendChart(allArticles);
            ChartManager.renderScrollChart(allArticles);
            applyFiltersAndRender();
        }

        elements.lastUpdatedTime.textContent = `Cập nhật lúc: ${new Date().toLocaleTimeString('vi-VN')}`;
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
    }
}

// =====================================================
// RENDER KPIS
// =====================================================

function renderKPIs(stats) {
    elements.kpiArticles.textContent = Number(stats.total_articles || 0).toLocaleString();
    elements.kpiTime.textContent = formatDuration(stats.total_reading_time_sec || 0);
    elements.kpiScroll.textContent = `${stats.avg_scroll_percent || 0}%`;
    elements.kpiSessions.textContent = Number(stats.total_sessions || 0).toLocaleString();
}

function renderDomainOptions(topDomains) {
    if (!topDomains || topDomains.length === 0) return;
    const currentVal = elements.domainFilter.value;
    const existing = new Set(Array.from(elements.domainFilter.options).map(o => o.value));

    topDomains.forEach(d => {
        if (!existing.has(d.domain)) {
            const opt = document.createElement('option');
            opt.value = d.domain;
            opt.textContent = d.domain;
            elements.domainFilter.appendChild(opt);
        }
    });

    elements.domainFilter.value = currentVal;
}

// =====================================================
// FILTERING & TABLE RENDERING
// =====================================================

function applyFiltersAndRender() {
    const searchTerm = (elements.searchInput.value || '').trim().toLowerCase();
    const selectedDomain = elements.domainFilter.value;
    const selectedStatus = elements.statusFilter.value;
    const selectedSort = elements.sortSelect.value;

    filteredArticles = allArticles.filter(art => {
        // Search term in title, url, content, summary
        if (searchTerm) {
            const matchTitle = (art.title || '').toLowerCase().includes(searchTerm);
            const matchUrl = (art.url || '').toLowerCase().includes(searchTerm);
            const matchContent = (art.content || '').toLowerCase().includes(searchTerm);
            const matchSummary = (art.summary || '').toLowerCase().includes(searchTerm);
            if (!matchTitle && !matchUrl && !matchContent && !matchSummary) return false;
        }

        // Domain filter
        if (selectedDomain && !art.domain.toLowerCase().includes(selectedDomain.toLowerCase())) {
            return false;
        }

        // Status filter
        if (selectedStatus && art.status !== selectedStatus) {
            return false;
        }

        return true;
    });

    // Sorting
    filteredArticles.sort((a, b) => {
        if (selectedSort === 'last_seen_desc') {
            return new Date(b.last_seen || 0) - new Date(a.last_seen || 0);
        } else if (selectedSort === 'reading_time_desc') {
            return (b.total_reading_time_sec || 0) - (a.total_reading_time_sec || 0);
        } else if (selectedSort === 'scroll_desc') {
            return (b.max_scroll_percent || 0) - (a.max_scroll_percent || 0);
        } else if (selectedSort === 'sessions_desc') {
            return (b.total_sessions || 0) - (a.total_sessions || 0);
        }
        return 0;
    });

    renderArticlesTable(filteredArticles);
}

function renderArticlesTable(articles) {
    elements.tableCountText.textContent = `Hiển thị ${articles.length} bài báo`;

    if (!articles || articles.length === 0) {
        elements.articlesTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <div class="empty-icon">📰</div>
                        <p>Không tìm thấy bài báo nào phù hợp với bộ lọc.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    elements.articlesTableBody.innerHTML = articles.map(art => {
        const title = escapeHtml(art.title || 'Untitled');
        const url = escapeHtml(art.url);
        const domain = escapeHtml(art.domain);
        const readingTime = formatDuration(art.total_reading_time_sec || 0);
        const scroll = art.max_scroll_percent || 0;
        const lastSeen = formatDate(art.last_seen);
        const summary = escapeHtml(art.summary || 'Chưa có nội dung tóm tắt.');
        
        let statusBadge = `<span class="status-badge completed">Đã đọc</span>`;
        if (art.status === 'ACTIVE') {
            statusBadge = `<span class="status-badge active"><span class="pulse-dot"></span> Đang đọc</span>`;
        } else if (art.status === 'INACTIVE') {
            statusBadge = `<span class="status-badge inactive">⏸ Tạm dừng</span>`;
        }

        return `
            <tr>
                <td class="article-title-cell">
                    <a href="${url}" target="_blank" class="article-title-link" title="${title}">${title}</a>
                    <div class="article-meta-line">
                        <span class="domain-pill">${domain}</span>
                        <span>${art.total_sessions || 1} phiên</span>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td>
                    <strong style="color: var(--accent-indigo);">${readingTime}</strong>
                </td>
                <td>
                    <div><strong>${scroll}%</strong></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${Math.min(100, scroll)}%;"></div>
                    </div>
                </td>
                <td>
                    <div class="summary-preview" title="${summary}">
                        ${summary}
                    </div>
                </td>
                <td style="color: var(--text-muted); font-size: 12px; white-space: nowrap;">
                    ${lastSeen}
                </td>
                <td style="text-align: center;">
                    <button class="btn-action" onclick="openArticleModal('${encodeURIComponent(art.url)}')">
                        🔍 Chi tiết & Timeline
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// =====================================================
// ARTICLE MODAL & TIMELINE VISUALIZER
// =====================================================

window.openArticleModal = async function(encodedUrl, showModalUI = true) {
    try {
        const url = decodeURIComponent(encodedUrl);
        const res = await fetch(`/api/articles/detail?url=${encodeURIComponent(url)}`);
        const json = await res.json();

        if (!json.success || !json.data) {
            alert('Không thể tải chi tiết bài báo.');
            return;
        }

        const data = json.data;
        activeModalArticle = data;

        // Populate modal header & KPIs
        elements.modalTitle.textContent = data.title || 'Untitled';
        elements.modalUrlLink.href = data.url;
        elements.modalUrlLink.innerHTML = `${escapeHtml(data.url)} ↗`;
        elements.modalDomainBadge.textContent = data.domain || '';
        
        let statusText = 'Đã hoàn thành';
        let statusClass = 'completed';
        if (data.status === 'ACTIVE') {
            statusText = 'Đang đọc';
            statusClass = 'active';
        } else if (data.status === 'INACTIVE') {
            statusText = 'Tạm dừng';
            statusClass = 'inactive';
        }
        elements.modalStatusBadge.className = `status-badge ${statusClass}`;
        elements.modalStatusBadge.textContent = statusText;

        elements.modalReadingTime.textContent = formatDuration(data.total_reading_time_sec || 0);
        elements.modalScroll.textContent = `${data.max_scroll_percent || 0}%`;
        elements.modalSessions.textContent = data.total_sessions || 1;
        elements.modalEventsCount.textContent = data.events_count || (data.timeline ? data.timeline.length : 0);

        // Render Tabs Content
        renderModalSummary(data);
        renderModalContent(data);
        renderModalTimeline(data.timeline || []);

        if (showModalUI) {
            switchModalTab('summary');
            elements.articleModal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    } catch (err) {
        console.error('Error opening article modal:', err);
    }
};

function closeModal() {
    elements.articleModal.classList.remove('open');
    document.body.style.overflow = '';
    activeModalArticle = null;
}

function switchModalTab(tabName) {
    currentModalTab = tabName;
    elements.modalTabSummary.classList.toggle('active', tabName === 'summary');
    elements.modalTabContent.classList.toggle('active', tabName === 'content');
    elements.modalTabTimeline.classList.toggle('active', tabName === 'timeline');

    elements.modalSummaryView.style.display = tabName === 'summary' ? 'block' : 'none';
    elements.modalContentView.style.display = tabName === 'content' ? 'block' : 'none';
    elements.modalTimelineView.style.display = tabName === 'timeline' ? 'block' : 'none';
}

function renderModalSummary(data) {
    const summary = data.summary || (data.content ? generateQuickSummary(data.content) : 'Chưa có nội dung tóm tắt.');
    elements.modalSummaryView.innerHTML = `
        <div class="summary-box">
            <div class="summary-tag-badge">✨ AI / Smart Summary</div>
            <p style="font-size: 15px; font-weight: 500;">${escapeHtml(summary)}</p>
        </div>
    `;
}

function renderModalContent(data) {
    const content = data.content || 'Nội dung bài báo chưa được trích xuất hoặc bài viết không có văn bản.';
    const wordCount = content ? content.trim().split(/\s+/).length : 0;
    const estTimeMin = Math.ceil(wordCount / 200);

    elements.wordCountBadge.textContent = `${wordCount} từ (~${estTimeMin} phút đọc)`;
    elements.modalContentView.innerHTML = `
        <div class="article-full-content">
            ${escapeHtml(content)}
        </div>
    `;
}

function renderModalTimeline(timeline) {
    if (!timeline || timeline.length === 0) {
        elements.modalTimelineView.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⏱</div>
                <p>Chưa ghi nhận event timeline nào cho bài báo này.</p>
            </div>
        `;
        return;
    }

    elements.modalTimelineView.innerHTML = `
        <div class="timeline-list">
            ${timeline.map((evt, idx) => {
                const eventType = evt.event_type;
                const timeStr = new Date(evt.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
                const payload = evt.payload || {};
                
                let nodeColor = 'var(--accent-indigo)';
                let eventLabel = 'PAGE_ACTIVE (Đang đọc)';
                let eventIcon = '👁';

                if (eventType === 'PAGE_ENTER') {
                    nodeColor = 'var(--accent-emerald)';
                    eventLabel = 'PAGE_ENTER (Vào trang)';
                    eventIcon = '🚀';
                } else if (eventType === 'PAGE_INACTIVE') {
                    nodeColor = 'var(--accent-amber)';
                    eventLabel = 'PAGE_INACTIVE (Tạm dừng/Rời tab)';
                    eventIcon = '⏸';
                } else if (eventType === 'PAGE_LEAVE') {
                    nodeColor = 'var(--accent-rose)';
                    eventLabel = 'PAGE_LEAVE (Đóng trang/Hoàn tất)';
                    eventIcon = '🏁';
                }

                const readingTimeSec = payload.total_active_reading_time_sec ?? payload.active_reading_time_sec ?? 0;
                const scrollPercent = payload.max_scroll_percent ?? payload.scroll_percent ?? 0;
                const reason = payload.reason ? `Lý do: <em>${escapeHtml(payload.reason)}</em>` : '';

                return `
                    <div class="timeline-item">
                        <div class="timeline-node" style="--node-color: ${nodeColor}"></div>
                        <div class="timeline-card">
                            <div class="timeline-header">
                                <span class="timeline-event-name" style="--event-color: ${nodeColor}">
                                    ${eventIcon} ${eventLabel}
                                </span>
                                <span class="timeline-time">${timeStr}</span>
                            </div>
                            <div class="timeline-meta">
                                <span>⏱ Đã đọc: <strong>${formatDuration(readingTimeSec)}</strong></span>
                                <span>↕ Cuộn trang: <strong>${scrollPercent}%</strong></span>
                                ${reason ? `<span>${reason}</span>` : ''}
                                <span style="color: var(--text-muted); font-size: 11px;">Session: ${evt.session_id ? evt.session_id.substring(0, 8) + '...' : '-'}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// =====================================================
// UTILITY HELPERS
// =====================================================

function formatDuration(seconds) {
    seconds = Number(seconds) || 0;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
}

function formatDate(isoStr) {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleString('vi-VN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function generateQuickSummary(content) {
    if (!content) return '';
    const clean = content.trim().replace(/\s+/g, ' ');
    if (clean.length <= 250) return clean;
    return clean.substring(0, 250) + '...';
}

function debounce(fn, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}
