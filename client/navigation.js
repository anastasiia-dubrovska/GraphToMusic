document.addEventListener('DOMContentLoaded', async () => {

    let currentUser = null;
    const navLogin  = document.getElementById('nav-login');
    const navLogout = document.getElementById('nav-logout');


    function showPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        const page = document.getElementById(pageId);
        if (page) page.style.display = 'block';
    }

    function setActiveNav(activeId) {
        document.querySelectorAll('nav a, nav span').forEach(a => a.classList.remove('active'));
        if (activeId) document.getElementById(activeId)?.classList.add('active');
    }

    function getInitials(email) {
        return email ? email[0].toUpperCase() : '?';
    }

    function showMsg(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = `auth-message ${type}`;
    }


    function doLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        currentUser = null;
        updateUIForLoggedOutUser();
        showPage('generator-page');
        setActiveNav('nav-generator');
    }


    function updateUIForLoggedInUser() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        currentUser = user;

        navLogin.style.display = 'none';
        navLogout.style.display = 'inline-block';
        navLogout.innerHTML = `
          <span class="nav-profile-wrap" id="nav-profile-wrap">
              <span class="nav-avatar">${getInitials(user.email)}</span>
              <span class="nav-email">${user.email || 'Профіль'}</span>
              <span class="nav-arrow">▾</span>
              <span class="nav-dropdown" id="nav-dropdown">
                  <span class="nav-dropdown-item" id="nav-go-profile">👤 Мій профіль</span>
                  <span class="nav-dropdown-item" id="nav-go-dashboard">📁 Мої композиції</span>
                  <span class="nav-dropdown-item" id="nav-go-settings">⚙️ Налаштування</span>
                  <span class="nav-dropdown-divider"></span>
                  <span class="nav-dropdown-item nav-dropdown-logout" id="nav-do-logout">🚪 Вийти</span>
              </span>
          </span>
      `;
        
    }


    function updateUIForLoggedOutUser() {
        currentUser = null;
        navLogin.style.display = 'inline-block';
        navLogout.style.display = 'none';
        navLogout.innerHTML = '';
    }
    window.updateUIForLoggedInUser  = updateUIForLoggedInUser;
    window.updateUIForLoggedOutUser = updateUIForLoggedOutUser;

    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('nav-dropdown');


        if (e.target.closest('#nav-profile-wrap') && !e.target.closest('#nav-dropdown')) {
            if (dropdown) {
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            }
            return;
        }


        if (e.target.id === 'nav-go-dashboard') {
            if (dropdown) dropdown.style.display = 'none';
            showPage('dashboard-page');
            setActiveNav(null);
            window.api?.loadUserCompositions?.();
            return;
        }


        if (e.target.id === 'nav-do-logout') {
            if (dropdown) dropdown.style.display = 'none';
            doLogout();
            return;
        }


        if (dropdown && !e.target.closest('#nav-logout')) {
            dropdown.style.display = 'none';
        }

        if (e.target.id === 'nav-go-profile') {
          if (dropdown) dropdown.style.display = 'none';
          fillProfilePage();
          showPage('profile-page');
          setActiveNav(null);
          return;}

        if (e.target.id === 'nav-go-settings') {
            if (dropdown) dropdown.style.display = 'none';
            showPage('settings-page');
            setActiveNav(null);
            return;
        }

    });


    function fillProfilePage() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const email = user.email || '';
        const initial = getInitials(email);

        const avatarBig = document.getElementById('profile-avatar-big');
        if (avatarBig) avatarBig.textContent = initial;

        const emailTitle = document.getElementById('profile-email-title');
        if (emailTitle) emailTitle.textContent = email;

        const emailInput = document.getElementById('profile-email');
        if (emailInput) emailInput.value = email;

        const nameInput = document.getElementById('profile-name');
        if (nameInput) nameInput.value = user.name || '';

        const joined = document.getElementById('profile-joined');
        if (joined) joined.textContent = `Учасник з ${new Date().toLocaleDateString('uk-UA')}`;
    }


    let selectedRating = 0;
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('mouseover', () => {
            const val = parseInt(star.dataset.value);
            document.querySelectorAll('.star').forEach((s, i) => {
                s.classList.toggle('active', i < val);
            });
        });
        star.addEventListener('mouseout', () => {
            document.querySelectorAll('.star').forEach((s, i) => {
                s.classList.toggle('active', i < selectedRating);
            });
        });
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.value);
        });
    });


    document.getElementById('btn-send-feedback')?.addEventListener('click', async () => {
        const msg  = document.getElementById('feedback-msg');
        const text = document.getElementById('profile-feedback')?.value.trim();

        if (!selectedRating) {
            msg.textContent = 'Оберіть оцінку'; msg.style.color = '#dc2626'; return;
        }

        const btn = document.getElementById('btn-send-feedback');
        btn.textContent = 'Надсилання...';
        btn.disabled = true;

        const result = await window.api.sendFeedback(selectedRating, text);

        btn.textContent = 'Надіслати відгук';
        btn.disabled = false;

        if (result.success) {
            msg.textContent = '✓ Дякуємо за відгук!'; msg.style.color = '#16a34a';
            document.getElementById('profile-feedback').value = '';
            selectedRating = 0;
            document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
        } else {
            msg.textContent = result.message || 'Помилка'; msg.style.color = '#dc2626';
        }
    });


    document.getElementById('btn-change-password')?.addEventListener('click', async () => {
        const msg     = document.getElementById('password-msg');
        const oldPass = document.getElementById('profile-old-password')?.value;
        const newPass = document.getElementById('profile-new-password')?.value;
        const confirm = document.getElementById('profile-confirm-password')?.value;

        if (!oldPass || !newPass || !confirm) {
            msg.textContent = 'Заповніть всі поля'; msg.style.color = '#dc2626'; return;
        }
        if (newPass !== confirm) {
            msg.textContent = 'Паролі не співпадають'; msg.style.color = '#dc2626'; return;
        }
        if (newPass.length < 6) {
            msg.textContent = 'Пароль має бути мінімум 6 символів'; msg.style.color = '#dc2626'; return;
        }

        const btn = document.getElementById('btn-change-password');
        btn.textContent = 'Збереження...';
        btn.disabled = true;

        const result = await window.api.changePassword(oldPass, newPass);

        btn.textContent = 'Змінити пароль';
        btn.disabled = false;

        if (result.success) {
            msg.textContent = '✓ Пароль змінено'; msg.style.color = '#16a34a';
            document.getElementById('profile-old-password').value = '';
            document.getElementById('profile-new-password').value = '';
            document.getElementById('profile-confirm-password').value = '';
        } else {
            msg.textContent = result.message || 'Помилка'; msg.style.color = '#dc2626';
        }
    });
    document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
        const name = document.getElementById('profile-name')?.value.trim();
        const msgEl = document.getElementById('profile-save-msg');

        const btn = document.getElementById('btn-save-profile');
        btn.textContent = 'Збереження...';
        btn.disabled = true;

        const result = await window.api.updateProfile(name);

        btn.textContent = 'Зберегти зміни';
        btn.disabled = false;

        if (result.success) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            user.name = name;
            localStorage.setItem('user', JSON.stringify(user));
            if (msgEl) { msgEl.textContent = '✓ Збережено'; msgEl.style.color = '#16a34a'; }
        } else {
            if (msgEl) { msgEl.textContent = result.message; msgEl.style.color = '#dc2626'; }
        }
    });





    const navMap = {
        'nav-generator':    'generator-page',
        'nav-examples':     'examples-page',
        'nav-info':         'info-page',
        'nav-instructions': 'instructions-page',
        'nav-login':        'signin-page',
    };

    Object.entries(navMap).forEach(([navId, pageId]) => {
        document.getElementById(navId)?.addEventListener('click', e => {
            e.preventDefault();
            showPage(pageId);
            setActiveNav(navId);
            if (pageId === 'examples-page') {
                setTimeout(() => window.visualization?.initExampleGraphs?.(), 100);
            }
        });
    });


    document.getElementById('signin-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email    = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value.trim();
        const msgEl    = document.querySelector('#signin-form .auth-message');

        if (!email || !password) { showMsg(msgEl, 'Введіть email і пароль', 'error'); return; }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.textContent = 'Завантаження...';
        btn.disabled = true;

        const result = await window.api.login(email, password);

        btn.textContent = 'Увійти';
        btn.disabled = false;

        if (result.success || result.token) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user || { email }));
            updateUIForLoggedInUser();
            showPage('generator-page');
            setActiveNav('nav-generator');
        } else {
            showMsg(msgEl, result.message || 'Помилка входу', 'error');
        }
    });


    document.getElementById('signup-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email    = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value.trim();
        const confirm  = document.getElementById('signup-confirm').value.trim();
        const msgEl    = document.querySelector('#signup-form .auth-message');

        if (!email || !password || !confirm) { showMsg(msgEl, 'Заповніть всі поля', 'error'); return; }
        if (password !== confirm) { showMsg(msgEl, 'Паролі не співпадають', 'error'); return; }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.textContent = 'Завантаження...';
        btn.disabled = true;

        const result = await window.api.register(email, password);

        btn.textContent = 'Зареєструватися';
        btn.disabled = false;

        if (result.success || result.token) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user || { email }));
            updateUIForLoggedInUser();
            showPage('generator-page');
            setActiveNav('nav-generator');
        } else {
            showMsg(msgEl, result.message || 'Помилка реєстрації', 'error');
        }
    });


    document.getElementById('to-signup')?.addEventListener('click', e => {
        e.preventDefault(); showPage('signup-page'); setActiveNav('nav-login');
    });
    document.getElementById('to-signin')?.addEventListener('click', e => {
        e.preventDefault(); showPage('signin-page'); setActiveNav('nav-login');
    });

    document.getElementById('to-forgot')?.addEventListener('click', e => {
        e.preventDefault(); showPage('forgot-page'); setActiveNav('nav-login');
    });
    document.getElementById('to-signin-from-forgot')?.addEventListener('click', e => {
        e.preventDefault(); showPage('signin-page'); setActiveNav('nav-login');
    });

    document.getElementById('forgot-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim();
        const msgEl = document.querySelector('#forgot-form .auth-message');

        if (!email) { showMsg(msgEl, 'Введіть email', 'error'); return; }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.textContent = 'Надсилання...';
        btn.disabled = true;

        const result = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        }).then(r => r.json());

        btn.textContent = 'Надіслати';
        btn.disabled = false;

        showMsg(msgEl, 'Якщо такий email існує — лист надіслано', 'success');
        document.getElementById('forgot-email').value = '';
    });


    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('.example-card').forEach(card => {
                card.classList.toggle('hidden', filter !== 'all' && card.dataset.category !== filter);
            });
        });
    });


    function goToGenerator(fn, genre, instrument, addFn, addInstr) {
        showPage('generator-page');
        setActiveNav('nav-generator');
        document.querySelector('.function-input').value = fn;
        const genreSelect = document.getElementById('genreSelect');
        const instrSelect = document.getElementById('instrumentSelect');
        if (genreSelect) genreSelect.value = genre;
        if (instrSelect) instrSelect.value = instrument;

        if (addFn) {
            setTimeout(() => {
                document.getElementById('addInstrumentBtn')?.click();
                setTimeout(() => {
                    const cards = document.querySelectorAll('.instrument-card');
                    const last  = cards[cards.length - 1];
                    if (last) {
                        const fnInput  = last.querySelector('input[type="text"], input:not([type="range"])');
                        const instrSel = last.querySelector('select');
                        if (fnInput)  fnInput.value  = addFn;
                        if (instrSel) instrSel.value = addInstr;
                    }
                    document.getElementById('applyInstrumentsBtn')?.click();
                }, 100);
            }, 200);
        }
        setTimeout(() => document.querySelector('.btn-generate')?.click(), 400);
    }

    document.querySelectorAll('.try-example').forEach(btn => {
        btn.addEventListener('click', () => {
            goToGenerator(
                btn.dataset.function,
                document.getElementById('exampleGenre')?.value || 'original',
                document.getElementById('exampleInstrument')?.value || 'piano',
                null, null
            );
        });
    });

    document.querySelectorAll('.try-example-poly').forEach(btn => {
        btn.addEventListener('click', () => {
            const [addFn, addInstr] = (btn.dataset.add || '').split('|');
            goToGenerator(
                btn.dataset.function,
                document.getElementById('exampleGenre')?.value || 'original',
                document.getElementById('exampleInstrument')?.value || 'piano',
                addFn, addInstr || 'synth'
            );
        });
    });


    const token = localStorage.getItem('token');
    if (token) {
        const ok = await window.api?.checkAuthStatus?.();
        if (ok) updateUIForLoggedInUser();
        else updateUIForLoggedOutUser();
    } else {
        updateUIForLoggedOutUser();
    }

    showPage('generator-page');
    setActiveNav('nav-generator');
});