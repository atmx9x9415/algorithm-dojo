/**
 * 数据导入脚本 - 将 data/database.json 导入到 SQLite
 * 运行: node seed.js
 */
const fs = require('fs');
const path = require('path');
const { getDb, importDb, ensureAdmin, saveToDisk } = require('./database');

const jsonPath = path.join(__dirname, 'data', 'database.json');

async function main() {
  await getDb();

  if (!fs.existsSync(jsonPath)) {
    console.log('[Seed] data/database.json 不存在，仅创建空数据库和管理员账号');
    ensureAdmin();
    saveToDisk();
    console.log('[Seed] 完成！');
    process.exit(0);
  }

  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);

    console.log('[Seed] 读取到:');
    console.log('  - 题目:', (data.problems || []).length, '道');
    console.log('  - 标签:', (data.tags || []).length, '个');
    console.log('  - 题解:', (data.solutions || []).length, '个');
    console.log('  - 用户:', (data.users || []).length, '个');

    importDb(data);
    ensureAdmin(true); // 强制重置管理员密码为 admin123
    saveToDisk();

    console.log('[Seed] ✅ 数据导入成功！');
    console.log('[Seed] 默认管理员: admin@dojo.local / admin123');

  } catch (e) {
    console.error('[Seed] ❌ 导入失败:', e.message);
    process.exit(1);
  }
}

main();
