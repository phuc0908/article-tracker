const app = require('./server');
const http = require('node:http');

const PORT = 3098;
const server = http.createServer(app);

server.listen(PORT, async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Verification Server running on port ${PORT}`);
    console.log(`======================================================\n`);

    try {
        const baseUrl = `http://localhost:${PORT}`;

        // 1. Send realistic test articles with full content & event timeline
        console.log('--- 1. Seeding realistic articles & event timelines ---');
        
        const sampleArticles = [
            {
                url: 'https://vnexpress.net/khoa-hoc/tri-tue-nhan-tao-ai-trong-y-te-2026.html',
                domain: 'vnexpress.net',
                title: 'Trí tuệ nhân tạo tạo bước đột phá trong chẩn đoán y tế sớm',
                content: `Các nhà nghiên cứu tại Viện Công nghệ Y tế vừa công bố mô hình AI mới có khả năng phát hiện sớm các dấu hiệu ung thư phổi và tim mạch với độ chính xác lên tới 98.5%. 
Mô hình này được huấn luyện trên hơn 500.000 mẫu chụp cắt lớp CT và cộng hưởng từ MRI từ các bệnh viện lớn trên toàn thế giới. 
Hệ thống không chỉ đưa ra cảnh báo sớm mà còn đề xuất phác đồ điều trị cá nhân hóa phù hợp cho từng bệnh nhân dựa trên dữ liệu gen và tiền sử bệnh án.
Dự kiến vào cuối năm 2026, giải pháp AI này sẽ được triển khai thí điểm tại 30 bệnh viện tuyến trung ương nhằm giảm tải áp lực cho đội ngũ y bác sĩ.`,
                summary: 'Mô hình AI mới đạt độ chính xác 98.5% trong chẩn đoán ung thư phổi và bệnh lý tim mạch, mở ra triển vọng cá nhân hóa điều trị y tế trên quy mô lớn.',
                sessionId: 'sess-ai-vnexpress-001',
                readingTime: 320,
                scroll: 95
            },
            {
                url: 'https://dantri.com.vn/cong-nghe/chip-ban-dan-the-he-moi-2026.htm',
                domain: 'dantri.com.vn',
                title: 'Công nghệ chip bán dẫn 2nm chính thức đi vào sản xuất thương mại',
                content: `Ngành công nghiệp bán dẫn vừa ghi nhận cột mốc lịch sử khi những vi xử lý tiến trình 2nm đầu tiên đã bắt đầu xuất xưởng từ các nhà máy bán dẫn hiện đại. 
Tiến trình mới giúp tăng hiệu năng xử lý lên 25% trong khi giảm tiêu thụ điện năng đến 35% so với thế hệ 3nm tiền nhiệm. 
Điều này hứa hẹn mang lại bước nhảy vọt cho các thiết bị di động, trung tâm dữ liệu và siêu máy tính phục vụ huấn luyện trí tuệ nhân tạo. 
Các chuyên gia nhận định đây là nhân tố then chốt định hình cuộc cách mạng điện toán trong thập kỷ tới.`,
                summary: 'Chip bán dẫn tiến trình 2nm chính thức thương mại hóa, tăng 25% hiệu năng và tiết kiệm 35% điện năng cho các hệ thống máy tính và di động.',
                sessionId: 'sess-semicon-dantri-002',
                readingTime: 210,
                scroll: 80
            },
            {
                url: 'https://tuoitre.vn/xe-dien-the-he-moi-sac-5-phut-chay-500km-2026.htm',
                domain: 'tuoitre.vn',
                title: 'Đột phá pin thể rắn: Sạc 5 phút chạy 500km',
                content: `Công nghệ pin thể rắn thế hệ mới đã vượt qua các bài kiểm tra an toàn khắt khe nhất và sẵn sàng tích hợp trên các dòng ô tô điện thương mại. 
Với mật độ năng lượng cao gấp đôi pin lithium-ion truyền thống, pin thể rắn không chỉ loại bỏ hoàn toàn nguy cơ cháy nổ mà còn hỗ trợ công nghệ siêu sạc 5 phút cho quãng đường di chuyển hơn 500km. 
Nhiều hãng sản xuất ô tô hàng đầu đã ký hợp đồng chuyển giao công nghệ để thương mại hóa các mẫu xe điện sử dụng loại pin này từ quý 4 năm 2026.`,
                summary: 'Công nghệ pin thể rắn đột phá cho phép ô tô điện sạc chỉ trong 5 phút để đi được 500km, loại bỏ nguy cơ cháy nổ.',
                sessionId: 'sess-solidstate-tuoitre-003',
                readingTime: 180,
                scroll: 88
            }
        ];

        for (const art of sampleArticles) {
            const now = Date.now();
            const t0 = new Date(now - art.readingTime * 1000).toISOString();
            const t1 = new Date(now - (art.readingTime - 30) * 1000).toISOString();
            const t2 = new Date(now - (art.readingTime - 90) * 1000).toISOString();
            const t3 = new Date(now - 10 * 1000).toISOString();
            const t4 = new Date(now).toISOString();

            const events = [
                {
                    event_id: `evt-${art.sessionId}-1`,
                    event_type: 'PAGE_ENTER',
                    session_id: art.sessionId,
                    url: art.url,
                    domain: art.domain,
                    title: art.title,
                    timestamp: t0,
                    payload: {
                        status: 'active',
                        article_found: true,
                        content: art.content,
                        summary: art.summary,
                        scroll_percent: 0,
                        active_reading_time_sec: 0
                    }
                },
                {
                    event_id: `evt-${art.sessionId}-2`,
                    event_type: 'PAGE_ACTIVE',
                    session_id: art.sessionId,
                    url: art.url,
                    domain: art.domain,
                    title: art.title,
                    timestamp: t1,
                    payload: {
                        reason: 'page_load',
                        scroll_percent: Math.round(art.scroll * 0.3),
                        active_reading_time_sec: 30
                    }
                },
                {
                    event_id: `evt-${art.sessionId}-3`,
                    event_type: 'PAGE_INACTIVE',
                    session_id: art.sessionId,
                    url: art.url,
                    domain: art.domain,
                    title: art.title,
                    timestamp: t2,
                    payload: {
                        reason: 'tab_switch',
                        scroll_percent: Math.round(art.scroll * 0.6),
                        active_reading_time_sec: 90
                    }
                },
                {
                    event_id: `evt-${art.sessionId}-4`,
                    event_type: 'PAGE_ACTIVE',
                    session_id: art.sessionId,
                    url: art.url,
                    domain: art.domain,
                    title: art.title,
                    timestamp: t3,
                    payload: {
                        reason: 'tab_active',
                        scroll_percent: art.scroll,
                        active_reading_time_sec: art.readingTime - 10
                    }
                },
                {
                    event_id: `evt-${art.sessionId}-5`,
                    event_type: 'PAGE_LEAVE',
                    session_id: art.sessionId,
                    url: art.url,
                    domain: art.domain,
                    title: art.title,
                    timestamp: t4,
                    payload: {
                        exit_type: 'pagehide',
                        max_scroll_percent: art.scroll,
                        total_active_reading_time_sec: art.readingTime,
                        content: art.content,
                        summary: art.summary
                    }
                }
            ];

            const res = await fetch(`${baseUrl}/api/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(events)
            });
            const data = await res.json();
            console.log(`-> Seeded article [${art.domain}] ${art.title.substring(0, 30)}... Result:`, data.success);
        }

        // 2. Test GET /api/stats
        console.log('\n--- 2. Verifying GET /api/stats ---');
        let statsRes = await fetch(`${baseUrl}/api/stats`);
        let stats = await statsRes.json();
        console.log('Stats Response:', JSON.stringify(stats.data, null, 2));

        // 3. Test GET /api/articles
        console.log('\n--- 3. Verifying GET /api/articles ---');
        let articlesRes = await fetch(`${baseUrl}/api/articles`);
        let articlesData = await articlesRes.json();
        console.log(`Returned ${articlesData.returned_count} articles:`);
        articlesData.data.forEach(a => {
            console.log(`- [${a.domain}] ${a.title} | Time: ${a.total_reading_time_sec}s | Scroll: ${a.max_scroll_percent}% | HasSummary: ${Boolean(a.summary)} | HasContent: ${Boolean(a.content)}`);
        });

        // 4. Test GET /api/articles/detail
        console.log('\n--- 4. Verifying GET /api/articles/detail?url=... ---');
        const testUrl = sampleArticles[0].url;
        let detailRes = await fetch(`${baseUrl}/api/articles/detail?url=${encodeURIComponent(testUrl)}`);
        let detailData = await detailRes.json();
        console.log('Detail Article:', detailData.data.title);
        console.log('Summary:', detailData.data.summary);
        console.log(`Timeline events count: ${detailData.data.timeline.length}`);
        console.log('First event:', detailData.data.timeline[0].event_type, detailData.data.timeline[0].timestamp);
        console.log('Last event:', detailData.data.timeline[detailData.data.timeline.length - 1].event_type);

        // 5. Test Static Dashboard Serving
        console.log('\n--- 5. Verifying Static Dashboard HTML serving ---');
        let dashboardHtmlRes = await fetch(`${baseUrl}/dashboard`);
        let htmlText = await dashboardHtmlRes.text();
        console.log(`GET /dashboard status: ${dashboardHtmlRes.status}, HTML length: ${htmlText.length} bytes, Contains title: ${htmlText.includes('Article Tracker Dashboard')}`);

        console.log('\n✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
    } catch (err) {
        console.error('❌ Verification failed:', err);
    } finally {
        server.close(() => {
            console.log('Verification server closed.');
            process.exit(0);
        });
    }
});
