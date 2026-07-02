const App = {
  state: null,
  els: {},
  init() {
    this.els = {
      navLinks: document.querySelectorAll('.nav-link'),
      views: document.querySelectorAll('.view'),
      toastContainer: document.getElementById('toast-container'),
      modal: document.getElementById('modal'),
      modalForm: document.getElementById('modalForm'),
      modalTitle: document.getElementById('modalTitle'),
      modalSubtitle: document.getElementById('modalSubtitle'),
      modalSubmit: document.getElementById('modalSubmit'),
      modalCancel: document.getElementById('modalCancel'),
      modalClose: document.getElementById('modalClose'),
    };
    this.loadState();
    this.bindEvents();
    this.router();
    this.applyTheme();
    window.addEventListener('hashchange', () => this.router());
    this.renderAll();
  },
  loadState() {
    const raw = localStorage.getItem('habitGoalsState');
    if (raw) { this.state = JSON.parse(raw); } 
    else { this.seedData(); }
    if (!this.state.currentUser) {
      const admin = this.state.users.find(u => u.role === 'admin');
      this.state.currentUser = admin;
      localStorage.setItem('habitGoalsSession', admin.id);
    }
  },
  saveState() { localStorage.setItem('habitGoalsState', JSON.stringify(this.state)); },
  seedData() {
    const uid = () => Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];
    const endStr = new Date(Date.now() + 2592000000).toISOString().split('T')[0];
    this.state = {
      users: [{ id: uid(), name: 'Администратор', email: 'admin@demo.ru', password: '1234', role: 'admin', createdAt: now }],
      goals: [{ id: uid(), userId: null, title: 'Выработать дисциплину', startDate: todayStr, endDate: endStr, status: 'active' }],
      habits: [{ id: uid(), userId: null, goalId: null, title: 'Делать зарядку', period: 'daily', remindAt: '08:00' }],
      journal: [], notifications: [{ id: uid(), userId: null, text: 'Добро пожаловать в Habit Goals!', date: now, read: false }],
      auditLog: [{ action: 'Система инициализирована', at: now }]
    };
    this.state.goals[0].userId = this.state.users[0].id;
    this.state.habits[0].userId = this.state.users[0].id;
    this.state.notifications[0].userId = this.state.users[0].id;
    this.saveState();
  },
  currentUser() {
    const id = localStorage.getItem('habitGoalsSession');
    return this.state.users.find(u => u.id === id) || null;
  },
  login(email, password, name) {
    let user = this.state.users.find(u => u.email.toLowerCase() === email);
    if (!user) {
      if (!name?.trim()) { this.showToast('Пользователь не найден. Введите имя для регистрации.', 'error'); return false; }
      user = { id: Math.random().toString(36).substr(2,9), name: name.trim(), email: email.toLowerCase(), password, role: 'user', createdAt: new Date().toISOString() };
      this.state.users.push(user);
      this.audit(`Регистрация: ${email}`);
    } else if (user.password !== password) {
      this.showToast('Неверный пароль', 'error'); return false;
    }
    this.state.currentUser = user;
    localStorage.setItem('habitGoalsSession', user.id);
    this.audit(`Вход: ${email}`);
    this.showToast(`Добро пожаловать, ${user.name}!`, 'success');
    this.renderAll(); this.router(); return true;
  },
  logout() {
    this.state.currentUser = null;
    localStorage.removeItem('habitGoalsSession');
    this.showToast('Вы вышли из системы', 'info');
    this.renderAll(); this.router();
  },
  audit(action) {
    this.state.auditLog.unshift({ action, at: new Date().toISOString() });
    if (this.state.auditLog.length > 25) this.state.auditLog.pop();
    this.saveState();
  },
  showToast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${msg}`;
    this.els.toastContainer.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; setTimeout(() => el.remove(), 250); }, 3200);
  },
  router() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const target = document.getElementById(`view-${hash}`);
    if (!target) return window.location.hash = 'dashboard';
    this.els.views.forEach(v => v.classList.remove('active'));
    target.classList.add('active');
    this.els.navLinks.forEach(l => l.classList.toggle('active', l.dataset.nav === hash));
    const adminLink = document.querySelector('[data-nav="admin"]');
    if (adminLink) adminLink.style.display = this.currentUser()?.role === 'admin' ? 'block' : 'none';
    this.renderAll();
  },
  renderAll() {
    this.renderDashboard();
    this.renderGoals();
    this.renderHabits();
    this.renderAnalytics();
    this.renderProfile();
    this.renderAdmin();
    this.updateAuthUI();
  },
  updateAuthUI() {
    const user = this.currentUser();
    document.getElementById('authBtn').textContent = user ? 'Выйти' : 'Войти';
    document.getElementById('profileName').textContent = user ? user.name : 'Гость';
    document.getElementById('profileEmail').textContent = user ? user.email : '—';
    document.getElementById('profileRole').textContent = user ? (user.role === 'admin' ? 'Администратор' : 'Пользователь') : '—';
    document.getElementById('profileAvatar').textContent = user ? user.name.charAt(0).toUpperCase() : 'G';
  },
  renderDashboard() {
    const user = this.currentUser();
    const statsEl = document.getElementById('dashboardStats');
    if (!user) {
      statsEl.innerHTML = `<div class="card empty-state"><div class="empty-icon">🔒</div><h3>Требуется вход</h3><p>Войдите в систему, чтобы увидеть статистику и начать работу.</p><button class="btn btn-primary" onclick="window.location.hash='#profile'">Войти</button></div>`;
      return;
    }
    const goals = this.state.goals.filter(g => g.userId === user.id);
    const habits = this.state.habits.filter(h => h.userId === user.id);
    const journal = this.state.journal.filter(j => j.userId === user.id);
    const doneCount = journal.filter(j => j.done).length;
    const percent = journal.length ? Math.round((doneCount / journal.length) * 100) : 0;
    statsEl.innerHTML = `
      <div class="stat-box" style="background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:16px; display:grid; place-items:center; text-align:center;"><strong style="font-size:28px; margin-bottom:2px;">${goals.filter(g => g.status === 'active').length}</strong><span style="font-size:13px; color:var(--ink-muted);">Активных целей</span></div>
      <div class="stat-box" style="background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:16px; display:grid; place-items:center; text-align:center;"><strong style="font-size:28px; margin-bottom:2px;">${habits.length}</strong><span style="font-size:13px; color:var(--ink-muted);">Привычек</span></div>
      <div class="stat-box" style="background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:16px; display:grid; place-items:center; text-align:center;"><strong style="font-size:28px; margin-bottom:2px;">${percent}%</strong><span style="font-size:13px; color:var(--ink-muted);">Выполнено</span></div>
    `;
  },
  renderGoals() {
    const user = this.currentUser();
    const list = document.getElementById('goalsList');
    if (!user) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><h3>Цели не найдены</h3><p>Войдите, чтобы управлять целями.</p></div>`; return; }
    const goals = this.state.goals.filter(g => g.userId === user.id);
    const search = document.getElementById('goalSearch').value.toLowerCase();
    const filter = document.getElementById('goalFilter').value;
    const filtered = goals.filter(g => g.title.toLowerCase().includes(search) && (filter === 'all' || g.status === filter));
    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>Нет целей</h3><p>Создайте первую цель, чтобы начать путь к результату.</p><button class="btn btn-primary" id="emptyAddGoal">＋ Добавить цель</button></div>`;
      document.getElementById('emptyAddGoal')?.addEventListener('click', () => this.openModal('goal'));
      return;
    }
    list.innerHTML = filtered.map(g => `
      <div class="card item-card">
        <div class="item-top">
          <div><h3 style="margin:0; font-size:17px;">${this.escape(g.title)}</h3>
            <div class="item-meta"><span class="badge ${g.status === 'done' ? 'badge-success' : g.status === 'canceled' ? 'badge-danger' : 'badge-warning'}">${g.status === 'done' ? 'Достигнута' : g.status === 'canceled' ? 'Отменена' : 'Активна'}</span>
            <span>${this.fmtDate(g.startDate)} — ${this.fmtDate(g.endDate)}</span></div></div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="App.openModal('goal', '${g.id}')">✎</button>
            <button class="btn btn-danger btn-sm" onclick="App.deleteItem('goals', '${g.id}')">🗑</button>
          </div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${g.status === 'done' ? 100 : 0}%"></div></div>
      </div>
    `).join('');
  },
  renderHabits() {
    const user = this.currentUser();
    const list = document.getElementById('habitsList');
    if (!user) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><h3>Требуется вход</h3></div>`; return; }
    const habits = this.state.habits.filter(h => h.userId === user.id);
    const journal = this.state.journal.filter(j => j.userId === user.id);
    const search = document.getElementById('habitSearch').value.toLowerCase();
    const filter = document.getElementById('habitFilter').value;
    const filtered = habits.filter(h => {
      if (!h.title.toLowerCase().includes(search)) return false;
      const stats = this.habitStats(h.id, journal);
      if (filter === 'done') return stats.lastDone;
      if (filter === 'missed') return !stats.lastDone && stats.total > 0;
      return true;
    });
    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🌱</div><h3>Нет привычек</h3><p>Добавьте привычку, чтобы начать формировать серии.</p><button class="btn btn-primary" id="emptyAddHabit">＋ Добавить привычку</button></div>`;
      document.getElementById('emptyAddHabit')?.addEventListener('click', () => this.openModal('habit'));
      return;
    }
    list.innerHTML = filtered.map(h => {
      const stats = this.habitStats(h.id, journal);
      const streak = this.calcStreak(h.id, journal);
      const goal = this.state.goals.find(g => g.id === h.goalId);
      return `
        <div class="card item-card">
          <div class="item-top">
            <div><h3 style="margin:0; font-size:17px;">${this.escape(h.title)}</h3>
              <div class="item-meta"><span class="badge badge-neutral">${h.period === 'daily' ? 'Ежедневно' : 'Еженедельно'}</span>
              ${h.remindAt ? `<span>⏰ ${h.remindAt}</span>` : ''}
              ${goal ? `<span>🎯 ${this.escape(goal.title)}</span>` : ''}
              <span style="color:var(--success); font-weight:700;">🔥 ${streak}</span></div></div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-primary btn-sm" onclick="App.checkHabit('${h.id}', true)">✓</button>
              <button class="btn btn-ghost btn-sm" onclick="App.checkHabit('${h.id}', false)">✕</button>
              <button class="btn btn-ghost btn-sm" onclick="App.openModal('habit', '${h.id}')">✎</button>
              <button class="btn btn-danger btn-sm" onclick="App.deleteItem('habits', '${h.id}')">🗑</button>
            </div>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${stats.percent}%"></div></div>
          <div style="font-size:12px; color:var(--ink-muted);">Выполнено: ${stats.percent}% (${stats.done}/${stats.total})</div>
        </div>
      `;
    }).join('');
  },
  renderAnalytics() {
    const user = this.currentUser();
    if (!user) return;
    const journal = this.state.journal.filter(j => j.userId === user.id);
    const habits = this.state.habits.filter(h => h.userId === user.id);
    const done = journal.filter(j => j.done).length;
    const total = journal.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    let maxStreak = 0;
    habits.forEach(h => { const s = this.calcStreak(h.id, journal); if (s > maxStreak) maxStreak = s; });
    const last = journal[0];
    const lastText = last ? (last.done ? 'Выполнено' : 'Пропущено') : '—';
    document.getElementById('analyticsRate').textContent = `${percent}%`;
    document.getElementById('analyticsStreak').textContent = maxStreak;
    document.getElementById('analyticsLastAction').textContent = lastText;
    const chart = document.getElementById('chart');
    chart.innerHTML = habits.slice(0, 5).map(h => {
      const s = this.habitStats(h.id, journal);
      return `<div style="display:grid; grid-template-columns:100px 1fr 36px; gap:10px; align-items:center; margin-bottom:6px;"><div style="font-size:13px; font-weight:600;">${this.escape(h.title)}</div><div class="progress-track"><div class="progress-fill" style="width:${s.percent}%"></div></div><div style="text-align:right; font-size:13px;">${s.percent}%</div></div>`;
    }).join('');
  },
  renderProfile() {
    const user = this.currentUser();
    const log = document.getElementById('activityLog');
    if (!user) { log.innerHTML = '<div style="color:var(--ink-muted); text-align:center;">Войдите для просмотра</div>'; return; }
    const recent = this.state.journal.filter(j => j.userId === user.id).slice(0, 5);
    log.innerHTML = recent.length ? recent.map(j => {
      const h = this.state.habits.find(hab => hab.id === j.habitId);
      return `<div class="timeline-item"><div class="timeline-dot"></div><div style="display:flex; justify-content:space-between; align-items:center;"><span>${h ? this.escape(h.title) : 'Привычка'}</span><span class="badge ${j.done ? 'badge-success' : 'badge-danger'}">${j.done ? 'Выполнено' : 'Пропущено'}</span><span style="font-size:12px; color:var(--ink-muted);">${this.fmtDate(j.date)}</span></div></div>`;
    }).join('') : '<div style="color:var(--ink-muted); text-align:center; padding:12px;">Нет активности. Начните отмечать привычки!</div>';
  },
  renderAdmin() {
    const user = this.currentUser();
    if (!user || user.role !== 'admin') return;
    document.getElementById('usersList').innerHTML = this.state.users.map(u => `<tr><td>${this.escape(u.name)}</td><td>${this.escape(u.email)}</td><td><span class="badge ${u.role==='admin'?'badge-warning':'badge-neutral'}">${u.role}</span></td></tr>`).join('');
    document.getElementById('auditLog').innerHTML = this.state.auditLog.map(l => `<div class="timeline-item"><div class="timeline-dot"></div><div style="display:flex; justify-content:space-between; align-items:center;"><span>${this.escape(l.action)}</span><span style="font-size:12px; color:var(--ink-muted);">${this.fmtDate(l.at)}</span></div></div>`).join('');
  },
  openModal(type, id) {
    const tmpl = document.getElementById(`${type}Template`);
    if (!tmpl) return;
    const form = this.els.modalForm;
    form.innerHTML = '';
    form.appendChild(tmpl.content.cloneNode(true));
    this.els.modalTitle.textContent = id ? 'Редактирование' : 'Создание';
    this.els.modalSubtitle.textContent = id ? 'Измените параметры' : 'Заполните форму';
    if (type === 'habit') {
      const select = form.querySelector('select[name="goalId"]');
      const user = this.currentUser();
      const goals = this.state.goals.filter(g => g.userId === user.id);
      select.innerHTML = goals.map(g => `<option value="${g.id}">${this.escape(g.title)}</option>`).join('');
    }
    if (id) {
      const item = this.state[type === 'goal' ? 'goals' : 'habits'].find(i => i.id === id);
      if (item) {
        form.title.value = item.title;
        if (form.startDate) form.startDate.value = item.startDate;
        if (form.endDate) form.endDate.value = item.endDate;
        if (form.status) form.status.value = item.status;
        if (form.period) form.period.value = item.period;
        if (form.remindAt) form.remindAt.value = item.remindAt || '';
        if (form.goalId) form.goalId.value = item.goalId || '';
      }
    } else {
      if (form.startDate) form.startDate.value = new Date().toISOString().split('T')[0];
      if (form.endDate) { const d = new Date(); d.setDate(d.getDate() + 30); form.endDate.value = d.toISOString().split('T')[0]; }
    }
    this.validateForm(form);
    form.oninput = () => this.validateForm(form);
    form.onsubmit = (e) => { e.preventDefault(); this.saveModal(type, id, new FormData(form)); this.els.modal.close(); };
    this.els.modal.showModal();
  },
  validateForm(form) {
    let valid = true;
    form.querySelectorAll('[required]').forEach(input => {
      if (!input.value.trim()) { input.classList.add('invalid'); valid = false; } else { input.classList.remove('invalid'); }
    });
    this.els.modalSubmit.disabled = !valid;
  },
  saveModal(type, id, fd) {
    const user = this.currentUser();
    const data = { title: fd.get('title'), userId: user.id, startDate: fd.get('startDate'), endDate: fd.get('endDate'), status: fd.get('status'), period: fd.get('period'), remindAt: fd.get('remindAt'), goalId: fd.get('goalId') };
    const collection = type === 'goal' ? 'goals' : 'habits';
    if (id) {
      const idx = this.state[collection].findIndex(i => i.id === id);
      if (idx >= 0) Object.assign(this.state[collection][idx], data);
      this.audit(`Изменено: ${data.title}`);
      this.showToast('Сохранено', 'success');
    } else {
      this.state[collection].unshift({ id: Math.random().toString(36).substr(2,9), ...data });
      this.audit(`Создано: ${data.title}`);
      this.showToast('Создано успешно', 'success');
    }
    this.saveState(); this.renderAll();
  },
  deleteItem(collection, id) {
    if (!confirm('Удалить элемент?')) return;
    const idx = this.state[collection].findIndex(i => i.id === id);
    if (idx >= 0) { const item = this.state[collection].splice(idx, 1)[0]; this.audit(`Удалено: ${item.title}`); this.showToast('Удалено', 'info'); this.saveState(); this.renderAll(); }
  },
  checkHabit(habitId, done) {
    const user = this.currentUser();
    if (!user) return this.showToast('Войдите в систему', 'error');
    this.state.journal.unshift({ id: Math.random().toString(36).substr(2,9), habitId, userId: user.id, done, date: new Date().toISOString() });
    this.audit(`Отметка: ${done ? 'Выполнено' : 'Пропущено'}`);
    this.showToast(done ? 'Отлично! Так держать!' : 'Отмечено как пропуск', done ? 'success' : 'warning');
    this.saveState(); this.renderAll();
  },
  habitStats(habitId, journal) {
    const items = journal.filter(j => j.habitId === habitId);
    const done = items.filter(j => j.done).length;
    const total = items.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const last = items[0];
    return { done, total, percent, lastDone: last ? last.done : false };
  },
  calcStreak(habitId, journal) {
    const items = journal.filter(j => j.habitId === habitId && j.done).map(j => j.date.split('T')[0]);
    if (!items.length) return 0;
    const unique = [...new Set(items)].sort().reverse();
    let streak = 1;
    for (let i = 0; i < unique.length - 1; i++) {
      const d1 = new Date(unique[i]); const d2 = new Date(unique[i+1]);
      const diff = (d1 - d2) / (1000 * 60 * 60 * 24);
      if (diff === 1) streak++; else break;
    }
    return streak;
  },
  bindEvents() {
    document.getElementById('themeToggle').addEventListener('click', () => { document.documentElement.classList.toggle('dark'); localStorage.setItem('habitTheme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); });
    document.getElementById('authBtn').addEventListener('click', () => this.currentUser() ? this.logout() : this.openAuth());
    document.getElementById('addGoalBtn').addEventListener('click', () => this.openModal('goal'));
    document.getElementById('addHabitBtn').addEventListener('click', () => this.openModal('habit'));
    document.getElementById('quickAddGoal').addEventListener('click', () => this.openModal('goal'));
    document.getElementById('quickAddHabit').addEventListener('click', () => this.openModal('habit'));
    document.getElementById('qaCheckIn').addEventListener('click', () => { const h = this.state.habits.find(hab => hab.userId === this.currentUser()?.id); h ? this.checkHabit(h.id, true) : this.showToast('Сначала создайте привычку', 'warning'); });
    document.getElementById('qaNotify').addEventListener('click', () => this.showToast('Напоминание создано!', 'success'));
    document.getElementById('qaProgress').addEventListener('click', () => window.location.hash = '#analytics');
    document.getElementById('modalCancel').addEventListener('click', () => this.els.modal.close());
    document.getElementById('modalClose').addEventListener('click', () => this.els.modal.close());
    document.getElementById('resetDemoBtn').addEventListener('click', () => { if (confirm('Сбросить все данные?')) { localStorage.removeItem('habitGoalsState'); location.reload(); } });
    document.getElementById('goalSearch').addEventListener('input', () => this.renderGoals());
    document.getElementById('goalFilter').addEventListener('change', () => this.renderGoals());
    document.getElementById('habitSearch').addEventListener('input', () => this.renderHabits());
    document.getElementById('habitFilter').addEventListener('change', () => this.renderHabits());
  },
  openAuth() {
    const form = this.els.modalForm;
    form.innerHTML = document.getElementById('authTemplate').innerHTML;
    this.els.modalTitle.textContent = 'Вход / Регистрация';
    this.els.modalSubtitle.textContent = 'Введите данные для входа или регистрации';
    this.els.modalSubmit.textContent = 'Войти';
    const isReg = () => form.querySelector('input[name="name"]').value.trim().length > 0;
    form.oninput = () => {
      const nameField = document.getElementById('nameField');
      nameField.style.display = form.querySelector('input[name="name"]').value.trim() || form.querySelector('input[name="password"]').value.length > 4 ? 'grid' : 'none';
      this.els.modalSubmit.textContent = isReg() ? 'Зарегистрироваться' : 'Войти';
      this.validateForm(form);
    };
    form.onsubmit = (e) => { e.preventDefault(); const fd = new FormData(form); const success = this.login(fd.get('email'), fd.get('password'), fd.get('name')); if (success) this.els.modal.close(); };
    this.validateForm(form);
    this.els.modal.showModal();
  },
  applyTheme() {
    const theme = localStorage.getItem('habitTheme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
  },
  escape(str) { return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); },
  fmtDate(iso) { return new Date(iso).toLocaleDateString('ru-RU', { day:'numeric', month:'short' }); }
};

document.addEventListener('DOMContentLoaded', () => App.init());