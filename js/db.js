/**
 * 算法道场 - GitHub API 数据层
 * 支持自动 SHA 冲突重试
 */
const DB = (function() {
  'use strict';

  const REPO_OWNER = 'atmx9x9415';
  const REPO_NAME = 'algorithm-dojo';
  const DB_PATH = 'data/database.json';
  const BRANCH = 'main';

  const RAW_URL = 'https://raw.githubusercontent.com/' + REPO_OWNER + '/' + REPO_NAME + '/' + BRANCH + '/' + DB_PATH;
  const API_URL = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + DB_PATH;

  var _cache = null;
  var _cacheTime = 0;
  var CACHE_TTL = 3000;

  // ==================== Token 管理 ====================

  function getToken() { return localStorage.getItem('gh_token') || ''; }
  function setToken(t) { localStorage.setItem('gh_token', t); }
  function clearToken() { localStorage.removeItem('gh_token'); }
  function isLoggedIn() { return !!getToken(); }
  function authHeaders() {
    return {
      'Authorization': 'token ' + getToken(),
      'Accept': 'application/vnd.github.v3+json',
    };
  }

  // ==================== 编码工具 ====================

  function encodeBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function decodeBase64(str) {
    var clean = String(str).replace(/\s/g, '');
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  // ==================== 读取 ====================

  async function load(force) {
    var now = Date.now();
    if (!force && _cache && (now - _cacheTime) < CACHE_TTL) {
      return JSON.parse(JSON.stringify(_cache));
    }
    try {
      var res = await fetch(RAW_URL + '?t=' + now, { cache: 'no-cache' });
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

  // ==================== 写入（核心：自动处理 409 冲突重试） ====================

  /**
   * 保存数据库到 GitHub
   * @param {function|object} arg - 修改函数 function(db){...} 或数据库对象
   *   推荐使用函数：DB.save(function(db) { db.problems.push(...); })
   *   也兼容对象：DB.save(newDbObject)
   */
  async function save(arg) {
    if (!isLoggedIn()) throw new Error('请先设置 GitHub Token');

    // 统一为修改函数
    var mutateFn;
    if (typeof arg === 'function') {
      mutateFn = arg;
    } else {
      mutateFn = function(db) { Object.keys(arg).forEach(function(k) { db[k] = arg[k]; }); };
    }

    var maxRetries = 5;
    var lastError = null;

    for (var attempt = 0; attempt < maxRetries; attempt++) {
      console.log('[DB] 保存 #' + (attempt + 1) + '...');

      var sha, currentDb;

      try {
        // 1. 拉取最新数据和 SHA
        var getRes = await fetch(API_URL + '?ref=' + BRANCH + '&t=' + Date.now(), {
          headers: authHeaders(), cache: 'no-cache',
        });
        if (getRes.ok) {
          var info = await getRes.json();
          sha = info.sha;
          currentDb = JSON.parse(decodeBase64(info.content));
          console.log('[DB]  SHA=' + sha.substring(0, 8) + '...');
        } else if (getRes.status === 404) {
          sha = null;
          currentDb = { problems: [], tags: [], problem_tags: [], solutions: [], nextId: { problems: 1, tags: 1, solutions: 1 } };
          console.log('[DB]  新文件');
        } else {
          var e1 = await getRes.json().catch(function(){ return {}; });
          throw new Error('获取失败 HTTP' + getRes.status + ': ' + (e1.message||''));
        }
      } catch (e) {
        if (e.message.indexOf('获取失败') === 0) throw e;
        throw new Error('网络错误: ' + e.message);
      }

      // 2. 应用修改
      mutateFn(currentDb);

      // 3. PUT
      var content = JSON.stringify(currentDb, null, 2);
      var body = { message: 'Update [Algorithm Dojo]', content: encodeBase64(content), branch: BRANCH };
      if (sha) body.sha = sha;

      var putRes = await fetch(API_URL, {
        method: 'PUT',
        headers: Object.assign({}, authHeaders(), { 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });

      if (putRes.ok) {
        var result = await putRes.json();
        console.log('[DB] ✅ 成功! SHA=' + (result.content.sha||'').substring(0,8));
        _cache = JSON.parse(JSON.stringify(currentDb));
        _cacheTime = Date.now();
        return true;
      }

      // 处理错误
      if (putRes.status === 409) {
        console.warn('[DB] 冲突，重试...');
        lastError = new Error('冲突重试 #' + (attempt+1));
        await sleep(300 + Math.random() * 400);
        continue;
      }

      var e2 = await putRes.json().catch(function(){ return {}; });
      if (putRes.status === 401 || putRes.status === 403) { clearToken(); throw new Error('Token 过期，请重新登录'); }
      throw new Error('保存失败 HTTP' + putRes.status + ': ' + (e2.message||''));
    }
    throw new Error('保存失败：重试 ' + maxRetries + ' 次仍有冲突。请刷新页面后重试。');
  }

  // ==================== 验证 Token ====================

  async function verifyToken(token) {
    try {
      var res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' },
      });
      if (res.ok) { var u = await res.json(); return { valid: true, user: u.login }; }
      return { valid: false, error: 'Token 无效' };
    } catch (e) {
      return { valid: false, error: '网络错误: ' + e.message };
    }
  }

  function clearCache() { _cache = null; _cacheTime = 0; }

  return {
    load: load, save: save,
    getToken: getToken, setToken: setToken, clearToken: clearToken,
    isLoggedIn: isLoggedIn, verifyToken: verifyToken, clearCache: clearCache,
    RAW_URL: RAW_URL, API_URL: API_URL,
  };
})();
