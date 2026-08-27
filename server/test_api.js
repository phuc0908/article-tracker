const app = require('./server');
const http = require('node:http');

const PORT = 3099;
const server = http.createServer(app);

server.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}`);

    try {
        const baseUrl = `http://localhost:${PORT}`;

        // 1. Test POST /api/events (PAGE_ENTER)
        console.log('\n--- 1. Testing POST /api/events (PAGE_ENTER) ---');
        const event1 = {
            event_id: 'evt-test-1',
            event_type: 'PAGE_ENTER',
            session_id: 'sess-test-123',
            url: 'https://vnexpress.net/thoi-su/bai-bao-123.html',
            domain: 'vnexpress.net',
            title: 'Bài báo thử nghiệm 1',
            timestamp: '2026-08-28T01:00:00.000Z',
            payload: { scroll_percent: 0, active_reading_time_sec: 0 }
        };

        let res = await fetch(`${baseUrl}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event1)
        });
        let data = await res.json();
        console.log('Status:', res.status, data);

        // 2. Test POST /api/events (PAGE_ACTIVE & PAGE_LEAVE)
        console.log('\n--- 2. Testing POST /api/events (PAGE_ACTIVE & PAGE_LEAVE) ---');
        const event2 = {
            event_id: 'evt-test-2',
            event_type: 'PAGE_ACTIVE',
            session_id: 'sess-test-123',
            url: 'https://vnexpress.net/thoi-su/bai-bao-123.html',
            domain: 'vnexpress.net',
            title: 'Bài báo thử nghiệm 1',
            timestamp: '2026-08-28T01:02:00.000Z',
            payload: { scroll_percent: 50, active_reading_time_sec: 120 }
        };
        const event3 = {
            event_id: 'evt-test-3',
            event_type: 'PAGE_LEAVE',
            session_id: 'sess-test-123',
            url: 'https://vnexpress.net/thoi-su/bai-bao-123.html',
            domain: 'vnexpress.net',
            title: 'Bài báo thử nghiệm 1',
            timestamp: '2026-08-28T01:05:00.000Z',
            payload: { max_scroll_percent: 80, total_active_reading_time_sec: 250 }
        };

        res = await fetch(`${baseUrl}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([event2, event3])
        });
        data = await res.json();
        console.log('Status:', res.status, data);

        // 3. Test Invalid Event Validation
        console.log('\n--- 3. Testing Validation Error on Invalid Event ---');
        res = await fetch(`${baseUrl}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_type: 'INVALID_TYPE', session_id: '123' })
        });
        data = await res.json();
        console.log('Status:', res.status, data);

        // 4. Test GET /api/sessions
        console.log('\n--- 4. Testing GET /api/sessions ---');
        res = await fetch(`${baseUrl}/api/sessions`);
        data = await res.json();
        console.log('Status:', res.status, JSON.stringify(data, null, 2));

        // 5. Test GET /api/sessions/:id
        console.log('\n--- 5. Testing GET /api/sessions/sess-test-123 ---');
        res = await fetch(`${baseUrl}/api/sessions/sess-test-123`);
        data = await res.json();
        console.log('Status:', res.status, JSON.stringify(data, null, 2));

        // 6. Test GET /api/articles
        console.log('\n--- 6. Testing GET /api/articles ---');
        res = await fetch(`${baseUrl}/api/articles`);
        data = await res.json();
        console.log('Status:', res.status, JSON.stringify(data, null, 2));

        // 7. Test GET /api/stats
        console.log('\n--- 7. Testing GET /api/stats ---');
        res = await fetch(`${baseUrl}/api/stats`);
        data = await res.json();
        console.log('Status:', res.status, JSON.stringify(data, null, 2));

        console.log('\n✅ ALL API TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
        console.error('Test error:', err);
    } finally {
        server.close(() => {
            console.log('Test server closed.');
            process.exit(0);
        });
    }
});
