const express = require('express');
const router = express.Router();
const db = require('../db');
const { marked } = require('marked');

// 配置 marked 安全选项
marked.setOptions({
  breaks: true,
  gfm: true,
});

// ==================== 首页 ====================
router.get('/', (req, res) => {
  const stats = db.getStats();
  const tags = db.getAllTags();
  // 获取最新5道题目
  const recentProblems = db.getAllProblems().slice(0, 5);
  res.render('home', { stats, tags, recentProblems });
});

// ==================== 题目列表 ====================
router.get('/problems', (req, res) => {
  const query = req.query.q || '';
  let problems;
  if (query.trim()) {
    problems = db.searchProblems(query.trim());
  } else {
    problems = db.getAllProblems();
  }
  // 处理 tags 字符串为数组
  problems = problems.map(p => ({
    ...p,
    tag_names: p.tag_names ? p.tag_names.split(',') : [],
    tag_ids: p.tag_ids ? p.tag_ids.split(',').map(Number) : [],
    tag_colors: p.tag_colors ? p.tag_colors.split(',') : [],
  }));
  const tags = db.getAllTags();
  res.render('problems', { problems, tags, query });
});

// ==================== 题目详情 ====================
router.get('/problems/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).render('error', { message: '无效的题目ID', error: {} });
  }
  const problem = db.getProblemById(id);
  if (!problem) {
    return res.status(404).render('404');
  }
  // 处理 tags
  problem.tag_names = problem.tag_names ? problem.tag_names.split(',') : [];
  problem.tag_ids = problem.tag_ids ? problem.tag_ids.split(',').map(Number) : [];
  problem.tag_colors = problem.tag_colors ? problem.tag_colors.split(',') : [];

  // 获取该题的所有语言版本
  const languages = [...new Set(problem.solutions.map(s => s.language))];

  // 获取用户选择的语言（默认第一个）
  const selectedLang = req.query.lang || (languages.length > 0 ? languages[0] : null);

  res.render('problem-detail', { problem, languages, selectedLang, marked });
});

// ==================== 标签列表 ====================
router.get('/tags', (req, res) => {
  const tags = db.getAllTags();
  res.render('tags', { tags });
});

// ==================== 按标签筛选题目 ====================
router.get('/tags/:name', (req, res) => {
  const tagName = req.params.name;
  const problems = db.getAllProblems(tagName);
  const processedProblems = problems.map(p => ({
    ...p,
    tag_names: p.tag_names ? p.tag_names.split(',') : [],
    tag_ids: p.tag_ids ? p.tag_ids.split(',').map(Number) : [],
    tag_colors: p.tag_colors ? p.tag_colors.split(',') : [],
  }));
  const tags = db.getAllTags();
  res.render('tag-problems', { problems: processedProblems, tagName, tags });
});

module.exports = router;
