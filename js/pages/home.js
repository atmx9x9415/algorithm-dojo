/**
 * 首页渲染
 */
async function renderHome() {
  const db = await DB.load();
  const stats = getStats(db);
  const recentProblems = getRecentProblems(db, 5);
  const tags = getTagsWithCount(db).filter(function(t) { return t.problem_count > 0; });

  App.render(`
    <section class="hero">
      <div class="hero-content">
        <h1 class="hero-title">算法道场</h1>
        <p class="hero-subtitle">按算法标签系统学习，从入门到精通</p>
        <div class="hero-actions">
          <a href="#/problems" class="btn btn-primary btn-lg">进入题库</a>
          <a href="#/tags" class="btn btn-outline btn-lg">浏览标签</a>
        </div>
        <div class="hero-stats">
          <div class="stat-card"><span class="stat-number">${stats.problemCount}</span><span class="stat-label">题目</span></div>
          <div class="stat-card"><span class="stat-number">${stats.solutionCount}</span><span class="stat-label">题解</span></div>
          <div class="stat-card"><span class="stat-number">${stats.tagCount}</span><span class="stat-label">算法标签</span></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">最新题目</h2>
          <a href="#/problems" class="btn btn-sm btn-outline">查看全部 &rarr;</a>
        </div>
        ${recentProblems.length === 0 ? '<div class="empty-state"><span class="empty-icon">📭</span><p>还没有题目，快去上传吧！</p></div>' : `
        <div class="problem-grid">
          ${recentProblems.map(function(p) { return renderProblemCard(p); }).join('')}
        </div>`}
      </div>
    </section>

    <section class="section section-alt">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">算法标签</h2>
          <a href="#/tags" class="btn btn-sm btn-outline">查看全部 &rarr;</a>
        </div>
        <div class="tag-cloud">
          ${tags.map(function(t) { return renderTagCloudItem(t); }).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="features">
          <div class="feature-card"><div class="feature-icon">📚</div><h3>分类学习</h3><p>按算法标签系统分类，从动态规划到图论，循序渐进掌握每种算法思想。</p></div>
          <div class="feature-card"><div class="feature-icon">💻</div><h3>多语言题解</h3><p>每道题支持多语言版本的题解，在 C++、Python、Java 之间自由切换。</p></div>
          <div class="feature-card"><div class="feature-icon">📖</div><h3>讲解+代码</h3><p>每道题解包含详细思路讲解和完整可运行代码。</p></div>
          <div class="feature-card"><div class="feature-icon">👥</div><h3>共同贡献</h3><p>使用 GitHub Token 登录即可上传自己的题目和题解。</p></div>
        </div>
      </div>
    </section>
  `);
}

// ==================== 渲染辅助函数 ====================

function renderProblemCard(p) {
  const tagNames = splitTags(p.tag_names);
  const tagColors = splitTags(p.tag_colors);
  const maxTags = 4;

  return `
  <a href="#/problems/${p.id}" class="problem-card">
    <div class="card-header">
      <h3 class="card-title">${escapeHtml(p.title)}</h3>
      <span class="difficulty-badge difficulty-${p.difficulty.toLowerCase()}">${difficultyLabel(p.difficulty)}</span>
    </div>
    <p class="card-desc">${escapeHtml(truncate(p.description, 100))}</p>
    <div class="card-tags">
      ${tagNames.slice(0, maxTags).map(function(name, i) {
        return '<span class="tag" style="background:' + escapeHtml(tagColors[i] || '#00b894') + '20;color:' + escapeHtml(tagColors[i] || '#00b894') + ';border:1px solid ' + escapeHtml(tagColors[i] || '#00b894') + '40;">' + escapeHtml(name) + '</span>';
      }).join('')}
      ${tagNames.length > maxTags ? '<span class="tag tag-more">+' + (tagNames.length - maxTags) + '</span>' : ''}
    </div>
  </a>`;
}

function renderTagCloudItem(t) {
  return '<a href="#/tags/' + encodeURIComponent(t.name) + '" class="tag-cloud-item" style="background:' + escapeHtml(t.color) + '15;color:' + escapeHtml(t.color) + ';border-color:' + escapeHtml(t.color) + '40;">' + escapeHtml(t.name) + ' <span class="tag-count">' + t.problem_count + '</span></a>';
}

// ==================== 数据工具函数 ====================

function getStats(db) {
  return {
    problemCount: (db.problems || []).length,
    solutionCount: (db.solutions || []).length,
    tagCount: (db.tags || []).length,
  };
}

function getRecentProblems(db, n) {
  return (db.problems || []).slice().sort(function(a, b) {
    return new Date(b.created_at) - new Date(a.created_at);
  }).slice(0, n).map(function(p) { return enrichProblem(db, p); });
}

function getTagsWithCount(db) {
  const tags = db.tags || [];
  const problemTags = db.problem_tags || [];
  return tags.map(function(t) {
    return Object.assign({}, t, {
      problem_count: problemTags.filter(function(pt) { return pt.tag_id === t.id; }).length,
    });
  }).sort(function(a, b) {
    return b.problem_count - a.problem_count || a.name.localeCompare(b.name);
  });
}

function enrichProblem(db, p) {
  const pts = (db.problem_tags || []).filter(function(pt) { return pt.problem_id === p.id; });
  const tagIds = pts.map(function(pt) { return pt.tag_id; });
  const tags = (db.tags || []).filter(function(t) { return tagIds.indexOf(t.id) !== -1; });
  const author = (db.users || []).find(function(u) { return u.id === p.author_id; });
  return Object.assign({}, p, {
    tag_names: tags.map(function(t) { return t.name; }).join(','),
    tag_ids: tags.map(function(t) { return t.id; }).join(','),
    tag_colors: tags.map(function(t) { return t.color; }).join(','),
    author_email: author ? author.email : '未知',
  });
}

function splitTags(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  return String(str).split(',').filter(Boolean);
}
