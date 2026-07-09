const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  requireAuth, requireAdmin, redirectIfLoggedIn,
  checkProblemOwnership, checkSolutionOwnership,
} = require('../middleware/auth');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ==================== 登录页 ====================
router.get('/', redirectIfLoggedIn, (req, res) => {
  res.render('henshin/login', { error: null, email: '' });
});

// ==================== 登录处理 ====================
router.post('/login', redirectIfLoggedIn, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render('henshin/login', { error: '请输入邮箱和密码。', email: email || '' });
  }
  const user = db.verifyUser(email.trim().toLowerCase(), password);
  if (user) {
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.isAdmin = user.is_admin;
    const redirect = req.query.redirect || '/henshin/dashboard';
    return res.redirect(redirect);
  }
  res.render('henshin/login', { error: '邮箱或密码错误。', email: email || '' });
});

// ==================== 注册页 ====================
router.get('/register', redirectIfLoggedIn, (req, res) => {
  res.render('henshin/register', { error: null, email: '' });
});

// ==================== 注册处理 ====================
router.post('/register', redirectIfLoggedIn, (req, res) => {
  const { email, password, password2 } = req.body;
  if (!email || !password) {
    return res.render('henshin/register', { error: '请填写所有字段。', email: email || '' });
  }
  const emailTrimmed = email.trim().toLowerCase();
  if (emailTrimmed.length > 100 || !emailTrimmed.includes('@')) {
    return res.render('henshin/register', { error: '请输入有效的邮箱地址。', email: email || '' });
  }
  if (password.length < 6) {
    return res.render('henshin/register', { error: '密码至少6位。', email: email || '' });
  }
  if (password !== password2) {
    return res.render('henshin/register', { error: '两次密码不一致。', email: email || '' });
  }
  const result = db.createUser(emailTrimmed, password);
  if (result.error) {
    return res.render('henshin/register', { error: result.error, email: email || '' });
  }
  // 注册成功，自动登录
  req.session.userId = result.id;
  req.session.userEmail = result.email;
  req.session.isAdmin = false;
  res.redirect('/henshin/dashboard');
});

// ==================== 登出 ====================
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ==================== 仪表盘 ====================
router.get('/dashboard', requireAuth, (req, res) => {
  const stats = db.getStats();
  const tags = db.getAllTags();
  // 管理员看到所有题目，普通用户只看自己的
  const problems = req.session.isAdmin
    ? db.getAllProblems()
    : db.getProblemsByAuthor(req.session.userId);
  const processedProblems = problems.map(p => ({
    ...p,
    tag_names: p.tag_names ? p.tag_names.split(',') : [],
    tag_ids: p.tag_ids ? p.tag_ids.split(',').map(Number) : [],
    tag_colors: p.tag_colors ? p.tag_colors.split(',') : [],
  }));
  res.render('henshin/dashboard', { stats, problems: processedProblems, tags });
});

// ==================== 新建题目页 ====================
router.get('/problems/new', requireAuth, (req, res) => {
  const tags = db.getAllTags();
  const editing = false;
  const problem = null;
  res.render('henshin/problem-form', { tags, editing, problem, error: null, values: {} });
});

// ==================== 编辑题目页 ====================
router.get('/problems/:id/edit', requireAuth, checkProblemOwnership, (req, res) => {
  const tags = db.getAllTags();
  const problem = req.currentProblem;
  const editing = true;
  // 选中当前标签
  const selectedTagIds = problem.tag_ids ? problem.tag_ids.split(',').map(Number) : [];
  res.render('henshin/problem-form', {
    tags, editing, problem,
    selectedTagIds,
    error: null, values: {},
  });
});

// ==================== 创建题目 ====================
router.post('/problems', requireAuth, asyncHandler(async (req, res) => {
  const { title, description, difficulty, source, tags: tagIdsRaw, sol_language, sol_explanation, sol_code } = req.body;

  const errors = [];
  if (!title || !title.trim()) errors.push('标题不能为空');
  if (title && title.length > 200) errors.push('标题过长');
  if (!description || !description.trim()) errors.push('题目描述不能为空');

  if (errors.length > 0) {
    const tags = db.getAllTags();
    return res.render('henshin/problem-form', {
      tags, editing: false, problem: null,
      error: errors.join('；'),
      values: { title: title || '', description: description || '', difficulty: difficulty || 'Medium', source: source || '' },
      selectedTagIds: parseTagIds(tagIdsRaw),
    });
  }

  const tagIds = parseTagIds(tagIdsRaw);
  const id = await db.createProblem(title.trim(), description.trim(), difficulty || 'Medium', (source || '').trim(), tagIds, req.session.userId);

  // 如果同时填写了题解，一并创建
  if (sol_language && sol_language.trim() && sol_explanation && sol_explanation.trim() && sol_code && sol_code.trim()) {
    await db.addSolution(id, sol_language.trim(), sol_explanation.trim(), sol_code.trim(), req.session.userId);
  }

  res.redirect('/problems/' + id);
}));

// ==================== 更新题目 (PUT API) ====================
router.put('/problems/:id', requireAuth, checkProblemOwnership, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, difficulty, source, tags: tagIdsRaw } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '标题不能为空' });
  await db.updateProblem(id, title.trim(), description.trim(), difficulty || 'Medium', (source || '').trim(), parseTagIds(tagIdsRaw));
  res.json({ success: true });
}));

// ==================== 更新题目 (表单POST) ====================
router.post('/problems/:id', requireAuth, checkProblemOwnership, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, difficulty, source, tags: tagIdsRaw } = req.body;
  if (!title || !title.trim()) {
    const tags = db.getAllTags();
    return res.render('henshin/problem-form', {
      tags, editing: true, problem: req.currentProblem,
      error: '标题不能为空',
      values: { title: title || '', description: description || '', difficulty: difficulty || 'Medium', source: source || '' },
      selectedTagIds: parseTagIds(tagIdsRaw),
    });
  }
  await db.updateProblem(id, title.trim(), description.trim(), difficulty || 'Medium', (source || '').trim(), parseTagIds(tagIdsRaw));
  res.redirect('/problems/' + id);
}));

// ==================== 删除题目 ====================
router.delete('/problems/:id', requireAuth, checkProblemOwnership, asyncHandler(async (req, res) => {
  await db.deleteProblem(parseInt(req.params.id));
  res.json({ success: true });
}));

// ==================== 添加题解页 ====================
router.get('/problems/:id/solutions/new', requireAuth, checkProblemOwnership, (req, res) => {
  res.render('henshin/solution-form', {
    problem: req.currentProblem,
    editing: false,
    solution: null,
    error: null,
    values: {},
  });
});

// ==================== 编辑题解页 ====================
router.get('/solutions/:id/edit', requireAuth, checkSolutionOwnership, (req, res) => {
  const problem = db.getProblemById(req.currentSolution.problem_id);
  res.render('henshin/solution-form', {
    problem,
    editing: true,
    solution: req.currentSolution,
    error: null,
    values: {},
  });
});

// ==================== 添加题解 ====================
router.post('/problems/:id/solutions', requireAuth, checkProblemOwnership, asyncHandler(async (req, res) => {
  const problemId = parseInt(req.params.id);
  const { language, explanation, code } = req.body;
  const errors = [];
  if (!language || !language.trim()) errors.push('请选择语言');
  if (!explanation || !explanation.trim()) errors.push('题解内容不能为空');
  if (!code || !code.trim()) errors.push('代码不能为空');
  if (errors.length > 0) {
    return res.render('henshin/solution-form', {
      problem: req.currentProblem, editing: false, solution: null,
      error: errors.join('；'),
      values: { language: language || '', explanation: explanation || '', code: code || '' },
    });
  }
  await db.addSolution(problemId, language.trim(), explanation.trim(), code.trim(), req.session.userId);
  res.redirect('/problems/' + problemId);
}));

// ==================== 更新题解 (PUT API) ====================
router.put('/solutions/:id', requireAuth, checkSolutionOwnership, asyncHandler(async (req, res) => {
  const { language, explanation, code } = req.body;
  if (!language || !language.trim()) return res.status(400).json({ error: '请选择语言' });
  await db.updateSolution(parseInt(req.params.id), language.trim(), explanation.trim(), code.trim());
  res.json({ success: true });
}));

// ==================== 更新题解 (表单POST) ====================
router.post('/solutions/:id', requireAuth, checkSolutionOwnership, asyncHandler(async (req, res) => {
  const { language, explanation, code } = req.body;
  const errors = [];
  if (!language || !language.trim()) errors.push('请选择语言');
  if (!explanation || !explanation.trim()) errors.push('题解内容不能为空');
  if (!code || !code.trim()) errors.push('代码不能为空');
  if (errors.length > 0) {
    const problem = db.getProblemById(req.currentSolution.problem_id);
    return res.render('henshin/solution-form', {
      problem, editing: true, solution: req.currentSolution,
      error: errors.join('；'),
      values: { language: language || '', explanation: explanation || '', code: code || '' },
    });
  }
  await db.updateSolution(parseInt(req.params.id), language.trim(), explanation.trim(), code.trim());
  const problem = db.getProblemById(req.currentSolution.problem_id);
  res.redirect('/problems/' + problem.id);
}));

// ==================== 删除题解 ====================
router.delete('/solutions/:id', requireAuth, checkSolutionOwnership, asyncHandler(async (req, res) => {
  await db.deleteSolution(parseInt(req.params.id));
  res.json({ success: true });
}));

// ==================== 创建标签 ====================
router.post('/tags', requireAdmin, asyncHandler(async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '标签名不能为空' });
  const result = await db.createTag(name.trim(), color || '#00b894');
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ success: true });
}));

// ==================== 删除标签 ====================
router.delete('/tags/:id', requireAdmin, asyncHandler(async (req, res) => {
  await db.deleteTag(parseInt(req.params.id));
  res.json({ success: true });
}));

// ==================== 获取题目JSON ====================
router.get('/problems/:id/json', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: '无效ID' });
  const problem = db.getProblemById(id);
  if (!problem) return res.status(404).json({ error: '不存在' });
  res.json(problem);
});

function parseTagIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(Number).filter(n => !isNaN(n) && n > 0);
  return [Number(raw)].filter(n => !isNaN(n) && n > 0);
}

module.exports = router;
