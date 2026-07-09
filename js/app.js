/**
 * 算法道场 SPA 路由器
 */
(function() {
  'use strict';

  // ==================== 路由表 ====================
  const routes = [];

  function route(pattern, handler) {
    // 将 :param 转为正则捕获组
    const keys = [];
    const regexStr = pattern.replace(/:(\w+)/g, function(_, key) {
      keys.push(key);
      return '([^/]+)';
    });
    routes.push({
      pattern: new RegExp('^' + regexStr + '$'),
      keys: keys,
      handler: handler,
    });
  }

  // ==================== 路由匹配 ====================
  async function resolve(hash) {
    // 去掉开头的 /
    const path = hash.replace(/^#\/?/, '/').replace(/^\/$/, '/') || '/';

    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];
      const match = path.match(r.pattern);
      if (match) {
        const params = {};
        r.keys.forEach(function(key, idx) {
          params[key] = decodeURIComponent(match[idx + 1]);
        });
        try {
          await r.handler(params);
        } catch (e) {
          console.error('Route error:', e);
          renderError('页面加载失败: ' + e.message);
        }
        return;
      }
    }
    renderError('页面未找到 (404)');
  }

  // ==================== 渲染辅助 ====================
  const mainContent = document.getElementById('mainContent');

  function render(html) {
    mainContent.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function renderError(msg) {
    render('<div class="section"><div class="container"><div class="empty-state"><span class="empty-icon">⚠️</span><p>' + escapeHtml(msg) + '</p><a href="#" onclick="window.location.hash=\'/\';return false;" class="btn btn-primary">返回首页</a></div></div></div>');
  }

  // ==================== 启动 ====================
  function start() {
    // 初始加载
    const hash = window.location.hash || '#/';
    resolve(hash);

    // 监听 hash 变化
    window.addEventListener('hashchange', function() {
      const newHash = window.location.hash || '#/';
      resolve(newHash);
    });
  }

  // ==================== 注册路由 ====================

  // --- 公开页面 ---
  route('/', renderHome);
  route('/problems', renderProblems);
  route('/problems/:id', renderProblemDetail);
  route('/tags', renderTags);
  route('/tags/:name', renderTagProblems);

  // --- 管理页面 ---
  route('/admin', renderAdminLogin);
  route('/admin/dashboard', renderDashboard);
  route('/admin/problems/new', renderProblemForm);
  route('/admin/problems/:id/edit', renderProblemForm);
  route('/admin/solutions/:problemId/new', renderSolutionForm);
  route('/admin/solutions/:id/edit', renderSolutionForm);

  // --- 登出 ---
  route('/admin/logout', function() {
    DB.clearToken();
    DB.clearCache();
    window.location.hash = '#/';
  });

  // ==================== 导出全局 ====================
  window.App = {
    render: render,
    renderError: renderError,
    route: route,
    resolve: resolve,
  };

  // ==================== 工具函数 ====================

  /** HTML 转义 */
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(str).replace(/[&<>"']/g, function(c) { return map[c]; });
  }
  window.escapeHtml = escapeHtml;

  /** 难度标签 */
  function difficultyLabel(d) {
    const map = { 'Easy': '简单', 'Medium': '中等', 'Hard': '困难' };
    return map[d] || d;
  }
  window.difficultyLabel = difficultyLabel;

  /** 语言图标 */
  function langIcon(lang) {
    const icons = { 'C++': '⚡', 'Python': '🐍', 'Java': '☕', 'JavaScript': '💛', 'Go': '🔵', 'Rust': '🦀', 'TypeScript': '💙' };
    return icons[lang] || '💻';
  }
  window.langIcon = langIcon;

  /** 格式化日期 */
  function formatDate(d) {
    if (!d) return '';
    return d.substring(0, 10);
  }
  window.formatDate = formatDate;

  /** 截断文本 */
  function truncate(str, len) {
    str = String(str).replace(/<[^>]*>/g, '');
    if (str.length <= len) return str;
    return str.substring(0, len) + '...';
  }
  window.truncate = truncate;

  // DOM Ready 后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
