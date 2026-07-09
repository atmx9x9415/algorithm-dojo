// ====================
// 算法道場 管理后台脚本
// ====================

// --- 打开添加题目模态框 ---
function showAddProblem() {
  document.getElementById('modalTitle').textContent = '添加题目';
  document.getElementById('problemId').value = '';
  document.getElementById('pTitle').value = '';
  document.getElementById('pDifficulty').value = 'Medium';
  document.getElementById('pSource').value = '';
  document.getElementById('pDesc').value = '';
  // 清除标签选择
  document.querySelectorAll('#tagCheckboxes input[type="checkbox"]').forEach(function (cb) {
    cb.checked = false;
  });
  openModal('problemModal');
}

// --- 编辑题目 ---
function editProblem(id) {
  document.getElementById('modalTitle').textContent = '编辑题目 #' + id;
  document.getElementById('problemId').value = id;

  // 通过 JSON API 获取题目详情
  fetch('/henshin/problems/' + id + '/json')
    .then(function (res) {
      if (!res.ok) throw new Error('获取失败');
      return res.json();
    })
    .then(function (problem) {
      document.getElementById('pTitle').value = problem.title || '';
      document.getElementById('pDifficulty').value = problem.difficulty || 'Medium';
      document.getElementById('pSource').value = problem.source || '';
      document.getElementById('pDesc').value = problem.description || '';

      // 设置标签选择
      var tagIds = problem.tag_ids ? problem.tag_ids.split(',').map(Number) : [];
      document.querySelectorAll('#tagCheckboxes input[type="checkbox"]').forEach(function (cb) {
        cb.checked = tagIds.indexOf(parseInt(cb.value)) !== -1;
      });

      openModal('problemModal');
    })
    .catch(function (err) {
      alert('获取题目数据失败：' + err.message);
    });
}

// --- 提交题目表单 ---
function submitProblem(e) {
  e.preventDefault();

  var id = document.getElementById('problemId').value;
  var title = document.getElementById('pTitle').value.trim();
  var difficulty = document.getElementById('pDifficulty').value;
  var source = document.getElementById('pSource').value.trim();
  var description = document.getElementById('pDesc').value.trim();

  var tagIds = [];
  document.querySelectorAll('#tagCheckboxes input[type="checkbox"]:checked').forEach(function (cb) {
    tagIds.push(parseInt(cb.value));
  });

  if (!title || !description) {
    alert('标题和描述不能为空！');
    return;
  }

  var data = {
    title: title,
    description: description,
    difficulty: difficulty,
    source: source,
    tags: tagIds,
  };

  var url = id ? '/henshin/problems/' + id : '/henshin/problems';
  var method = id ? 'PUT' : 'POST';

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      if (result.error) {
        alert('错误：' + result.error);
      } else {
        closeModal('problemModal');
        window.location.reload();
      }
    })
    .catch(function (err) {
      alert('请求失败：' + err.message);
    });
}

// --- 删除题目 ---
function deleteProblem(id) {
  if (!confirm('确定要删除题目 #' + id + ' 吗？该操作不可撤销，所有关联的题解也会被删除！')) {
    return;
  }

  fetch('/henshin/problems/' + id, { method: 'DELETE' })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      if (result.error) {
        alert('错误：' + result.error);
      } else {
        window.location.reload();
      }
    })
    .catch(function (err) {
      alert('请求失败：' + err.message);
    });
}

// --- 添加题解 ---
function addSolution(problemId) {
  document.getElementById('solProblemId').value = problemId;
  document.getElementById('solLang').value = 'C++';
  document.getElementById('solExplanation').value = '';
  document.getElementById('solCode').value = '';
  openModal('solutionModal');
}

// --- 提交题解 ---
function submitSolution(e) {
  e.preventDefault();

  var problemId = document.getElementById('solProblemId').value;
  var lang = document.getElementById('solLang').value;
  var explanation = document.getElementById('solExplanation').value.trim();
  var code = document.getElementById('solCode').value.trim();

  if (!lang || !explanation || !code) {
    alert('所有字段都必须填写！');
    return;
  }

  fetch('/henshin/problems/' + problemId + '/solutions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: lang,
      explanation: explanation,
      code: code,
    }),
  })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      if (result.error) {
        alert('错误：' + result.error);
      } else {
        closeModal('solutionModal');
        window.location.reload();
      }
    })
    .catch(function (err) {
      alert('请求失败：' + err.message);
    });
}

// --- 显示新建标签 ---
function showAddTag() {
  document.getElementById('tagName').value = '';
  document.getElementById('tagColor').value = '#00b894';
  openModal('tagModal');
}

// --- 提交标签 ---
function submitTag(e) {
  e.preventDefault();

  var name = document.getElementById('tagName').value.trim();
  var color = document.getElementById('tagColor').value;

  if (!name) {
    alert('标签名不能为空！');
    return;
  }

  fetch('/henshin/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, color: color }),
  })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      if (result.error) {
        alert('错误：' + result.error);
      } else {
        closeModal('tagModal');
        window.location.reload();
      }
    })
    .catch(function (err) {
      alert('请求失败：' + err.message);
    });
}
