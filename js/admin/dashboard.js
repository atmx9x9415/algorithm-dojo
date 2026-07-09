/**
 * 管理仪表盘 - 题目列表、标签管理
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

        <!-- 标签管理 -->
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
      </div>
    </section>
  `);
}

// ==================== Dashboard 操作 ====================

async function deleteProblem(id) {
  if (!confirm('确定删除题目 #' + id + '？此操作不可撤销！')) return;
  try {
    var db = await DB.load();
    db.problems = (db.problems || []).filter(function(p) { return p.id !== id; });
    db.problem_tags = (db.problem_tags || []).filter(function(pt) { return pt.problem_id !== id; });
    db.solutions = (db.solutions || []).filter(function(s) { return s.problem_id !== id; });
    await DB.save(db);
    showToast('✅ 题目已删除', 'success');
    refreshDashboard();
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  }
}

async function deleteTag(id, name) {
  if (!confirm('确定删除标签 "' + name + '"？相关题目的该标签也会被移除。')) return;
  try {
    var db = await DB.load();
    db.tags = (db.tags || []).filter(function(t) { return t.id !== id; });
    db.problem_tags = (db.problem_tags || []).filter(function(pt) { return pt.tag_id !== id; });
    await DB.save(db);
    showToast('✅ 标签已删除', 'success');
    refreshDashboard();
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
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
