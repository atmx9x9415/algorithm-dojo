/**
 * 管理仪表盘 - 题目列表、标签管理 + API 诊断
 */
async function renderDashboard() {
  if (!DB.isLoggedIn()) {
    window.location.hash = '#/admin';
    return;
  }

  const db = await DB.load();
  const problems = (db.problems || []).map(function(p) { return enrichProblem(db, p); })
    .sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  const tags = getTagsWithCount(db);
  const stats = getStats(db);

  App.render(`
    <section class="section">
      <div class="container">
        <div class="admin-header">
          <div class="admin-header-left">
            <h1 class="page-title">管理面板</h1>
            <p>
              <strong>Token 已认证</strong>
              <a href="#/admin/logout" class="admin-logout-link" style="margin-left:12px;">退出登录</a>
            </p>
          </div>
          <div class="admin-stats-mini">
            <span class="stat-badge">📝 ${problems.length} 题</span>
            <span class="stat-badge">🏷️ ${tags.length} 标签</span>
            <span class="stat-badge">💾 <span id="dbSize">-</span></span>
          </div>
        </div>

        <div class="admin-actions">
          <a href="#/admin/problems/new" class="btn btn-primary">+ 添加题目</a>
          <button class="btn btn-outline" onclick="showAddTag()">+ 新建标签</button>
          <button class="btn btn-outline" onclick="refreshDashboard()">🔄 刷新</button>
          <button class="btn btn-outline" onclick="testAPIConnection()" id="btnTestAPI">🔧 测试 API</button>
        </div>

        <!-- API 测试结果区 -->
        <div id="testResults" style="display:none;margin-bottom:16px;"></div>

        ${problems.length === 0 ? '<div class="empty-state"><span class="empty-icon">📭</span><p>还没有题目，<a href="#/admin/problems/new">去添加第一道吧</a>！</p></div>' : `
        <div class="admin-table-wrapper">
          <h2>📋 全部题目</h2>
          <div class="admin-table-scroll">
            <table class="admin-table">
              <thead><tr><th>ID</th><th>标题</th><th>难度</th><th>标签</th><th>作者</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                ${problems.map(function(p) {
                  const tNames = splitTags(p.tag_names);
                  const tColors = splitTags(p.tag_colors);
                  return '<tr>' +
                    '<td>' + p.id + '</td>' +
                    '<td class="td-title"><a href="#/problems/' + p.id + '">' + escapeHtml(p.title) + '</a></td>' +
                    '<td><span class="difficulty-badge difficulty-' + p.difficulty.toLowerCase() + '">' + difficultyLabel(p.difficulty) + '</span></td>' +
                    '<td>' + tNames.map(function(name, i) {
                      return '<span class="tag tag-sm" style="background:' + escapeHtml(tColors[i] || '#00b894') + '20;color:' + escapeHtml(tColors[i] || '#00b894') + ';border:1px solid ' + escapeHtml(tColors[i] || '#00b894') + '40;">' + escapeHtml(name) + '</span>';
                    }).join('') + '</td>' +
                    '<td class="td-author">' + escapeHtml(p.author_email || '未知') + '</td>' +
                    '<td>' + formatDate(p.created_at) + '</td>' +
                    '<td class="td-actions">' +
                      '<a href="#/admin/problems/' + p.id + '/edit" class="btn btn-sm btn-outline">编辑</a>' +
                      '<a href="#/admin/solutions/' + p.id + '/new" class="btn btn-sm btn-outline">+题解</a>' +
                      '<button class="btn btn-sm btn-danger-outline" onclick="deleteProblem(' + p.id + ')">删除</button>' +
                    '</td>' +
                  '</tr>';
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`}

        <div class="admin-table-wrapper" style="margin-top:28px;">
          <h2>🏷️ 标签管理</h2>
          <div class="admin-table-scroll">
            <table class="admin-table">
              <thead><tr><th>ID</th><th>颜色</th><th>名称</th><th>题目数</th><th>操作</th></tr></thead>
              <tbody>
                ${tags.map(function(t) {
                  return '<tr>' +
                    '<td>' + t.id + '</td>' +
                    '<td><span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:' + escapeHtml(t.color) + ';"></span></td>' +
                    '<td style="font-weight:600;">' + escapeHtml(t.name) + '</td>' +
                    '<td>' + t.problem_count + '</td>' +
                    '<td><button class="btn btn-sm btn-danger-outline" onclick="deleteTag(' + t.id + ', \'' + escapeHtml(t.name).replace(/'/g, "\\'") + '\')">删除</button></td>' +
                  '</tr>';
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 手动保存按钮 -->
        <div style="margin-top:24px;padding:16px;background:var(--bg-alt);border-radius:var(--radius);text-align:center;">
          <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:8px;">
            ⚠️ 如果自动保存失败，先用下方按钮手动保存当前数据
          </p>
          <button class="btn btn-primary" onclick="manualSave()" id="btnManualSave">💾 手动保存数据</button>
          <span id="saveStatus" style="margin-left:12px;font-size:0.9rem;"></span>
        </div>
      </div>
    </section>
  `);

  // 显示数据库大小
  setTimeout(function() {
    var el = document.getElementById('dbSize');
    if (el) el.textContent = JSON.stringify(db).length + 'B';
  }, 100);
}

// ==================== 手动保存 ====================
async function manualSave() {
  var btn = document.getElementById('btnManualSave');
  var status = document.getElementById('saveStatus');
  btn.disabled = true;
  btn.textContent = '⏳ 保存中...';
  status.textContent = '';
  status.style.color = '';

  try {
    var db = await DB.load(true); // 强制刷新
    status.textContent = '已加载最新数据，正在保存...';
    var ok = await DB.save(db);
    if (ok) {
      status.textContent = '✅ 保存成功！';
      status.style.color = 'var(--primary)';
      btn.textContent = '💾 手动保存数据';
      btn.disabled = false;
      showToast('✅ 数据已保存到 GitHub', 'success');
    }
  } catch (e) {
    status.textContent = '❌ ' + e.message;
    status.style.color = 'var(--accent-red)';
    btn.textContent = '💾 重试保存';
    btn.disabled = false;
    showToast('❌ 保存失败: ' + e.message, 'error');
  }
}

// ==================== API 诊断 ====================
async function testAPIConnection() {
  var resultDiv = document.getElementById('testResults');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div class="alert alert-info">🔍 正在测试 API 连接...</div>';

  var results = [];
  var token = DB.getToken();

  // Test 1: Token
  results.push('<h3>📋 API 诊断报告</h3>');
  results.push('<p><strong>Token:</strong> ' + token.substring(0, 8) + '...' + token.substring(token.length - 4) + '</p>');

  // Test 2: Verify user
  try {
    var userRes = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (userRes.ok) {
      var user = await userRes.json();
      results.push('<p style="color:green;">✅ 用户验证: ' + user.login + '</p>');
    } else {
      results.push('<p style="color:red;">❌ 用户验证失败: HTTP ' + userRes.status + '</p>');
    }
  } catch(e) {
    results.push('<p style="color:red;">❌ 用户验证异常: ' + e.message + '</p>');
  }

  // Test 3: Verify repo access
  try {
    var repoRes = await fetch('https://api.github.com/repos/atmx9x9415/algorithm-dojo', {
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (repoRes.ok) {
      var repo = await repoRes.json();
      results.push('<p style="color:green;">✅ 仓库访问: ' + repo.full_name + ' (权限: ' + (repo.permissions ? (repo.permissions.push ? '可写' : '只读') : '未知') + ')</p>');
    } else {
      results.push('<p style="color:red;">❌ 仓库访问失败: HTTP ' + repoRes.status + '</p>');
    }
  } catch(e) {
    results.push('<p style="color:red;">❌ 仓库访问异常: ' + e.message + '</p>');
  }

  // Test 4: Get file SHA
  var sha = null;
  try {
    var apiUrl = 'https://api.github.com/repos/atmx9x9415/algorithm-dojo/contents/data/database.json?ref=main';
    var fileRes = await fetch(apiUrl, {
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (fileRes.ok) {
      var fileInfo = await fileRes.json();
      sha = fileInfo.sha;
      results.push('<p style="color:green;">✅ 获取文件 SHA: ' + sha.substring(0, 10) + '... (大小: ' + fileInfo.size + ' bytes)</p>');
    } else {
      var err = await fileRes.json().catch(function() { return {}; });
      results.push('<p style="color:red;">❌ 获取文件失败: HTTP ' + fileRes.status + ' - ' + (err.message || '') + '</p>');
    }
  } catch(e) {
    results.push('<p style="color:red;">❌ 获取文件异常: ' + e.message + '</p>');
  }

  // Test 5: Try a minimal PUT (add a test field)
  if (sha) {
    try {
      var testDb = await DB.load(true);
      var content = JSON.stringify(testDb, null, 2);
      var bytes = new TextEncoder().encode(content);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      var base64 = btoa(binary);

      var putBody = {
        message: 'API test [Algorithm Dojo]',
        content: base64,
        sha: sha,
        branch: 'main'
      };

      var putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      });

      if (putRes.ok) {
        var putResult = await putRes.json();
        results.push('<p style="color:green;font-weight:bold;">✅ PUT 写入成功！新 SHA: ' + (putResult.content.sha || '').substring(0, 10) + '...</p>');
      } else {
        var putErr = await putRes.json().catch(function() { return {}; });
        results.push('<p style="color:red;font-weight:bold;">❌ PUT 写入失败: HTTP ' + putRes.status + '</p>');
        results.push('<p style="color:red;">错误: ' + (putErr.message || '未知') + '</p>');
        if (putErr.errors) {
          results.push('<p style="color:red;">详情: ' + JSON.stringify(putErr.errors) + '</p>');
        }
      }
    } catch(e) {
      results.push('<p style="color:red;">❌ PUT 测试异常: ' + e.message + '</p>');
    }
  }

  resultDiv.innerHTML = '<div style="background:var(--surface);padding:16px;border-radius:var(--radius);border:1px solid var(--border);">' + results.join('') + '</div>';
}

// ==================== Dashboard 操作 ====================
async function deleteProblem(id) {
  if (!confirm('确定删除题目 #' + id + '？此操作不可撤销！')) return;
  try {
    var db = await DB.load(true);
    db.problems = (db.problems || []).filter(function(p) { return p.id !== id; });
    db.problem_tags = (db.problem_tags || []).filter(function(pt) { return pt.problem_id !== id; });
    db.solutions = (db.solutions || []).filter(function(s) { return s.problem_id !== id; });
    await DB.save(db);
    showToast('✅ 题目已删除', 'success');
    refreshDashboard();
  } catch (e) {
    showToast('❌ 删除失败: ' + e.message, 'error');
  }
}

async function deleteTag(id, name) {
  if (!confirm('确定删除标签 "' + name + '"？相关题目的该标签也会被移除。')) return;
  try {
    var db = await DB.load(true);
    db.tags = (db.tags || []).filter(function(t) { return t.id !== id; });
    db.problem_tags = (db.problem_tags || []).filter(function(pt) { return pt.tag_id !== id; });
    await DB.save(db);
    showToast('✅ 标签已删除', 'success');
    refreshDashboard();
  } catch (e) {
    showToast('❌ 删除失败: ' + e.message, 'error');
  }
}

function refreshDashboard() {
  DB.clearCache();
  window.location.hash = '#/admin/dashboard';
}

function showAddTag() {
  var modal = document.getElementById('globalModal');
  var title = document.getElementById('globalModalTitle');
  var body = document.getElementById('globalModalBody');
  title.textContent = '新建标签';
  body.innerHTML = renderTagFormHtml();
  openModal('globalModal');
}
