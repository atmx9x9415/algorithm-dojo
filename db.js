const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ==================== 数据库引擎 ====================
let writeLock = false;
const writeQueue = [];

function acquireLock() {
  return new Promise((resolve) => {
    if (!writeLock) { writeLock = true; resolve(); }
    else { writeQueue.push(resolve); }
  });
}

function releaseLock() {
  if (writeQueue.length > 0) { const next = writeQueue.shift(); next(); }
  else { writeLock = false; }
}

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('读取数据库失败:', e.message);
  }
  return {
    problems: [], tags: [], problem_tags: [], solutions: [],
    users: [], nextId: { problems: 1, tags: 1, solutions: 1, users: 1 },
  };
}

async function saveDB(db) {
  await acquireLock();
  try {
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } finally { releaseLock(); }
}

function getNextId(db, table) {
  const id = db.nextId[table] || 1;
  db.nextId[table] = id + 1;
  return id;
}

// ==================== 初始化 ====================
function initDatabase() {
  const db = loadDB();
  let modified = false;

  // 默认管理员 (author_id = 0 表示管理员/系统)
  if (!db.users.find(u => u.email === 'admin@dojo.local')) {
    const hash = bcrypt.hashSync('Aa123789', 12);
    const id = getNextId(db, 'users');
    db.users.push({ id, email: 'admin@dojo.local', password_hash: hash, is_admin: true, created_at: formatDateTime() });
    modified = true;
    console.log('✅ 默认管理员已创建');
  }

  // 默认标签
  const defaultTags = [
    { name: '动态规划', color: '#e74c3c' },
    { name: '贪心', color: '#f39c12' },
    { name: '二分查找', color: '#3498db' },
    { name: 'DFS/BFS', color: '#9b59b6' },
    { name: '字符串', color: '#1abc9c' },
    { name: '数学', color: '#e67e22' },
    { name: '数据结构', color: '#2ecc71' },
    { name: '图论', color: '#e91e63' },
    { name: '排序', color: '#00bcd4' },
    { name: '双指针', color: '#795548' },
    { name: '位运算', color: '#607d8b' },
    { name: '回溯', color: '#ff5722' },
    { name: '滑动窗口', color: '#009688' },
    { name: '前缀和', color: '#673ab7' },
    { name: '并查集', color: '#ff9800' },
  ];

  const existingNames = new Set(db.tags.map(t => t.name));
  for (const tag of defaultTags) {
    if (!existingNames.has(tag.name)) {
      db.tags.push({ id: getNextId(db, 'tags'), name: tag.name, color: tag.color });
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  }
  console.log('✅ 数据库初始化完成');
}

// ==================== 用户操作 ====================
function createUser(email, password) {
  const db = loadDB();
  if (db.users.find(u => u.email === email)) {
    return { error: '该邮箱已注册。' };
  }
  const id = getNextId(db, 'users');
  const hash = bcrypt.hashSync(password, 12);
  db.users.push({ id, email, password_hash: hash, is_admin: false, created_at: formatDateTime() });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  return { success: true, id, email };
}

function verifyUser(email, password) {
  const db = loadDB();
  const user = db.users.find(u => u.email === email);
  if (!user) return null;
  if (bcrypt.compareSync(password, user.password_hash)) {
    return { id: user.id, email: user.email, is_admin: user.is_admin };
  }
  return null;
}

function getUserById(id) {
  const db = loadDB();
  return db.users.find(u => u.id === id) || null;
}

// ==================== 题目操作 ====================
function getAllProblems(tagFilter = null) {
  const db = loadDB();
  let problems = [...db.problems];
  if (tagFilter) {
    const tag = db.tags.find(t => t.name === tagFilter);
    if (tag) {
      const pids = new Set(db.problem_tags.filter(pt => pt.tag_id === tag.id).map(pt => pt.problem_id));
      problems = problems.filter(p => pids.has(p.id));
    } else { return []; }
  }
  return problems.map(p => enrichProblem(db, p))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getProblemById(id) {
  const db = loadDB();
  const p = db.problems.find(pp => pp.id === id);
  if (!p) return null;
  const enriched = enrichProblem(db, p);
  enriched.solutions = db.solutions
    .filter(s => s.problem_id === id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(s => {
      const author = db.users.find(u => u.id === s.author_id);
      return { ...s, author_email: author ? author.email : '未知' };
    });
  return enriched;
}

function getProblemsByAuthor(authorId) {
  const db = loadDB();
  return db.problems
    .filter(p => p.author_id === authorId)
    .map(p => enrichProblem(db, p))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function enrichProblem(db, p) {
  const pts = db.problem_tags.filter(pt => pt.problem_id === p.id);
  const tagIds = pts.map(pt => pt.tag_id);
  const tags = db.tags.filter(t => tagIds.includes(t.id));
  const author = db.users.find(u => u.id === p.author_id);
  return {
    ...p,
    tag_names: tags.map(t => t.name).join(','),
    tag_ids: tags.map(t => t.id).join(','),
    tag_colors: tags.map(t => t.color).join(','),
    author_email: author ? author.email : '未知',
  };
}

async function createProblem(title, description, difficulty, source, tagIds, authorId) {
  const db = loadDB();
  const id = getNextId(db, 'problems');
  const now = formatDateTime();
  db.problems.push({ id, title, description, difficulty: difficulty || 'Medium', source: source || '', author_id: authorId, created_at: now, updated_at: now });
  if (tagIds && tagIds.length > 0) {
    for (const tid of tagIds) db.problem_tags.push({ problem_id: id, tag_id: tid });
  }
  await saveDB(db);
  return id;
}

async function updateProblem(id, title, description, difficulty, source, tagIds) {
  const db = loadDB();
  const p = db.problems.find(pp => pp.id === id);
  if (!p) throw new Error('题目不存在');
  p.title = title; p.description = description;
  p.difficulty = difficulty || 'Medium'; p.source = source || '';
  p.updated_at = formatDateTime();
  db.problem_tags = db.problem_tags.filter(pt => pt.problem_id !== id);
  if (tagIds && tagIds.length > 0) {
    for (const tid of tagIds) db.problem_tags.push({ problem_id: id, tag_id: tid });
  }
  await saveDB(db);
}

async function deleteProblem(id) {
  const db = loadDB();
  db.problems = db.problems.filter(p => p.id !== id);
  db.problem_tags = db.problem_tags.filter(pt => pt.problem_id !== id);
  db.solutions = db.solutions.filter(s => s.problem_id !== id);
  await saveDB(db);
}

function searchProblems(query) {
  const db = loadDB();
  const q = query.toLowerCase();
  return db.problems
    .filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    .map(p => enrichProblem(db, p))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ==================== 题解操作 ====================
async function addSolution(problemId, language, explanation, code, authorId) {
  const db = loadDB();
  const id = getNextId(db, 'solutions');
  const now = formatDateTime();
  db.solutions.push({ id, problem_id: problemId, language, explanation, code, author_id: authorId, created_at: now, updated_at: now });
  await saveDB(db);
  return id;
}

async function updateSolution(id, language, explanation, code) {
  const db = loadDB();
  const s = db.solutions.find(ss => ss.id === id);
  if (!s) throw new Error('题解不存在');
  s.language = language; s.explanation = explanation; s.code = code;
  s.updated_at = formatDateTime();
  await saveDB(db);
}

async function deleteSolution(id) {
  const db = loadDB();
  db.solutions = db.solutions.filter(s => s.id !== id);
  await saveDB(db);
}

function getSolutionById(id) {
  return loadDB().solutions.find(s => s.id === id) || null;
}

// ==================== 标签操作 ====================
function getAllTags() {
  const db = loadDB();
  return db.tags.map(t => ({
    ...t,
    problem_count: db.problem_tags.filter(pt => pt.tag_id === t.id).length,
  })).sort((a, b) => b.problem_count - a.problem_count || a.name.localeCompare(b.name));
}

async function createTag(name, color) {
  const db = loadDB();
  if (db.tags.find(t => t.name === name)) return { error: '标签已存在' };
  const id = getNextId(db, 'tags');
  db.tags.push({ id, name, color: color || '#00b894' });
  await saveDB(db);
  return { success: true, id };
}

async function deleteTag(id) {
  const db = loadDB();
  db.tags = db.tags.filter(t => t.id !== id);
  db.problem_tags = db.problem_tags.filter(pt => pt.tag_id !== id);
  await saveDB(db);
}

// ==================== 统计 ====================
function getStats() {
  const db = loadDB();
  return { problemCount: db.problems.length, solutionCount: db.solutions.length, tagCount: db.tags.length, userCount: db.users.length };
}

// ==================== 工具 ====================
function formatDateTime() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

initDatabase();

module.exports = {
  getAllProblems, getProblemById, getProblemsByAuthor,
  createProblem, updateProblem, deleteProblem, searchProblems,
  addSolution, updateSolution, deleteSolution, getSolutionById,
  getAllTags, createTag, deleteTag,
  createUser, verifyUser, getUserById,
  getStats,
};
