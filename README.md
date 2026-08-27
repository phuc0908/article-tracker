# Article Tracker

A Chrome extension and Central Server that tracks article reading sessions — including active reading time, scroll depth, and article content — across configurable news websites.

---

## System Architecture

```
article-tracker/
├── extension/             # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/background.js
│   ├── content/content.js
│   ├── popup/
│   └── options/
└── server/                # Central Server (Node.js/Express + SQLite)
    ├── package.json
    ├── server.js          # Express app (:3000)
    ├── db.js              # SQLite database manager
    ├── middleware/
    │   └── validator.js   # Event schema validation
    ├── routes/
    │   ├── events.js      # POST/GET /api/events
    │   ├── sessions.js    # GET /api/sessions, GET /api/sessions/:id
    │   └── articles.js    # GET /api/articles
    └── data/
        └── tracker.db     # SQLite database file
```

---

## Central Server REST APIs

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/events` | `POST` | Receive event from extension (validates schema, stores into SQLite) |
| `/api/events` | `GET` | Query raw event log with optional `session_id`, `url`, `event_type` filters |
| `/api/sessions` | `GET` | Query aggregated reading sessions (`limit`, `offset`, `domain`, `status`) |
| `/api/sessions/:id` | `GET` | Query specific session details with full event timeline |
| `/api/articles` | `GET` | Query unique tracked articles with aggregated reading time & session counts |
| `/api/stats` | `GET` | Overview statistics (total events, sessions, articles, reading time) |

---

## Installation & Running

### 1. Run Central Server

```bash
cd server
npm install
npm start
```
Server runs at `http://localhost:3000`.

### 2. Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder.
4. The extension will automatically track articles and sync events to the Central Server.
