/**
 * 按标签筛选题目
 */
async function renderTagProblems(params) {
  const tagName = params.name;
  const db = await DB.load();
  const allTags = getTagsWithCount(db);

  // 找到标签
  const tag = (db.tags || []).find(function(t) { return t.name === tagName; });
  if (!tag) {
    App.renderError('标签不存在');
    return;
  }

  // 筛选题目
  const problemIds = (db.problem_tags || [])
    .filter(function(pt) { return pt.tag_id === tag.id; })
    .map(function(pt) { return pt.problem_id; });

  const problems = (db.problems || [])
    .filter(function(p) { return problemIds.indexOf(p.id) !== -1; })
    .map(function(p) { return enrichProblem(db, p); })
    .sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

  App.render(`
    <section class="section">
      <div class="container">
        <nav class="breadcrumb">
          <a href="#/">首页</a> <span>/</span>
          <a href="#/tags">算法标签</a> <span>/</span>
          <span class="current">${escapeHtml(tagName)}</span>
        </nav>

        <div class="page-header">
          <h1 class="page-title" style="color:${escapeHtml(tag.color)};">${escapeHtml(tagName)}</h1>
          <p class="page-desc">共 ${problems.length} 道相关题目</p>
        </div>

        ${problems.length === 0 ? '<div class="empty-state"><span class="empty-icon">📭</span><p>该标签下还没有题目</p></div>' : `
        <div class="problem-grid">
          ${problems.map(function(p) { return renderProblemCard(p); }).join('')}
        </div>`}

        <div class="back-nav" style="margin-top:24px;">
          <a href="#/tags" class="btn btn-outline">&larr; 返回标签列表</a>
        </div>
      </div>
    </section>
  `);
}
