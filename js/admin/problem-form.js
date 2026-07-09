/**
 * 题目创建/编辑表单 - 带明确保存按钮
 */
async function renderProblemForm(params) {
  if (!DB.isLoggedIn()) {
    window.location.hash = '#/admin';
    return;
  }

  var editing = !!params.id;
  var problem = null;
  var db = await DB.load();
  var tags = getTagsWithCount(db);

  if (editing) {
    var id = parseInt(params.id);
    problem = enrichProblem(db, (db.problems || []).find(function(p) { return p.id === id; }));
    if (!problem) { App.renderError('题目不存在'); return; }
  } else {
    problem = { id: 0, title: '', description: '', difficulty: 'Medium', source: '', tag_ids: '' };
  }

  var title = editing ? '编辑题目 #' + problem.id : '添加新题目';
  var selectedTagIds = editing ? splitTags(problem.tag_ids).map(Number) : [];

  App.render(`
    <section class="section">
      <div class="container">
        <nav class="breadcrumb">
          <a href="#/admin/dashboard">管理面板</a> <span>/</span>
          <span class="current">${title}</span>
        </nav>

        <div class="page-header">
          <h1 class="page-title">${title}</h1>
          <p class="page-desc">${editing ? '修改题目信息' : '填写题目信息并保存'}</p>
        </div>

        <div id="formError" class="alert alert-error" style="display:none;"></div>
        <div id="formSuccess" class="alert alert-success" style="display:none;"></div>

        <!-- 基本信息 -->
        <div class="form-step">
          <div class="step-header"><span class="step-number">1</span><h2>基本信息</h2></div>
          <div class="form-row">
            <div class="form-group form-group-flex">
              <label for="pTitle">题目名称 *</label>
              <input type="text" id="pTitle" class="form-input form-input-lg"
                value="${escapeHtml(problem.title)}" placeholder="例如：两数之和" maxlength="200">
            </div>
            <div class="form-row-split">
              <div class="form-group">
                <label for="pDifficulty">难度</label>
                <select id="pDifficulty" class="form-input">
                  <option value="Easy" ${problem.difficulty === 'Easy' ? 'selected' : ''}>简单</option>
                  <option value="Medium" ${problem.difficulty === 'Medium' ? 'selected' : ''}>中等</option>
                  <option value="Hard" ${problem.difficulty === 'Hard' ? 'selected' : ''}>困难</option>
                </select>
              </div>
              <div class="form-group">
                <label for="pSource">来源（选填）</label>
                <input type="text" id="pSource" class="form-input"
                  value="${escapeHtml(problem.source || '')}" placeholder="如 LeetCode 15" maxlength="200">
              </div>
            </div>
          </div>
        </div>

        <!-- 题目描述 -->
        <div class="form-step">
          <div class="step-header"><span class="step-number">2</span><h2>题目描述</h2></div>
          <p class="step-hint">支持 Markdown 格式。</p>
          <div class="form-group">
            <textarea id="pDesc" class="form-input form-textarea form-textarea-lg"
              placeholder="## 题目描述&#10;&#10;给定一个整数数组...&#10;&#10;## 示例&#10;&#10;输入: ...&#10;输出: ...">${escapeHtml(problem.description)}</textarea>
          </div>
        </div>

        <!-- 标签选择 -->
        <div class="form-step">
          <div class="step-header"><span class="step-number">3</span><h2>算法标签</h2></div>
          <p class="step-hint">可多选</p>
          <div class="tag-checkboxes" id="tagCheckboxes">
            ${tags.map(function(t) {
              return '<label class="tag-checkbox">' +
                '<input type="checkbox" value="' + t.id + '" ' + (selectedTagIds.indexOf(t.id) !== -1 ? 'checked' : '') + '>' +
                '<span style="color:' + escapeHtml(t.color) + ';">' + escapeHtml(t.name) + '</span>' +
              '</label>';
            }).join('')}
          </div>
        </div>

        <!-- 保存按钮 -->
        <div class="form-actions form-actions-sticky" style="display:flex;gap:12px;align-items:center;">
          <a href="#/admin/dashboard" class="btn btn-outline">取消</a>
          <button onclick="saveProblem(${editing}, ${editing ? problem.id : 0})" class="btn btn-primary btn-lg" id="btnSave">
            💾 ${editing ? '保存修改' : '保存题目'}
          </button>
          <span id="saveStatus" style="font-size:0.9rem;"></span>
        </div>
      </div>
    </section>
  `);
}

// ==================== 保存题目（按钮点击触发） ====================
async function saveProblem(editing, id) {
  var errEl = document.getElementById('formError');
  var sucEl = document.getElementById('formSuccess');
  var btn = document.getElementById('btnSave');
  var status = document.getElementById('saveStatus');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  // 读取表单
  var title = document.getElementById('pTitle').value.trim();
  var difficulty = document.getElementById('pDifficulty').value;
  var source = document.getElementById('pSource').value.trim();
  var description = document.getElementById('pDesc').value.trim();

  var tagIds = [];
  document.querySelectorAll('#tagCheckboxes input[type="checkbox"]:checked').forEach(function(cb) {
    tagIds.push(parseInt(cb.value));
  });

  // 验证
  if (!title) { errEl.textContent = '⚠️ 标题不能为空'; errEl.style.display = 'block'; return; }
  if (title.length > 200) { errEl.textContent = '⚠️ 标题过长 (最多200字)'; errEl.style.display = 'block'; return; }
  if (!description) { errEl.textContent = '⚠️ 题目描述不能为空'; errEl.style.display = 'block'; return; }

  // 禁用按钮
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 保存中...';
  status.textContent = '正在连接 GitHub API...';
  status.style.color = 'var(--text-light)';

  try {
    var db = await DB.load(true); // 强制刷新获取最新数据
    status.textContent = '已加载数据，正在构建...';

    var now = formatDateTime();
    if (editing) {
      // 编辑
      var p = (db.problems || []).find(function(pr) { return pr.id === id; });
      if (!p) throw new Error('题目 #' + id + ' 在数据库中不存在');
      p.title = title;
      p.description = description;
      p.difficulty = difficulty;
      p.source = source;
      p.updated_at = now;
      // 更新标签关联
      db.problem_tags = (db.problem_tags || []).filter(function(pt) { return pt.problem_id !== id; });
      tagIds.forEach(function(tid) {
        db.problem_tags.push({ problem_id: id, tag_id: tid });
      });
    } else {
      // 新建
      db.nextId = db.nextId || {};
      db.nextId.problems = db.nextId.problems || 1;
      var newId = db.nextId.problems;
      db.nextId.problems = newId + 1;
      db.problems = db.problems || [];
      db.problems.push({
        id: newId, title: title, description: description,
        difficulty: difficulty, source: source,
        author_id: 0, created_at: now, updated_at: now,
      });
      tagIds.forEach(function(tid) {
        db.problem_tags.push({ problem_id: newId, tag_id: tid });
      });
    }

    status.textContent = '正在写入 GitHub...';
    var ok = await DB.save(db);

    if (ok) {
      btn.innerHTML = '✅ 已保存!';
      btn.disabled = false;
      status.textContent = '保存成功！';
      status.style.color = 'var(--primary)';
      showToast(editing ? '✅ 题目已更新' : '✅ 新题目已创建', 'success');
      // 延迟跳转
      setTimeout(function() {
        window.location.hash = '#/admin/dashboard';
      }, 800);
    }
  } catch (e) {
    console.error('保存失败:', e);
    btn.innerHTML = '💾 重试保存';
    btn.disabled = false;
    status.textContent = '❌ ' + e.message;
    status.style.color = 'var(--accent-red)';
    errEl.textContent = '保存失败: ' + e.message;
    errEl.style.display = 'block';
    showToast('❌ 保存失败: ' + e.message, 'error');
  }
}

// 生成当前时间字符串
function formatDateTime() {
  var d = new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
         pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}
