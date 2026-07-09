/**
 * 题目详情页
 */
async function renderProblemDetail(params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    App.renderError('无效的题目ID');
    return;
  }

  const db = await DB.load();
  const problem = enrichProblem(db, (db.problems || []).find(function(p) { return p.id === id; }));
  if (!problem) {
    App.renderError('题目不存在');
    return;
  }

  const tagNames = splitTags(problem.tag_names);
  const tagColors = splitTags(problem.tag_colors);

  // 题解
  const solutions = (db.solutions || [])
    .filter(function(s) { return s.problem_id === id; })
    .map(function(s) {
      const author = (db.users || []).find(function(u) { return u.id === s.author_id; });
      return Object.assign({}, s, { author_email: author ? author.email : '未知' });
    })

  // 语言列表
  const languages = [];
  const seen = {};
  solutions.forEach(function(s) {
    if (!seen[s.language]) { seen[s.language] = true; languages.push(s.language); }
  });

  // 查询参数选择语言
  const selectedLang = getQueryParam('lang') || (languages.length > 0 ? languages[0] : null);
  const activeSolution = selectedLang
    ? solutions.find(function(s) { return s.language === selectedLang; })
    : (solutions.length > 0 ? solutions[0] : null);

  // 渲染 Markdown
  let descriptionHtml = '';
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
    descriptionHtml = marked.parse(problem.description || '');
  } else {
    descriptionHtml = escapeHtml(problem.description || '');
  }

  // 渲染题解
  let solutionHtml = '';
  if (solutions.length > 0 && activeSolution) {
    if (typeof marked !== 'undefined') {
      const explanationHtml = activeSolution.explanation
        ? marked.parse(activeSolution.explanation)
        : '<p>暂无讲解</p>';
      solutionHtml = `
        <div class="solution-card">
          <div class="solution-meta">
            <span class="solution-lang">${langIcon(activeSolution.language)} ${escapeHtml(activeSolution.language)}</span>
            <span>${escapeHtml(activeSolution.author_email)} · ${formatDate(activeSolution.updated_at || activeSolution.created_at)}</span>
          </div>
          <div class="solution-explanation">
            <h3>思路讲解</h3>
            <div class="markdown-content">${explanationHtml}</div>
          </div>
          <div class="solution-code">
            <div class="code-header">
              <h3>完整代码</h3>
              <button class="btn btn-sm btn-outline copy-btn" onclick="copyCode(this)" data-code="${escapeHtml(activeSolution.code).replace(/"/g, '&quot;')}">复制代码</button>
            </div>
            <pre><code class="language-${escapeHtml((activeSolution.language || 'cpp').toLowerCase())}">${escapeHtml(activeSolution.code || '')}</code></pre>
          </div>
        </div>`;
    }
  } else {
    solutionHtml = '<div class="empty-state"><span class="empty-icon">📝</span><p>暂无题解</p></div>';
  }

  App.render(`
    <section class="section">
      <div class="container">
        <nav class="breadcrumb">
          <a href="#/">首页</a> <span>/</span>
          <a href="#/problems">题库</a> <span>/</span>
          <span class="current">${escapeHtml(problem.title)}</span>
        </nav>

        <div class="problem-header">
          <div class="problem-header-top">
            <h1 class="problem-title">${escapeHtml(problem.title)}</h1>
            <span class="difficulty-badge difficulty-${problem.difficulty.toLowerCase()} difficulty-lg">${difficultyLabel(problem.difficulty)}</span>
          </div>
          ${problem.source ? '<p class="problem-source">来源：' + escapeHtml(problem.source) + '</p>' : ''}
          <div class="problem-tags">
            ${tagNames.map(function(name, i) {
              return '<a href="#/tags/' + encodeURIComponent(name) + '" class="tag" style="background:' + escapeHtml(tagColors[i] || '#00b894') + '20;color:' + escapeHtml(tagColors[i] || '#00b894') + ';border:1px solid ' + escapeHtml(tagColors[i] || '#00b894') + '40;">' + escapeHtml(name) + '</a>';
            }).join('')}
          </div>
          <p class="problem-author">贡献者：${escapeHtml(problem.author_email || '未知')}</p>
        </div>

        <div class="problem-body">
          <div class="problem-description">
            <h2>题目描述</h2>
            <div class="markdown-content">${descriptionHtml}</div>
          </div>
        </div>

        <div class="solutions-section">
          <h2 class="solutions-title">题解</h2>
          ${languages.length > 1 ? `
          <div class="language-selector">
            <span class="lang-label">选择语言：</span>
            <div class="lang-buttons">
              ${languages.map(function(lang) {
                return '<a href="#/problems/' + id + '?lang=' + encodeURIComponent(lang) + '" class="lang-btn ' + (lang === selectedLang ? 'lang-active' : '') + '">' + langIcon(lang) + ' ' + escapeHtml(lang) + '</a>';
              }).join('')}
            </div>
          </div>` : ''}
          ${solutionHtml}
        </div>

        <div class="back-nav">
          <a href="#/problems" class="btn btn-outline">&larr; 返回题库</a>
        </div>
      </div>
    </section>
  `);

  // 高亮代码
  if (typeof hljs !== 'undefined') {
    setTimeout(function() {
      document.querySelectorAll('pre code').forEach(function(block) {
        hljs.highlightElement(block);
      });
    }, 100);
  }
}

function copyCode(btn) {
  var code = btn.getAttribute('data-code');
  navigator.clipboard.writeText(code).then(function() {
    btn.textContent = '已复制!';
    setTimeout(function() { btn.textContent = '复制代码'; }, 2000);
  });
}
