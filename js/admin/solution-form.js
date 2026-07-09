/**
 * 题解添加表单
 */
async function renderSolutionForm(params) {
  if (!DB.isLoggedIn()) {
    window.location.hash = '#/admin';
    return;
  }

  var db = await DB.load();
  var problemId = parseInt(params.problemId || params.id);
  var editing = params.solutionId ? true : false;
  var solution = null;
  var problem = null;

  if (editing) {
    var solId = parseInt(params.id);
    solution = (db.solutions || []).find(function(s) { return s.id === solId; });
    if (!solution) { App.renderError('题解不存在'); return; }
    problemId = solution.problem_id;
  }

  problem = enrichProblem(db, (db.problems || []).find(function(p) { return p.id === problemId; }));
  if (!problem) { App.renderError('题目不存在'); return; }

  App.render(`
    <section class="section">
      <div class="container">
        <nav class="breadcrumb">
          <a href="#/admin/dashboard">管理面板</a> <span>/</span>
          <a href="#/problems/${problem.id}">${escapeHtml(problem.title)}</a> <span>/</span>
          <span class="current">${editing ? '编辑题解' : '添加题解'}</span>
        </nav>

        <div class="page-header">
          <h1 class="page-title">${editing ? '编辑题解' : '添加题解'}</h1>
          <p class="page-desc">题目：${escapeHtml(problem.title)}</p>
        </div>

        <div id="formError" class="alert alert-error" style="display:none;"></div>

        <form onsubmit="submitSolutionForm(event, ${editing ? solution.id : 0}, ${problemId})">
          <div class="form-step">
            <div class="step-header"><span class="step-number">1</span><h2>基本信息</h2></div>
            <div class="form-group">
              <label for="solLang">编程语言</label>
              <select id="solLang" class="form-input" style="max-width:200px;" required>
                <option value="">请选择</option>
                ${['C++', 'Python', 'Java', 'JavaScript', 'Go', 'Rust', 'TypeScript'].map(function(lang) {
                  return '<option value="' + lang + '" ' + (editing && solution.language === lang ? 'selected' : '') + '>' + lang + '</option>';
                }).join('')}
              </select>
            </div>
          </div>

          <div class="form-step">
            <div class="step-header"><span class="step-number">2</span><h2>思路讲解</h2></div>
            <p class="step-hint">支持 Markdown 格式</p>
            <div class="form-group">
              <textarea id="solExplanation" class="form-input form-textarea" rows="8"
                placeholder="## 解题思路&#10;&#10;1. 首先...&#10;&#10;## 复杂度分析">${escapeHtml(editing ? (solution.explanation || '') : '')}</textarea>
            </div>
          </div>

          <div class="form-step">
            <div class="step-header"><span class="step-number">3</span><h2>完整代码</h2></div>
            <div class="form-group">
              <textarea id="solCode" class="form-input form-textarea code-textarea" rows="14"
                placeholder="// 粘贴完整可运行代码...">${escapeHtml(editing ? (solution.code || '') : '')}</textarea>
            </div>
          </div>

          <div class="form-actions form-actions-sticky">
            <a href="#/admin/dashboard" class="btn btn-outline">取消</a>
            <button type="submit" class="btn btn-primary btn-lg">${editing ? '保存修改' : '添加题解'}</button>
          </div>
        </form>
      </div>
    </section>
  `);
}

async function submitSolutionForm(e, solutionId, problemId) {
  e.preventDefault();
  var errEl = document.getElementById('formError');
  errEl.style.display = 'none';

  var language = document.getElementById('solLang').value;
  var explanation = document.getElementById('solExplanation').value.trim();
  var code = document.getElementById('solCode').value.trim();

  if (!language) { errEl.textContent = '请选择语言'; errEl.style.display = 'block'; return; }
  if (!explanation) { errEl.textContent = '思路讲解不能为空'; errEl.style.display = 'block'; return; }
  if (!code) { errEl.textContent = '代码不能为空'; errEl.style.display = 'block'; return; }

  try {
    var db = await DB.load();
    var now = new Date().toISOString();

    if (solutionId) {
      // 编辑
      var sol = (db.solutions || []).find(function(s) { return s.id === solutionId; });
      if (!sol) throw new Error('题解不存在');
      sol.language = language;
      sol.explanation = explanation;
      sol.code = code;
      sol.updated_at = now;
    } else {
      // 新建
      db.nextId = db.nextId || {};
      db.nextId.solutions = db.nextId.solutions || 1;
      var newId = db.nextId.solutions;
      db.nextId.solutions = newId + 1;
      db.solutions = db.solutions || [];
      db.solutions.push({
        id: newId, problem_id: problemId, language: language,
        explanation: explanation, code: code,
        author_id: 0, created_at: now, updated_at: now,
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
