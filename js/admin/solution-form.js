/**
 * 题解添加/编辑表单
 * mode: 'new' | 'edit'
 */
async function renderSolutionForm(params, mode) {
  if (!DB.isLoggedIn()) {
    window.location.hash = '#/admin';
    return;
  }

  var db = await DB.load();
  var editing = (mode === 'edit');
  var solution = null;
  var problemId;

  if (editing) {
    // 编辑模式：params.id 是题解 ID
    var solId = parseInt(params.id);
    solution = (db.solutions || []).find(function(s) { return s.id === solId; });
    if (!solution) { App.renderError('题解不存在'); return; }
    problemId = solution.problem_id;
  } else {
    // 新建模式：params.problemId 是题目 ID
    problemId = parseInt(params.problemId);
  }

  var problem = enrichProblem(db, (db.problems || []).find(function(p) { return p.id === problemId; }));
  if (!problem) { App.renderError('题目不存在'); return; }

  // 获取该题已有的题解（用于展示版本列表）
  var existingSolutions = (db.solutions || []).filter(function(s) { return s.problem_id === problemId; });

  App.render(`
    <section class="section">
      <div class="container">
        <nav class="breadcrumb">
          <a href="#/admin/dashboard">管理面板</a> <span>/</span>
          <a href="#/problems/${problem.id}">${escapeHtml(problem.title)}</a> <span>/</span>
          <span class="current">${editing ? '编辑题解 #' + solution.id : '添加题解'}</span>
        </nav>

        <div class="page-header">
          <h1 class="page-title">${editing ? '编辑题解' : '添加新题解'}</h1>
          <p class="page-desc">
            题目：<a href="#/problems/${problem.id}">${escapeHtml(problem.title)}</a>
          </p>
        </div>

        ${existingSolutions.length > 0 ? `
        <div class="admin-table-wrapper" style="margin-bottom:24px;">
          <h3 style="margin-bottom:12px;">📋 已有题解 (${existingSolutions.length} 个版本)</h3>
          <div class="admin-table-scroll">
            <table class="admin-table">
              <thead><tr><th>ID</th><th>语言</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                ${existingSolutions.map(function(s) {
                  return '<tr>' +
                    '<td>' + s.id + '</td>' +
                    '<td>' + langIcon(s.language) + ' ' + escapeHtml(s.language) + '</td>' +
                    '<td>' + formatDate(s.updated_at || s.created_at) + '</td>' +
                    '<td>' +
                      '<a href="#/admin/solutions/' + s.id + '/edit" class="btn btn-sm btn-outline">编辑</a>' +
                      '<button class="btn btn-sm btn-danger-outline" onclick="deleteSolutionFromForm(' + s.id + ', ' + problemId + ')">删除</button>' +
                    '</td>' +
                  '</tr>';
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

        <div id="formError" class="alert alert-error" style="display:none;"></div>

        <form onsubmit="submitSolutionForm(event, ${editing ? solution.id : 0}, ${problemId})" class="problem-edit-form">
          <!-- 基本信息 -->
          <div class="form-step">
            <div class="step-header"><span class="step-number">1</span><h2>选择语言版本</h2></div>
            <p class="step-hint">每道题可以有多个语言版本的题解（C++、Python、Java 等），每个语言可以有不同解法。</p>
            <div class="form-row-split">
              <div class="form-group">
                <label for="solLang">编程语言 *</label>
                <select id="solLang" class="form-input" required>
                  <option value="">请选择</option>
                  ${['C++', 'Python', 'Java', 'JavaScript', 'Go', 'Rust', 'TypeScript'].map(function(lang) {
                    var sel = editing && solution.language === lang ? 'selected' : '';
                    return '<option value="' + lang + '" ' + sel + '>' + lang + '</option>';
                  }).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="solVersion">解法版本（可选）</label>
                <input type="text" id="solVersion" class="form-input" placeholder="如：暴力、优化、双指针"
                  maxlength="50" value="${escapeHtml(editing ? (solution.version || '') : '')}">
              </div>
            </div>
          </div>

          <!-- 思路讲解 -->
          <div class="form-step">
            <div class="step-header"><span class="step-number">2</span><h2>思路讲解（Markdown）</h2></div>
            <p class="step-hint">详细解释解题思路、算法逻辑、复杂度分析</p>
            <div class="form-group">
              <textarea id="solExplanation" class="form-input form-textarea" rows="10"
                placeholder="## 解题思路&#10;&#10;1. 分析问题...&#10;2. 选择算法...&#10;&#10;## 复杂度分析&#10;&#10;- 时间复杂度: O(n)&#10;- 空间复杂度: O(1)">${escapeHtml(editing ? (solution.explanation || '') : '')}</textarea>
            </div>
          </div>

          <!-- 完整解答代码 -->
          <div class="form-step">
            <div class="step-header"><span class="step-number">3</span><h2>完整解答代码</h2></div>
            <p class="step-hint">可直接运行的完整解法代码（AC 代码）</p>
            <div class="form-group">
              <textarea id="solCode" class="form-input form-textarea code-textarea" rows="12"
                placeholder="// 完整解答代码（可运行）">${escapeHtml(editing ? (solution.code || '') : '')}</textarea>
            </div>
          </div>

          <!-- 作答模板 -->
          <div class="form-step">
            <div class="step-header"><span class="step-number">4</span><h2>作答模板（可选）</h2></div>
            <p class="step-hint">提供函数框架/模板代码，供练习时填空补全</p>
            <div class="form-group">
              <textarea id="solTemplate" class="form-input form-textarea code-textarea" rows="10"
                placeholder="// 作答模板（函数框架，TODO 标记留空位置）">${escapeHtml(editing ? (solution.template || '') : '')}</textarea>
            </div>
          </div>

          <div class="form-actions form-actions-sticky">
            <a href="#/problems/${problemId}" class="btn btn-outline">取消</a>
            <button type="submit" class="btn btn-primary btn-lg">${editing ? '保存修改' : '添加题解'}</button>
          </div>
        </form>
      </div>
    </section>
  `);
}

// ==================== 提交题解 ====================
async function submitSolutionForm(e, solutionId, problemId) {
  e.preventDefault();
  var errEl = document.getElementById('formError');
  errEl.style.display = 'none';

  var language = document.getElementById('solLang').value;
  var version = document.getElementById('solVersion').value.trim();
  var explanation = document.getElementById('solExplanation').value.trim();
  var code = document.getElementById('solCode').value.trim();
  var template = document.getElementById('solTemplate').value.trim();

  if (!language) { errEl.textContent = '请选择语言'; errEl.style.display = 'block'; return; }
  if (!explanation) { errEl.textContent = '思路讲解不能为空'; errEl.style.display = 'block'; return; }
  if (!code) { errEl.textContent = '解答代码不能为空'; errEl.style.display = 'block'; return; }

  try {
    var db = await DB.load();
    var now = new Date().toISOString();

    if (solutionId) {
      // 编辑已有题解
      var sol = (db.solutions || []).find(function(s) { return s.id === solutionId; });
      if (!sol) throw new Error('题解不存在');
      sol.language = language;
      sol.version = version || '';
      sol.explanation = explanation;
      sol.code = code;
      sol.template = template || '';
      sol.updated_at = now;
    } else {
      // 新建题解
      db.nextId = db.nextId || {};
      db.nextId.solutions = db.nextId.solutions || 1;
      var newId = db.nextId.solutions;
      db.nextId.solutions = newId + 1;
      db.solutions = db.solutions || [];
      db.solutions.push({
        id: newId,
        problem_id: problemId,
        language: language,
        version: version || '',
        explanation: explanation,
        code: code,
        template: template || '',
        author_id: 0,
        created_at: now,
        updated_at: now,
      });
    }
    await DB.save(db);
    showToast(solutionId ? '✅ 题解已更新' : '✅ 题解已添加', 'success');
    window.location.hash = '#/problems/' + problemId;
  } catch (err) {
    errEl.textContent = '保存失败: ' + err.message;
    errEl.style.display = 'block';
  }
}

// ==================== 从题解列表删除 ====================
async function deleteSolutionFromForm(solutionId, problemId) {
  if (!confirm('确定删除题解 #' + solutionId + '？')) return;
  try {
    var db = await DB.load();
    db.solutions = (db.solutions || []).filter(function(s) { return s.id !== solutionId; });
    await DB.save(db);
    showToast('✅ 题解已删除', 'success');
    // 刷新页面
    DB.clearCache();
    window.location.hash = '#/admin/solutions/' + problemId + '/new';
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  }
}
