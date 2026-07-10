/**
 * 算法道场 - 数据层（调用后端 API）
 */
const DB = (function() {
  'use strict';

  var _cache = null;
  var _cacheTime = 0;
  var CACHE_TTL = 3000;

  // ==================== 认证管理 ====================

  function isLoggedIn() {
    // 同步检查：使用 _loggedIn 标志（在 checkAuth 后设置）
    return !!sessionStorage.getItem('dojo_logged_in');
  }

  async function checkAuth() {
    try {
      var res = await fetch('/api/auth/me', { cache: 'no-cache' });
      if (res.ok) {
        var data = await res.json();
        if (data.loggedIn) {
          sessionStorage.setItem('dojo_logged_in', '1');
          return true;
        }
      }
      sessionStorage.removeItem('dojo_logged_in');
      return false;
    } catch (e) {
      sessionStorage.removeItem('dojo_logged_in');
      return false;
    }
  }

  async function login(email, password) {
    var res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });
    var data = await res.json();
    if (res.ok && data.success) {
      sessionStorage.setItem('dojo_logged_in', '1');
      return { valid: true, user: data.user.email };
    }
    return { valid: false, error: data.error || '登录失败' };
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    sessionStorage.removeItem('dojo_logged_in');
    clearCache();
  }

  // ==================== Token 兼容（保留接口以便旧代码不报错） ====================

  function getToken() { return sessionStorage.getItem('dojo_logged_in') || ''; }
  function setToken(t) { sessionStorage.setItem('dojo_logged_in', '1'); }
  function clearToken() { sessionStorage.removeItem('dojo_logged_in'); }

  async function verifyToken(token) {
    // 兼容旧代码，调用 login 接口
    return await checkAuth();
  }

  // ==================== 数据读取 ====================

  async function load(force) {
    var now = Date.now();
    if (!force && _cache && (now - _cacheTime) < CACHE_TTL) {
      return JSON.parse(JSON.stringify(_cache));
    }
    try {
      var res = await fetch('/api/db?t=' + now, { cache: 'no-cache' });
      if (!res.ok) throw new Error('无法加载数据 (HTTP ' + res.status + ')');
      var db = await res.json();
      _cache = JSON.parse(JSON.stringify(db));
      _cacheTime = now;
      return db;
    } catch (e) {
      if (_cache) { console.warn('[DB] 加载失败，用缓存'); return JSON.parse(JSON.stringify(_cache)); }
      throw e;
    }
  }

  // ==================== 数据写入 ====================

  async function save(arg) {
    if (!isLoggedIn()) throw new Error('请先登录管理员账号');

    var dbToSave;
    if (typeof arg === 'function') {
      // 先加载最新数据，再应用修改
      var currentDb = await load(true);
      arg(currentDb);
      dbToSave = currentDb;
    } else {
      dbToSave = arg;
    }

    var res = await fetch('/api/db', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbToSave)
    });

    if (res.ok) {
      var result = await res.json();
      console.log('[DB] ✅ 保存成功!');
      _cache = JSON.parse(JSON.stringify(dbToSave));
      _cacheTime = Date.now();
      return true;
    }

    if (res.status === 401) {
      sessionStorage.removeItem('dojo_logged_in');
      throw new Error('登录已过期，请重新登录');
    }

    var err = await res.json().catch(function() { return {}; });
    throw new Error('保存失败 HTTP' + res.status + ': ' + (err.error || '未知错误'));
  }

  function clearCache() { _cache = null; _cacheTime = 0; }

  // ==================== 密码修改 ====================

  async function changePassword(currentPassword, newPassword) {
    var res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword })
    });
    var data = await res.json();
    if (res.ok) {
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error };
  }

  // 初始化：启动时检查登录状态
  checkAuth();

  return {
    load: load,
    save: save,
    login: login,
    logout: logout,
    changePassword: changePassword,
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    isLoggedIn: isLoggedIn,
    verifyToken: verifyToken,
    clearCache: clearCache,
    checkAuth: checkAuth
  };
})();
