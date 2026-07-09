/**
 * 算法道场 - GitHub API 数据层
 * 使用 GitHub Contents API 读写 database.json
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

  function getToken() {
    return localStorage.getItem('gh_token') || '';
  }

  function setToken(token) {
    localStorage.setItem('gh_token', token);
  }

  function clearToken() {
    localStorage.removeItem('gh_token');
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function authHeaders() {
    return {
      'Authorization': 'token ' + getToken(),
      'Accept': 'application/vnd.github.v3+json',
    };
  }

  // ==================== Base64 编码（UTF-8 安全） ====================

  function encodeBase64(str) {
    // 使用 TextEncoder 正确处理 UTF-8 → 字节 → base64
    var bytes = new TextEncoder().encode(str);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // ==================== 读取数据库 ====================

  async function load(force) {
    var now = Date.now();
    if (!force && _cache && (now - _cacheTime) < CACHE_TTL) {
      return JSON.parse(JSON.stringify(_cache));
    }

    try {
      var res = await fetch(RAW_URL + '?t=' + now, { cache: 'no-cache' });
      if (!res.ok) {
        throw new Error('无法加载数据 (HTTP ' + res.status + ')');
      }
      var db = await res.json();
      _cache = JSON.parse(JSON.stringify(db));
      _cacheTime = now;
      return db;
    } catch (e) {
      if (_cache) {
        console.warn('加载失败，使用缓存数据');
        return JSON.parse(JSON.stringify(_cache));
      }
      throw e;
    }
  }

  // ==================== 写入数据库 ====================

  async function save(db) {
    if (!isLoggedIn()) {
      throw new Error('请先设置 GitHub Token');
    }

    console.log('[DB] 开始保存...');

    // 1. 获取当前文件 SHA
    var sha;
    try {
      var getRes = await fetch(API_URL + '?ref=' + BRANCH, {
        headers: authHeaders(),
        cache: 'no-cache',
      });
      if (getRes.ok) {
        var info = await getRes.json();
        sha = info.sha;
        console.log('[DB] 获取 SHA 成功:', sha.substring(0, 8) + '...');
      } else if (getRes.status === 404) {
        sha = null;
        console.log('[DB] 文件不存在，将创建新文件');
      } else {
        var errData = await getRes.json().catch(function() { return {}; });
        throw new Error('获取文件信息失败 (HTTP ' + getRes.status + '): ' + (errData.message || ''));
      }
    } catch (e) {
      if (e.message.indexOf('获取文件信息失败') === 0) throw e;
      throw new Error('网络错误: ' + e.message);
    }

    // 2. PUT 更新
    var content = JSON.stringify(db, null, 2);
    var base64Content = encodeBase64(content);
    console.log('[DB] 数据大小: ' + content.length + ' 字符, base64: ' + base64Content.length + ' 字符');

    var body = {
      message: 'Update database [Algorithm Dojo]',
      content: base64Content,
      branch: BRANCH,
    };
    if (sha) {
      body.sha = sha;
    }

    console.log('[DB] 发送 PUT 请求...');
    var putRes = await fetch(API_URL, {
      method: 'PUT',
      headers: Object.assign({}, authHeaders(), {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      var errData = await putRes.json().catch(function() { return {}; });
      console.error('[DB] PUT 失败:', putRes.status, errData);
      if (putRes.status === 409) {
        throw new Error('数据已被他人更新，请刷新页面后重试。');
      }
      if (putRes.status === 401 || putRes.status === 403) {
        clearToken();
        throw new Error('Token 权限不足或已过期。请重新生成一个有 repo 权限的 Token。');
      }
      if (putRes.status === 422) {
        throw new Error('保存失败 (422): ' + (errData.message || '数据校验失败，请检查内容'));
      }
      throw new Error('保存失败 (HTTP ' + putRes.status + '): ' + (errData.message || ''));
    }

    var result = await putRes.json();
    console.log('[DB] 保存成功！新 SHA:', (result.content && result.content.sha || 'N/A').substring(0, 8) + '...');

    // 3. 更新缓存
    _cache = JSON.parse(JSON.stringify(db));
    _cacheTime = Date.now();
    return true;
  }

  // ==================== 验证 Token ====================

  async function verifyToken(token) {
    try {
      var res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      if (res.ok) {
        var user = await res.json();
        return { valid: true, user: user.login };
      }
      // 检查 token 权限
      var res2 = await fetch('https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME, {
        headers: {
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      if (res2.ok) {
        var repoInfo = await res2.json();
        return { valid: true, user: repoInfo.owner.login, repoAccess: true };
      }
      return { valid: false, error: 'Token 无效或没有仓库访问权限' };
    } catch (e) {
      return { valid: false, error: '网络错误: ' + e.message };
    }
  }

  // ==================== 工具方法 ====================

  function clearCache() {
    _cache = null;
    _cacheTime = 0;
  }

  return {
    load: load,
    save: save,
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    isLoggedIn: isLoggedIn,
    verifyToken: verifyToken,
    clearCache: clearCache,
    RAW_URL: RAW_URL,
    API_URL: API_URL,
  };
})();
