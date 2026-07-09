/**
 * 标签列表页
 */
async function renderTags() {
  const db = await DB.load();
  const tags = getTagsWithCount(db);

  App.render(`
    <section class="section">
      <div class="container">
        <div class="page-header">
          <h1 class="page-title">算法标签</h1>
          <p class="page-desc">共 ${tags.length} 个标签</p>
        </div>

        ${tags.length === 0 ? '<div class="empty-state"><span class="empty-icon">🏷️</span><p>还没有标签</p></div>' : `
        <div class="tag-cloud">
          ${tags.map(function(t) {
            return '<a href="#/tags/' + encodeURIComponent(t.name) + '" class="tag-cloud-item" style="background:' + escapeHtml(t.color) + '15;color:' + escapeHtml(t.color) + ';border-color:' + escapeHtml(t.color) + '40;">' + escapeHtml(t.name) + ' <span class="tag-count">' + t.problem_count + '</span></a>';
          }).join('')}
        </div>`}
      </div>
    </section>
  `);
}
