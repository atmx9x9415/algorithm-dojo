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

  // 公开读取 URL（无需认证）
  const RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${DB_PATH}`;
  // API URL（写入需要认证）
  const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DB_PATH}`;

  // 缓存，减少 API 调用
  let _cache = null;
  let _cacheTime = 0;
  const CACHE_TTL = 10000; // 10秒

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

  // ==================== 读取数据库 ====================

  /**
   * 从 GitHub 加载数据库（公开读取，有缓存）
   * @param {boolean} force - 是否强制刷新缓存
   */
  async function load(force) {
    const now = Date.now();
    if (!force && _cache && (now - _cacheTime) < CACHE_TTL) {
      return JSON.parse(JSON.stringify(_cache)); // 深拷贝
    }

    try {
      const res = await fetch(RAW_URL + '?t=' + now, {
        cache: 'no-cache',
      });
      if (!res.ok) {
        throw new Error('无法加载数据 (HTTP ' + res.status + ')');
      }
      const db = await res.json();
      _cache = JSON.parse(JSON.stringify(db));
      _cacheTime = now;
      return db;
    } catch (e) {
      // 如果有缓存，降级使用缓存
      if (_cache) {
        console.warn('加载失败，使用缓存数据');
        return JSON.parse(JSON.stringify(_cache));
      }
      throw e;
    }
  }

  // ==================== 写入数据库 ====================

  /**
   * 保存数据库到 GitHub（需要 Token）
   * 使用 SHA 乐观锁防止并发冲突
   * @param {object} db - 要保存的数据库对象
   */
  async function save(db) {
    if (!isLoggedIn()) {
      throw new Error('请先设置 GitHub Token');
    }

    // 1. 获取当前文件的 SHA
    let sha;
    try {
      const getRes = await fetch(API_URL + '?ref=' + BRANCH, {
        headers: authHeaders(),
        cache: 'no-cache',
      });
      if (getRes.ok) {
        const info = await getRes.json();
        sha = info.sha;
      } else if (getRes.status === 404) {
        // 文件不存在（首次）
        sha = null;
      } else {
        const err = await getRes.json().catch(function() { return {}; });
        throw new Error('获取文件信息失败: ' + (err.message || 'HTTP ' + getRes.status));
      }
    } catch (e) {
      if (e.message.indexOf('获取文件信息失败') === 0) throw e;
      throw new Error('网络错误: ' + e.message);
    }

    // 2. PUT 更新
    const content = JSON.stringify(db, null, 2);
    const body = {
      message: '✏️ 更新数据库 [Algorithm Dojo]',
      content: btoa(unescape(encodeURIComponent(content))), // UTF-8 safe base64
      branch: BRANCH,
    };
    if (sha) {
      body.sha = sha;
    }

    const putRes = await fetch(API_URL, {
      method: 'PUT',
      headers: Object.assign({}, authHeaders(), {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const errData = await putRes.json().catch(function() { return {}; });
      if (putRes.status === 409) {
        throw new Error('数据已被他人更新，请刷新页面后重试。');
      }
      if (putRes.status === 401) {
        clearToken();
        throw new Error('Token 无效或已过期，请重新登录。');
      }
      throw new Error('保存失败: ' + (errData.message || 'HTTP ' + putRes.status));
    }

    // 3. 更新缓存
    _cache = JSON.parse(JSON.stringify(db));
    _cacheTime = Date.now();
    return true;
  }

  // ==================== 验证 Token ====================

  /**
   * 验证 GitHub Token 是否有效
   */
  async function verifyToken(token) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      if (res.ok) {
        const user = await res.json();
        return { valid: true, user: user.login };
      }
      return { valid: false, error: 'Token 无效' };
    } catch (e) {
      return { valid: false, error: '网络错误: ' + e.message };
    }
  }

  // ==================== 工具方法 ====================

  /** 清除缓存（强制下次加载从远程获取） */
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
