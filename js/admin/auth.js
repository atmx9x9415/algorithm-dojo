/**
 * 管理员登录/认证 - 用户名密码登录
 */
async function renderAdminLogin() {
  // 先检查是否已登录
  var loggedIn = await DB.checkAuth();
  if (loggedIn) {
    window.location.hash = '#/admin/dashboard';
    return;
  }

  App.render(`
    <section class="section">
      <div class="container" style="max-width:480px;margin-top:40px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:1.8rem;">🔐 管理员登录</h1>
          <p style="color:var(--text-light);margin-top:8px;">
            请输入管理员账号和密码
          </p>
        </div>

        <div class="alert alert-info" style="margin-bottom:16px;">
          <p><strong>默认管理员账号</strong></p>
          <p style="font-size:0.9rem;margin-top:4px;">
            邮箱：<code>admin@dojo.local</code><br>
            密码：<code>admin123</code><br>
            <span style="color:var(--accent-red);">⚠️ 首次登录后请立即修改密码！</span>
          </p>
        </div>

        <form onsubmit="handleLogin(event)" style="display:flex;flex-direction:column;gap:12px;">
          <div class="form-group">
            <label for="loginEmail">管理员邮箱</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="admin@dojo.local" required autofocus autocomplete="email">
          </div>
          <div class="form-group">
            <label for="loginPassword">密码</label>
            <input type="password" id="loginPassword" class="form-input" placeholder="请输入密码" required autocomplete="current-password">
          </div>
          <p id="loginError" style="color:var(--accent-red);font-size:0.9rem;display:none;"></p>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%;" id="btnLogin">登录</button>
        </form>

        <div style="text-align:center;margin-top:16px;">
          <a href="#/" class="btn btn-sm btn-outline">返回首页</a>
        </div>
      </div>
    </section>
  `);
}

async function handleLogin(e) {
  e.preventDefault();
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;
  var errEl = document.getElementById('loginError');
  var btn = document.getElementById('btnLogin');

  if (!email) {
    errEl.textContent = '请输入邮箱';
    errEl.style.display = 'block';
    return;
  }
  if (!password) {
    errEl.textContent = '请输入密码';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = '登录中...';

  var result = await DB.login(email, password);
  if (result.valid) {
    showToast('✅ 登录成功！欢迎 ' + result.user, 'success');
    window.location.hash = '#/admin/dashboard';
  } else {
    errEl.textContent = '❌ ' + (result.error || '登录失败');
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '登录';
  }
}
