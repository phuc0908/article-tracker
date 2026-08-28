const { db } = require('./db');

console.log('\n=========================================');
console.log('🔄 Đang tiến hành xóa và làm mới cơ sở dữ liệu...');
console.log('=========================================\n');

try {
    // 1. Xóa dữ liệu các bảng
    db.exec(`
        DELETE FROM events;
        DELETE FROM articles;
        VACUUM;
    `);

    console.log('✅ Đã xóa sạch toàn bộ dữ liệu trong bảng "events" và "articles"!');
    console.log('✅ Cơ sở dữ liệu tracker.db đã được reset về trạng thái ban đầu.');
} catch (err) {
    console.error('❌ Lỗi khi reset database:', err.message);
} finally {
    process.exit(0);
}
