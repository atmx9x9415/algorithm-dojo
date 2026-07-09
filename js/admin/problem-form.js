/**
 * 题目创建/编辑表单
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
    if (!problem) {
      App.renderError('题目不存在');
      return;
    }
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
          <p class="page-desc">${editing ? '修改题目信息' : '填写题目信息'}</p>
        </div>

        <div id="formError" class="alert alert-error" style="display:none;"></div>

        <form onsubmit="submitProblemForm(event, ${editing}, ${editing ? problem.id : 0})" class="problem-edit-form">
          <!-- 基本信息 -->
          <div class="form-step">
            <div class="step-header"><span class="step-number">1</span><h2>基本信息</h2></div>
            <div class="form-row">
              <div class="form-group form-group-flex">
                <label for="pTitle">题目名称 *</label>
                <input type="text" id="pTitle" name="title" class="form-input form-input-lg"
                  value="${escapeHtml(editing ? problem.title : '')}" placeholder="例如：两数之和" maxlength="200" required>
              </div>
              <div class="form-row-split">
                <div class="form-group">
                  <label for="pDifficulty">难度</label>
                  <select id="pDifficulty" name="difficulty" class="form-input">
                    <option value="Easy" ${(editing ? problem.difficulty : '') === 'Easy' ? 'selected' : ''}>简单</option>
                    <option value="Medium" ${(editing ? problem.difficulty : 'Medium') === 'Medium' ? 'selected' : ''}>中等</option>
                    <option value="Hard" ${(editing ? problem.difficulty : '') === 'Hard' ? 'selected' : ''}>困难</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="pSource">来源（选填）</label>
                  <input type="text" id="pSource" name="source" class="form-input"
                    value="${escapeHtml(editing ? (problem.source || '') : '')}" placeholder="如 LeetCode 15" maxlength="200">
                </div>
              </div>
            </div>
          </div>

          <!-- 题目描述 -->
          <div class="form-step">
            <div class="step-header"><span class="step-number">2</span><h2>题目描述</h2></div>
            <p class="step-hint">支持 Markdown 格式。可以包含示例、约束条件等。</p>
            <div class="form-group">
              <textarea id="pDesc" name="description" class="form-input form-textarea form-textarea-lg"
                placeholder="## 题目描述&#10;&#10;给定一个整数数组..." required>${escapeHtml(editing ? problem.description : '')}</textarea>
            </div>
          </div>

          <!-- 标签选择 -->
          <div class="form-step">
            <div class="step-header"><span class="step-number">3</span><h2>算法标签</h2></div>
            <p class="step-hint">选择这道题涉及的算法（可多选）</p>
            <div class="tag-checkboxes" id="tagCheckboxes">
              ${tags.map(function(t) {
                return '<label class="tag-checkbox">' +
                  '<input type="checkbox" name="tags" value="' + t.id + '" ' + (selectedTagIds.indexOf(t.id) !== -1 ? 'checked' : '') + '>' +
                  '<span style="color:' + escapeHtml(t.color) + ';">' + escapeHtml(t.name) + '</span>' +
                '</label>';
              }).join('')}
            </div>
          </div>

          <div class="form-actions form-actions-sticky">
            <a href="#/admin/dashboard" class="btn btn-outline">取消</a>
            <button type="submit" class="btn btn-primary btn-lg">${editing ? '保存修改' : '发布题目'}</button>
          </div>
        </form>
      </div>
    </section>
  `);
}

async function submitProblemForm(e, editing, id) {
  e.preventDefault();
  var errEl = document.getElementById('formError');
  errEl.style.display = 'none';

  var title = document.getElementById('pTitle').value.trim();
  var difficulty = document.getElementById('pDifficulty').value;
  var source = document.getElementById('pSource').value.trim();
  var description = document.getElementById('pDesc').value.trim();

  var tagIds = [];
  document.querySelectorAll('#tagCheckboxes input[type="checkbox"]:checked').forEach(function(cb) {
    tagIds.push(parseInt(cb.value));
  });

  if (!title) {
    errEl.textContent = '标题不能为空';
    errEl.style.display = 'block';
    return;
  }
  if (!description) {
    errEl.textContent = '题目描述不能为空';
    errEl.style.display = 'block';
    return;
  }

  try {
    var db = await DB.load();
    if (editing) {
      var problem = (db.problems || []).find(function(p) { return p.id === id; });
      if (!problem) throw new Error('题目不存在');
      problem.title = title;
      problem.description = description;
      problem.difficulty = difficulty;
      problem.source = source;
      problem.updated_at = new Date().toISOString();
      db.problem_tags = (db.problem_tags || []).filter(function(pt) { return pt.problem_id !== id; });
      tagIds.forEach(function(tid) {
        db.problem_tags.push({ problem_id: id, tag_id: tid });
      });
    } else {
      var newId = (db.nextId && db.nextId.problems) || 1;
      db.nextId = db.nextId || {};
      db.nextId.problems = newId + 1;
      db.problems = db.problems || [];
      var now = new Date().toISOString();
      db.problems.push({
        id: newId, title: title, description: description,
        difficulty: difficulty, source: source,
        author_id: 0, created_at: now, updated_at: now,
      });
      tagIds.forEach(function(tid) {
        db.problem_tags.push({ problem_id: newId, tag_id: tid });
      });
    }
    await DB.save(db);
    showToast(editing ? '✅ 题目已更新' : '✅ 题目已创建', 'success');
    window.location.hash = '#/admin/dashboard';
  } catch (err) {
    errEl.textContent = '保存失败: ' + err.message;
    errEl.style.display = 'block';
  }
}
