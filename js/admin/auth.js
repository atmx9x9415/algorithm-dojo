/**
 * 管理员登录/认证
 */
async function renderAdminLogin() {
  // 已登录则跳转仪表盘
  if (DB.isLoggedIn()) {
    window.location.hash = '#/admin/dashboard';
    return;
  }

  App.render(`
    <section class="section">
      <div class="container" style="max-width:480px;margin-top:40px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:1.8rem;">🔐 管理员登录</h1>
          <p style="color:var(--text-light);margin-top:8px;">
            输入你的 <strong>GitHub Personal Access Token</strong> 来管理内容
          </p>
        </div>

        <div class="alert alert-info" style="margin-bottom:16px;">
          <p><strong>如何获取 Token？</strong></p>
          <ol style="margin:8px 0 0 16px;font-size:0.9rem;">
            <li>打开 <a href="https://github.com/settings/tokens/new" target="_blank">GitHub Token 设置</a></li>
            <li>Note 填 <code>algorithm-dojo</code></li>
            <li>勾选 <strong>repo</strong>（全部子项）</li>
            <li>点击 Generate token，复制结果</li>
          </ol>
        </div>

        <form onsubmit="handleLogin(event)" style="display:flex;flex-direction:column;gap:12px;">
          <div class="form-group">
            <label for="ghToken">GitHub Token</label>
            <input type="password" id="ghToken" class="form-input" placeholder="ghp_xxxxxxxxxxxx" required autofocus>
          </div>
          <p id="loginError" style="color:var(--accent-red);font-size:0.9rem;display:none;"></p>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%;">验证并登录</button>
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
  var token = document.getElementById('ghToken').value.trim();
  var errEl = document.getElementById('loginError');

  if (!token) {
    errEl.textContent = '请输入 Token';
    errEl.style.display = 'block';
    return;
  }

  // 验证 Token
  var result = await DB.verifyToken(token);
  if (result.valid) {
    DB.setToken(token);
    showToast('✅ 登录成功！欢迎 ' + result.user, 'success');
    window.location.hash = '#/admin/dashboard';
  } else {
    errEl.textContent = '❌ ' + (result.error || 'Token 无效');
    errEl.style.display = 'block';
  }
}
