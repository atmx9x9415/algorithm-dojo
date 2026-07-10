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
              <strong>管理员已登录</strong>
              <a href="#/admin/logout" class="admin-logout-link" style="margin-left:12px;">退出登录</a>
              <a href="javascript:void(0)" onclick="showChangePassword()" style="margin-left:12px;font-size:0.85rem;">🔑 修改密码</a>
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
        </div>

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

        <!-- 修改密码弹窗 -->
        <div style="margin-top:24px;padding:16px;background:var(--bg-alt);border-radius:var(--radius);text-align:center;">
          <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:8px;">
            🔑 安全提示：请定期修改管理员密码
          </p>
          <button class="btn btn-outline" onclick="showChangePassword()">🔑 修改密码</button>
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

// ==================== 修改密码 ====================

function showChangePassword() {
  var modal = document.getElementById('globalModal');
  var title = document.getElementById('globalModalTitle');
  var body = document.getElementById('globalModalBody');
  title.textContent = '🔑 修改管理员密码';
  body.innerHTML = `
    <form onsubmit="submitChangePassword(event)" style="display:flex;flex-direction:column;gap:12px;">
      <div class="form-group">
        <label for="currentPwd">当前密码</label>
        <input type="password" id="currentPwd" class="form-input" required autofocus>
      </div>
      <div class="form-group">
        <label for="newPwd">新密码（至少6位）</label>
        <input type="password" id="newPwd" class="form-input" minlength="6" required>
      </div>
      <div class="form-group">
        <label for="confirmPwd">确认新密码</label>
        <input type="password" id="confirmPwd" class="form-input" minlength="6" required>
      </div>
      <p id="changePwdError" style="color:var(--accent-red);font-size:0.9rem;display:none;"></p>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('globalModal')">取消</button>
        <button type="submit" class="btn btn-primary">修改密码</button>
      </div>
    </form>
  `;
  openModal('globalModal');
}

async function submitChangePassword(e) {
  e.preventDefault();
  var errEl = document.getElementById('changePwdError');
  errEl.style.display = 'none';

  var currentPwd = document.getElementById('currentPwd').value;
  var newPwd = document.getElementById('newPwd').value;
  var confirmPwd = document.getElementById('confirmPwd').value;

  if (newPwd !== confirmPwd) {
    errEl.textContent = '两次输入的新密码不一致';
    errEl.style.display = 'block';
    return;
  }
  if (newPwd.length < 6) {
    errEl.textContent = '新密码至少 6 位';
    errEl.style.display = 'block';
    return;
  }

  var result = await DB.changePassword(currentPwd, newPwd);
  if (result.success) {
    closeModal('globalModal');
    showToast('✅ ' + result.message, 'success');
  } else {
    errEl.textContent = '❌ ' + (result.error || '修改失败');
    errEl.style.display = 'block';
  }
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
