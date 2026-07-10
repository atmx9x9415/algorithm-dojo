/**
 * 算法道场 - Express 服务器
 */
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { getDb, exportDb, importDb, getUserByEmail, ensureAdmin, saveToDisk } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'algorithm-dojo-secret-' + Math.random().toString(36).substring(2);

// ==================== 中间件 ====================

app.use(express.json({ limit: '10mb' }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// ==================== 管理员认证中间件 ====================

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: '请先登录管理员账号' });
}

// ==================== API 路由 ====================

// 检查登录状态
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({
      loggedIn: true,
      user: { id: req.session.userId, email: req.session.email }
    });
  }
  return res.json({ loggedIn: false });
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' });
  }

  await getDb();
  const user = getUserByEmail(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }

  if (!user.is_admin) {
    return res.status(403).json({ error: '此账号不是管理员' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }

  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.isAdmin = true;

  console.log('[Auth] 管理员登录:', user.email);
  return res.json({ success: true, user: { id: user.id, email: user.email } });
});

// 登出
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: '登出失败' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

// 获取完整数据库（公开读取）
app.get('/api/db', async (req, res) => {
  try {
    await getDb();
    const data = exportDb();
    // 移除敏感信息
    if (data.users) {
      data.users = data.users.map(u => ({
        id: u.id,
        email: u.email,
        is_admin: u.is_admin,
        created_at: u.created_at
      }));
    }
    res.json(data);
  } catch (e) {
    console.error('[API] GET /api/db 错误:', e);
    res.status(500).json({ error: '数据库读取失败: ' + e.message });
  }
});

// 保存完整数据库（管理员专用）
app.put('/api/db', requireAdmin, async (req, res) => {
  try {
    await getDb();
    const data = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: '无效的数据格式' });
    }

    // 保护 users 表 — 不允许通过此接口修改用户
    const existingDb = exportDb();
    if (data.users) {
      data.users = existingDb.users.map(u => ({
        id: u.id,
        email: u.email,
        password_hash: u.password_hash,
        is_admin: u.is_admin,
        created_at: u.created_at
      }));
    }

    importDb(data);
    saveToDisk();
    console.log('[API] 数据库已保存');
    res.json({ success: true });
  } catch (e) {
    console.error('[API] PUT /api/db 错误:', e);
    res.status(500).json({ error: '数据库保存失败: ' + e.message });
  }
});

// 修改密码
app.post('/api/auth/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '请输入当前密码和新密码' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少 6 位' });
  }

  await getDb();
  const user = getUserByEmail(req.session.email);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: '当前密码错误' });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  const stmt = (await getDb()).prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  stmt.bind([newHash, req.session.userId]);
  stmt.step();
  stmt.free();
  saveToDisk();

  return res.json({ success: true, message: '密码已修改' });
});

// ==================== 静态文件 ====================

app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

// SPA 回退
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API 端点不存在' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== 启动服务器 ====================

async function start() {
  await getDb();
  ensureAdmin();

  app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║   📖 算法道场 Algorithm Dojo       ║');
    console.log('║   服务器已启动                      ║');
    console.log('║   地址: http://localhost:' + String(PORT).padEnd(13) + '║');
    console.log('║   管理: http://localhost:' + String(PORT).padEnd(7) + '#/admin ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log('[Server] 默认管理员: admin@dojo.local / admin123');
    console.log('[Server] 请尽快修改默认密码！');
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
