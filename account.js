/* Manifest Rush player account + leaderboard client.
   Browser receives only public Supabase configuration. */
(() => {
  const url = window.MANIFEST_SUPABASE_URL;
  const key = window.MANIFEST_SUPABASE_PUBLISHABLE_KEY;
  const configured = /^https:\/\/.+\.supabase\.co\/?$/.test(url || "") &&
                     !!key && !key.startsWith("PASTE_") && !!window.supabase;
  const client = configured ? window.supabase.createClient(url, key) : null;
  let currentUser = null;
  let currentProfile = null;
  let mode = 'register';
  let leaderboardReturn = 'home-screen';
  const $ = id => document.getElementById(id);
  const errorMessage = message => { $('account-error').textContent = message; };
  const functionUrl = configured ? `${url.replace(/\/$/, '')}/functions/v1/player-auth` : '';

  async function restoreSession() {
    if (!client) return;
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    currentUser = user;
    const { data: profile } = await client.from('players').select('username,character_id').eq('id', user.id).maybeSingle();
    currentProfile = profile;
    refreshUsername();
    // Never carry a previous player's selected character into another account.
    document.querySelectorAll('.character-card.selected').forEach(card => card.classList.remove('selected'));
    if (currentProfile?.character_id) {
      localStorage.setItem('manifestCharacter', currentProfile.character_id);
      document.querySelector(`.character-card[data-character="${currentProfile.character_id}"]`)?.click();
    } else {
      localStorage.removeItem('manifestCharacter');
      if (typeof selectedCharacter !== 'undefined') selectedCharacter = null;
      const confirm = $('confirm-character');
      if (confirm) confirm.disabled = true;
      const chosen = $('selected-name');
      if (chosen) chosen.textContent = 'Select your character';
    }
  }

  function refreshUsername() {
    if ($('game-account-name')) $('game-account-name').textContent = currentProfile?.username || '—';
  }

  function switchMode(nextMode) {
    mode = nextMode;
    $('tab-register').classList.toggle('active', mode === 'register');
    $('tab-login').classList.toggle('active', mode === 'login');
    $('account-title').textContent = mode === 'register' ? 'JOIN THE RUSH!' : 'WELCOME BACK!';
    $('account-submit').textContent = mode === 'register' ? 'CREATE ACCOUNT →' : 'LOGIN →';
    $('account-password').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    $('account-hint').textContent = mode === 'register'
      ? 'Kullanıcı adı: 3–20 karakter; harf, rakam veya _. Şifre: en az 8 karakter.'
      : 'Daha önce oluşturduğun kullanıcı adı ve şifreyle giriş yap.';
    errorMessage('');
  }

  async function openGate() {
    if (!configured) {
      showScreen('auth-screen');
      errorMessage('Supabase henüz bağlanmadı. SETUP.md dosyasındaki kurulumu tamamla.');
      return;
    }
    try { await restoreSession(); } catch (e) { console.error(e); }
    if (currentUser) showScreen('character-screen');
    else { showScreen('auth-screen'); errorMessage(''); }
  }

  async function submitAccount(event) {
    event.preventDefault();
    if (!configured) { errorMessage('Supabase yapılandırması eksik; SETUP.md dosyasını izle.'); return; }
    const username = $('account-username').value.trim();
    const password = $('account-password').value;
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      errorMessage('Kullanıcı adı 3–20 karakter; sadece harf, rakam ve _ içerebilir.'); return;
    }
    if (password.length < 8) { errorMessage('Şifre en az 8 karakter olmalı.'); return; }
    const btn = $('account-submit');
    btn.disabled = true;
    errorMessage('');
    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify({ action: mode, username, password })
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || `HTTP ${response.status}`);
      const { error } = await client.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token
      });
      if (error) throw error;
      await restoreSession();
      if (!currentUser) throw new Error('Oturum doğrulanamadı.');
      $('account-password').value = '';
      showScreen('character-screen');
    } catch (error) {
      errorMessage(error.message || 'Bağlantı hatası. Tekrar dene.');
    } finally { btn.disabled = false; }
  }

  async function saveCharacter(characterId) {
    if (!client || !currentUser) return;
    const { error } = await client.from('players').update({ character_id: characterId }).eq('id', currentUser.id);
    if (error) throw error;
    if (currentProfile) currentProfile.character_id = characterId;
  }

  async function saveScore(levelId, score) {
    if (!client || !currentUser) throw new Error('Puan kaydetmek için giriş yapılmalı.');
    const points = Math.max(0, Math.min(400, Math.round(score)));
    const { error } = await client.rpc('submit_level_score', { p_level: levelId, p_points: points });
    if (error) throw error;
  }

  async function openLeaderboard() {
    leaderboardReturn = document.querySelector('.screen.active')?.id || 'home-screen';
    showScreen('leaderboard-screen');
    const tbody = $('leaderboard-body');
    tbody.replaceChildren();
    $('leaderboard-status').textContent = 'Sıralama yükleniyor...';
    if (!configured) {
      $('leaderboard-status').textContent = 'Sıralama için önce Supabase kurulumunu tamamla.'; return;
    }
    try {
      const { data, error } = await client.from('global_leaderboard')
        .select('username,total_score,completed_levels').order('total_score', { ascending: false }).limit(50);
      if (error) throw error;
      if (!data?.length) { $('leaderboard-status').textContent = 'Henüz kayıtlı puan yok. İlk sen ol!'; return; }
      $('leaderboard-status').textContent = 'Her levelde yalnızca en yüksek puan sayılır.';
      data.forEach((item, index) => {
        const tr = document.createElement('tr');
        if (currentProfile && item.username === currentProfile.username) tr.className = 'me';
        for (const value of [`#${index + 1}`, item.username, String(item.total_score)]) {
          const td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    } catch (e) { $('leaderboard-status').textContent = 'Sıralama yüklenemedi: ' + e.message; }
  }

  $('tab-register')?.addEventListener('click', () => switchMode('register'));
  $('tab-login')?.addEventListener('click', () => switchMode('login'));
  $('player-auth-form')?.addEventListener('submit', submitAccount);
  $('account-back')?.addEventListener('click', () => showScreen('home-screen'));
  $('leaderboard-home')?.addEventListener('click', openLeaderboard);
  $('leaderboard-game')?.addEventListener('click', openLeaderboard);
  $('leaderboard-back')?.addEventListener('click', () => showScreen(leaderboardReturn));
  window.ManifestAccount = { openGate, saveCharacter, saveScore, openLeaderboard };
  restoreSession().catch(console.error);
})();
