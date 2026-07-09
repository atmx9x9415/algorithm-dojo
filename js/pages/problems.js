/**
 * 题目列表页
 */
async function renderProblems() {
  const db = await DB.load();
  const allTags = getTagsWithCount(db);
  const problems = (db.problems || []).map(function(p) { return enrichProblem(db, p); })
    .sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

  // 查询参数
  const searchQuery = getQueryParam('q') || '';

  // 过滤
  let filtered = problems;
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = problems.filter(function(p) {
      return p.title.toLowerCase().indexOf(q) !== -1 ||
             (p.description && p.description.toLowerCase().indexOf(q) !== -1);
    });
  }

  App.render(`
    <section class="section">
      <div class="container">
        <div class="page-header">
          <h1 class="page-title">题库</h1>
          <p class="page-desc" id="resultCount">共 ${filtered.length} 道题目</p>
        </div>

        <div class="search-bar">
          <input type="text" id="searchInput" class="form-input" placeholder="搜索题目..." value="${escapeHtml(searchQuery)}">
          <button class="btn btn-primary" onclick="doSearch()">搜索</button>
          ${searchQuery ? '<button class="btn btn-outline" onclick="clearSearch()">清除</button>' : ''}
        </div>

        ${filtered.length === 0 ? '<div class="empty-state"><span class="empty-icon">📭</span><p>' + (searchQuery ? '没有找到匹配的题目' : '还没有题目') + '</p></div>' : `
        <div class="problem-grid">
          ${filtered.map(function(p) { return renderProblemCard(p); }).join('')}
        </div>`}
      </div>
    </section>

    <script>
    document.getElementById('searchInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doSearch();
    });
    <\/script>
  `);
}

function doSearch() {
  var q = document.getElementById('searchInput').value.trim();
  if (q) {
    window.location.hash = '#/problems?q=' + encodeURIComponent(q);
  } else {
    window.location.hash = '#/problems';
  }
}

function clearSearch() {
  window.location.hash = '#/problems';
}

/** 从 hash 获取查询参数 */
function getQueryParam(key) {
  var hash = window.location.hash;
  var idx = hash.indexOf('?');
  if (idx === -1) return null;
  var qs = hash.substring(idx + 1);
  var params = {};
  qs.split('&').forEach(function(pair) {
    var parts = pair.split('=');
    if (parts.length === 2) {
      params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
    }
  });
  return params[key] || null;
}
