/**
 * 题解添加/编辑表单 - 带明确保存按钮
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
    var solId = parseInt(params.id);
    solution = (db.solutions || []).find(function(s) { return s.id === solId; });
    if (!solution) { App.renderError('题解不存在'); return; }
    problemId = solution.problem_id;
  } else {
    problemId = parseInt(params.problemId);
  }

  var problem = enrichProblem(db, (db.problems || []).find(function(p) { return p.id === problemId; }));
  if (!problem) { App.renderError('题目不存在'); return; }

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
          <p class="page-desc">题目：<a href="#/problems/${problem.id}">${escapeHtml(problem.title)}</a></p>
        </div>

        ${existingSolutions.length > 0 ? `
        <div class="admin-table-wrapper" style="margin-bottom:24px;">
          <h3 style="margin-bottom:12px;">📋 已有题解 (${existingSolutions.length} 个版本)</h3>
          <div class="admin-table-scroll">
            <table class="admin-table">
              <thead><tr><th>ID</th><th>语言</th><th>版本</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                ${existingSolutions.map(function(s) {
                  return '<tr>' +
                    '<td>' + s.id + '</td>' +
                    '<td>' + langIcon(s.language) + ' ' + escapeHtml(s.language) + '</td>' +
                    '<td>' + escapeHtml(s.version || '-') + '</td>' +
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

        <!-- 语言和版本 -->
        <div class="form-step">
          <div class="step-header"><span class="step-number">1</span><h2>语言版本</h2></div>
          <p class="step-hint">每道题可以有多个语言版本的题解</p>
          <div class="form-row-split">
            <div class="form-group">
              <label for="solLang">编程语言 *</label>
              <select id="solLang" class="form-input">
                <option value="">请选择</option>
                ${['C++', 'Python', 'Java', 'JavaScript', 'Go', 'Rust', 'TypeScript'].map(function(lang) {
                  var sel = editing && solution.language === lang ? 'selected' : '';
                  return '<option value="' + lang + '" ' + sel + '>' + lang + '</option>';
                }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="solVersion">解法版本（可选）</label>
              <input type="text" id="solVersion" class="form-input" placeholder="如：暴力、双指针、DP优化"
                maxlength="50" value="${escapeHtml(editing ? (solution.version || '') : '')}">
            </div>
          </div>
        </div>

        <!-- 思路讲解 -->
        <div class="form-step">
          <div class="step-header"><span class="step-number">2</span><h2>思路讲解 (Markdown)</h2></div>
          <div class="form-group">
            <textarea id="solExplanation" class="form-input form-textarea" rows="10"
              placeholder="## 解题思路&#10;&#10;1. 分析问题...&#10;&#10;## 复杂度&#10;&#10;- 时间: O(n)&#10;- 空间: O(1)">${escapeHtml(editing ? (solution.explanation || '') : '')}</textarea>
          </div>
        </div>

        <!-- 解答代码 -->
        <div class="form-step">
          <div class="step-header"><span class="step-number">3</span><h2>✅ 完整解答代码</h2></div>
          <p class="step-hint">可直接运行通过的 AC 代码</p>
          <div class="form-group">
            <textarea id="solCode" class="form-input form-textarea code-textarea" rows="12"
              placeholder="// 完整解答代码">${escapeHtml(editing ? (solution.code || '') : '')}</textarea>
          </div>
        </div>

        <!-- 作答模板 -->
        <div class="form-step">
          <div class="step-header"><span class="step-number">4</span><h2>📝 作答模板（可选）</h2></div>
          <p class="step-hint">函数框架，留 TODO 位置供练习填空</p>
          <div class="form-group">
            <textarea id="solTemplate" class="form-input form-textarea code-textarea" rows="10"
              placeholder="// 作答模板（函数框架）">${escapeHtml(editing ? (solution.template || '') : '')}</textarea>
          </div>
        </div>

        <!-- 保存 -->
        <div class="form-actions form-actions-sticky" style="display:flex;gap:12px;align-items:center;">
          <a href="#/problems/${problemId}" class="btn btn-outline">取消</a>
          <button onclick="saveSolution(${editing ? solution.id : 0}, ${problemId})" class="btn btn-primary btn-lg" id="btnSaveSol">
            💾 ${editing ? '保存修改' : '添加题解'}
          </button>
          <span id="saveStatus" style="font-size:0.9rem;"></span>
        </div>
      </div>
    </section>
  `);
}

// ==================== 保存题解 ====================
async function saveSolution(solutionId, problemId) {
  var errEl = document.getElementById('formError');
  var btn = document.getElementById('btnSaveSol');
  var status = document.getElementById('saveStatus');
  errEl.style.display = 'none';

  var language = document.getElementById('solLang').value;
  var version = document.getElementById('solVersion').value.trim();
  var explanation = document.getElementById('solExplanation').value.trim();
  var code = document.getElementById('solCode').value.trim();
  var template = document.getElementById('solTemplate').value.trim();

  if (!language) { errEl.textContent = '⚠️ 请选择语言'; errEl.style.display = 'block'; return; }
  if (!explanation) { errEl.textContent = '⚠️ 思路讲解不能为空'; errEl.style.display = 'block'; return; }
  if (!code) { errEl.textContent = '⚠️ 解答代码不能为空'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 保存中...';
  status.textContent = '正在保存...';
  status.style.color = 'var(--text-light)';

  try {
    var db = await DB.load(true);
    var now = formatDateTime();

    if (solutionId) {
      var sol = (db.solutions || []).find(function(s) { return s.id === solutionId; });
      if (!sol) throw new Error('题解 #' + solutionId + ' 不存在');
      sol.language = language;
      sol.version = version;
      sol.explanation = explanation;
      sol.code = code;
      sol.template = template;
      sol.updated_at = now;
    } else {
      db.nextId = db.nextId || {};
      db.nextId.solutions = db.nextId.solutions || 1;
      var newId = db.nextId.solutions;
      db.nextId.solutions = newId + 1;
      db.solutions = db.solutions || [];
      db.solutions.push({
        id: newId, problem_id: problemId, language: language,
        version: version, explanation: explanation, code: code,
        template: template, author_id: 0, created_at: now, updated_at: now,
      });
    }

    await DB.save(db);
    btn.innerHTML = '✅ 已保存!';
    btn.disabled = false;
    status.textContent = '保存成功！';
    status.style.color = 'var(--primary)';
    showToast(solutionId ? '✅ 题解已更新' : '✅ 题解已添加', 'success');
    setTimeout(function() {
      window.location.hash = '#/problems/' + problemId;
    }, 600);
  } catch (e) {
    console.error('保存题解失败:', e);
    btn.innerHTML = '💾 重试保存';
    btn.disabled = false;
    status.textContent = '❌ ' + e.message;
    status.style.color = 'var(--accent-red)';
    errEl.textContent = '保存失败: ' + e.message;
    errEl.style.display = 'block';
    showToast('❌ 保存失败: ' + e.message, 'error');
  }
}

async function deleteSolutionFromForm(solutionId, problemId) {
  if (!confirm('确定删除题解 #' + solutionId + '？')) return;
  try {
    var db = await DB.load(true);
    db.solutions = (db.solutions || []).filter(function(s) { return s.id !== solutionId; });
    await DB.save(db);
    showToast('✅ 题解已删除', 'success');
    DB.clearCache();
    window.location.hash = '#/admin/solutions/' + problemId + '/new';
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  }
}
