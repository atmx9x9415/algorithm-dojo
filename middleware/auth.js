const db = require('../db');

// 需要登录
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: '请先登录。' });
  }
  res.redirect('/henshin?redirect=' + encodeURIComponent(req.originalUrl));
}

// 需要管理员
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(403).json({ error: '需要管理员权限。' });
  }
  res.status(403).render('error', { message: '需要管理员权限。', error: {} });
}

// 已登录则跳转仪表盘
function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/henshin/dashboard');
  }
  next();
}

// 检查题目所有权（管理员或作者本人）
function checkProblemOwnership(req, res, next) {
  const problemId = parseInt(req.params.id);
  if (isNaN(problemId)) {
    return res.status(400).json({ error: '无效的题目ID。' });
  }
  const problem = db.getProblemById(problemId);
  if (!problem) {
    return res.status(404).json({ error: '题目不存在。' });
  }
  // 管理员可以操作任何题目
  if (req.session.isAdmin) {
    req.currentProblem = problem;
    return next();
  }
  // 普通用户只能操作自己的题目
  if (problem.author_id !== req.session.userId) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ error: '无权操作此题目。' });
    }
    return res.status(403).render('error', { message: '无权操作此题目。', error: {} });
  }
  req.currentProblem = problem;
  next();
}

// 检查题解所有权
function checkSolutionOwnership(req, res, next) {
  const solutionId = parseInt(req.params.id);
  if (isNaN(solutionId)) {
    return res.status(400).json({ error: '无效的题解ID。' });
  }
  const solution = db.getSolutionById(solutionId);
  if (!solution) {
    return res.status(404).json({ error: '题解不存在。' });
  }
  if (req.session.isAdmin) {
    req.currentSolution = solution;
    return next();
  }
  if (solution.author_id !== req.session.userId) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ error: '无权操作此题解。' });
    }
    return res.status(403).render('error', { message: '无权操作此题解。', error: {} });
  }
  req.currentSolution = solution;
  next();
}

module.exports = { requireAuth, requireAdmin, redirectIfLoggedIn, checkProblemOwnership, checkSolutionOwnership };
