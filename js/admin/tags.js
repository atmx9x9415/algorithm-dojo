/**
 * 标签管理操作
 */

function renderTagFormHtml() {
  return `
    <form onsubmit="submitTagForm(event)">
      <div class="form-group">
        <label for="tagName">标签名称</label>
        <input type="text" id="tagName" class="form-input" maxlength="30" required autofocus>
      </div>
      <div class="form-group">
        <label for="tagColor">颜色</label>
        <input type="color" id="tagColor" class="form-input form-color" value="#00b894">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('globalModal')">取消</button>
        <button type="submit" class="btn btn-primary">创建</button>
      </div>
    </form>
  `;
}

async function submitTagForm(e) {
  e.preventDefault();
  var name = document.getElementById('tagName').value.trim();
  var color = document.getElementById('tagColor').value;

  if (!name) {
    showToast('标签名不能为空', 'error');
    return;
  }

  try {
    var db = await DB.load();
    if ((db.tags || []).find(function(t) { return t.name === name; })) {
      showToast('标签 "' + name + '" 已存在', 'error');
      return;
    }
    db.nextId = db.nextId || {};
    db.nextId.tags = db.nextId.tags || 1;
    var newId = db.nextId.tags;
    db.nextId.tags = newId + 1;
    db.tags = db.tags || [];
    db.tags.push({ id: newId, name: name, color: color || '#00b894' });
    await DB.save(db);
    closeModal('globalModal');
    showToast('✅ 标签 "' + name + '" 已创建', 'success');
    DB.clearCache();
    window.location.hash = '#/admin/dashboard';
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}
