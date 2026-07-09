const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// 生产环境信任代理（Render 使用反向代理）
if (isProduction) {
  app.set('trust proxy', 1);
}

// ==================== 安全中间件 ====================

// Helmet 安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
    },
  },
}));

// 全局限流
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 200,
  message: '请求过于频繁，请稍后再试。',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Body 解析
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Session 配置
app.use(session({
  secret: process.env.SESSION_SECRET || 'algorithm-dojo-2026-secure-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'strict',
    maxAge: 8 * 60 * 60 * 1000, // 8小时
  },
}));

// ==================== 模板引擎 ====================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==================== 静态文件 ====================
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 全局变量 ====================
app.use((req, res, next) => {
  res.locals.isLoggedIn = !!req.session.userId;
  res.locals.isAdmin = !!req.session.isAdmin;
  res.locals.userEmail = req.session.userEmail || '';
  res.locals.currentPath = req.path;
  next();
});

// ==================== 路由 ====================
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/henshin', adminRoutes);

// ==================== 404 处理 ====================
app.use((req, res) => {
  res.status(404).render('404');
});

// ==================== 错误处理 ====================
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  console.error(err.stack);
  res.status(500).render('error', {
    message: '服务器内部错误，请稍后再试。',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

// ==================== 启动服务器 ====================
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     🦸 算法道场 Algorithm Dojo 🦸       ║');
  console.log('║     特摄风算法题解学习平台              ║');
  console.log(`║     运行端口: ${PORT}                       ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('📖 公开访问: http://localhost:' + PORT);
  console.log('🔐 管理入口: http://localhost:' + PORT + '/henshin');
});
