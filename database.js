/**
 * 算法道场 - SQLite 数据库层（使用 sql.js 纯 JS 实现）
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'dojo.db');

let SQL = null;
let db = null;

// ==================== 初始化 ====================

async function getDb() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  if (!db) {
    try {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } catch (e) {
      db = new SQL.Database();
    }
    db.run('PRAGMA foreign_keys = ON');
    initTables();
  }
  return db;
}

function saveToDisk() {
  if (db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      difficulty TEXT DEFAULT 'Medium',
      source TEXT DEFAULT '',
      author_id INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#00b894'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS problem_tags (
      problem_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (problem_id, tag_id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS solutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      version TEXT DEFAULT '',
      explanation TEXT DEFAULT '',
      code TEXT DEFAULT '',
      template TEXT DEFAULT '',
      author_id INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
}

// ==================== 查询辅助 ====================

function queryAll(sql, params) {
  if (!params || params.length === 0) {
    const results = db.exec(sql);
    if (!results || results.length === 0) return [];
    const cols = results[0].columns;
    return results[0].values.map(row => {
      const obj = {};
      cols.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execute(sql, params) {
  if (!params || params.length === 0) {
    db.run(sql);
  } else {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
  }
}

// ==================== 导出完整数据库 JSON（兼容前端格式） ====================

function exportDb() {
  const problems = queryAll('SELECT * FROM problems ORDER BY id');
  const tags = queryAll('SELECT * FROM tags ORDER BY id');
  const problem_tags = queryAll('SELECT * FROM problem_tags');
  const solutions = queryAll('SELECT * FROM solutions ORDER BY id');
  const users = queryAll('SELECT id, email, password_hash, is_admin, created_at FROM users');

  const maxProblemId = problems.length > 0 ? Math.max(...problems.map(p => p.id)) : 0;
  const maxTagId = tags.length > 0 ? Math.max(...tags.map(t => t.id)) : 0;
  const maxSolutionId = solutions.length > 0 ? Math.max(...solutions.map(s => s.id)) : 0;
  const maxUserId = users.length > 0 ? Math.max(...users.map(u => u.id)) : 0;

  return {
    problems,
    tags,
    problem_tags,
    solutions,
    users,
    nextId: {
      problems: maxProblemId + 1,
      tags: maxTagId + 1,
      solutions: maxSolutionId + 1,
      users: maxUserId + 1
    }
  };
}

// ==================== 导入完整数据库 JSON ====================

function importDb(json) {
  db.run('DELETE FROM problem_tags');
  db.run('DELETE FROM solutions');
  db.run('DELETE FROM problems');
  db.run('DELETE FROM tags');
  db.run('DELETE FROM users');
  db.run("DELETE FROM sqlite_sequence");

  const insertUser = db.prepare('INSERT INTO users (id, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)');
  (json.users || []).forEach(u => {
    insertUser.bind([u.id, u.email, u.password_hash, u.is_admin ? 1 : 0, u.created_at || '']);
    insertUser.step();
    insertUser.reset();
  });
  insertUser.free();

  const insertProblem = db.prepare('INSERT INTO problems (id, title, description, difficulty, source, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  (json.problems || []).forEach(p => {
    insertProblem.bind([p.id, p.title, p.description || '', p.difficulty || 'Medium', p.source || '', p.author_id || 0, p.created_at || '', p.updated_at || '']);
    insertProblem.step();
    insertProblem.reset();
  });
  insertProblem.free();

  const insertTag = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)');
  (json.tags || []).forEach(t => {
    insertTag.bind([t.id, t.name, t.color || '#00b894']);
    insertTag.step();
    insertTag.reset();
  });
  insertTag.free();

  const insertPT = db.prepare('INSERT INTO problem_tags (problem_id, tag_id) VALUES (?, ?)');
  (json.problem_tags || []).forEach(pt => {
    insertPT.bind([pt.problem_id, pt.tag_id]);
    insertPT.step();
    insertPT.reset();
  });
  insertPT.free();

  const insertSolution = db.prepare('INSERT INTO solutions (id, problem_id, language, version, explanation, code, template, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  (json.solutions || []).forEach(s => {
    insertSolution.bind([s.id, s.problem_id, s.language, s.version || '', s.explanation || '', s.code || '', s.template || '', s.author_id || 0, s.created_at || '', s.updated_at || '']);
    insertSolution.step();
    insertSolution.reset();
  });
  insertSolution.free();

  saveToDisk();
  return true;
}

// ==================== 用户认证 ====================

function getUserByEmail(email) {
  return queryOne('SELECT * FROM users WHERE email = ?', [email]);
}

function createUser(email, passwordHash, isAdmin) {
  execute('INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, ?)', [email, passwordHash, isAdmin ? 1 : 0]);
  saveToDisk();
}

// ==================== 初始化默认管理员 ====================

function ensureAdmin(forceReset) {
  const bcrypt = require('bcryptjs');
  const existing = queryOne('SELECT * FROM users WHERE email = ?', ['admin@dojo.local']);

  if (existing && forceReset) {
    // 强制重置密码
    const hash = bcrypt.hashSync('admin123', 12);
    const stmt = db.prepare('UPDATE users SET password_hash = ?, is_admin = 1 WHERE email = ?');
    stmt.bind([hash, 'admin@dojo.local']);
    stmt.step();
    stmt.free();
    saveToDisk();
    console.log('[DB] 管理员密码已重置: admin@dojo.local / admin123');
  } else if (!existing) {
    const hash = bcrypt.hashSync('admin123', 12);
    createUser('admin@dojo.local', hash, true);
    console.log('[DB] 已创建默认管理员: admin@dojo.local / admin123');
  }
}

module.exports = { getDb, exportDb, importDb, getUserByEmail, createUser, ensureAdmin, saveToDisk };
