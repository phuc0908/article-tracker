# Article Tracker

A Chrome extension that tracks article reading sessions — including active reading time, scroll depth, and article content — across configurable news websites.

---

## System Architecture

```
extension/
├── manifest.json          # Manifest V3 config
├── background/
│   └── background.js      # Service Worker — tab/window focus events, session storage
├── content/
│   └── content.js         # Content Script — reading timer, scroll tracking, session lifecycle
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js           # Session list UI — view, refresh, clear history
└── options/
    ├── options.html
    ├── options.css
    └── options.js         # Website management UI — add, edit, delete tracked sites
```

**Data flow:**

```
Content Script  →  chrome.runtime.sendMessage  →  Background (Service Worker)
                                                        ↓
                                               chrome.storage.local
                                                        ↑
Popup / Options  ←  chrome.runtime.sendMessage  ────────┘
```

- **Content Script** detects tab focus, page visibility, and user activity; accumulates active reading time; sends a session object on `pagehide`.
- **Background Service Worker** handles tab/window events, relays focus state to content scripts, and persists sessions in `chrome.storage.local`.
- **Popup** displays the reading history list (up to 100 sessions).
- **Options Page** manages the list of tracked websites (domain + CSS selector).

---

## Completed Features


## Limitations / Incomplete Features


## Installation

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.
4. The extension icon will appear in the toolbar.


