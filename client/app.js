document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initAuthForms();
    initGenerator();
    initExamples();
    initAudioEffects();

    try {
        const isLoggedIn = await window.api.checkAuthStatus();
        if (isLoggedIn) {
            updateUIForLoggedInUser();
            navigateTo('dashboard');
        } else {
            updateUIForLoggedOutUser();
            navigateTo('generator');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        updateUIForLoggedOutUser();
        navigateTo('generator');
    }
    document.getElementById('function-graph').addEventListener('click', () => {
        audioElement.play(); 
        window.visualization.startCursorAnimation();
    });
    const saveButton = document.querySelector('.btn-save');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Будь ласка, увійдіть у систему для збереження композиції!');
                return;
            }

            const functionInput = document.querySelector('.function-input').value;
            const title = prompt('Введіть назву композиції:', 'Нова композиція');
            if (!title || !functionInput) {
                alert('Назва та функція є обов’язковими!');
                return;
            }

            const compositionData = { title, function: functionInput };
            const result = await window.api.saveCompositionToServer(compositionData);

            if (result.success) {
                alert('Композиція збережена!');

                await window.api.loadUserCompositions();
            } else {
                alert('Помилка при збереженні: ' + result.message);
            }
        });
    } else {
        console.error('Button .btn-save not found in DOM');
    }
});

// ------------------------- NAVIGATION -------------------------
function initNavigation() {
    const loginLink = document.getElementById('nav-login');
    const dashboardLink = document.getElementById('nav-dashboard');
    const logoutLink = document.getElementById('nav-logout');

    loginLink?.addEventListener('click', e => {
        e.preventDefault();
        navigateTo('signin'); 
    });

    dashboardLink?.addEventListener('click', e => {
        e.preventDefault();
        navigateTo('dashboard');
        loadUserCompositions();
    });

    logoutLink?.addEventListener('click', e => {
        e.preventDefault();
        logoutUser();
    });
}

function navigateTo(page) {
    setActiveNav(`nav-${page}`);
    switchPage(`${page}-page`);
}

function setActiveNav(id) {
    document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
    const active = document.getElementById(id);
    if (active) active.classList.add('active');
}

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) target.style.display = 'block';
}

function addSwitchHandler(buttonId, hidePageId, showPageId) {
    const btn = document.getElementById(buttonId);
    if (btn) {
        btn.addEventListener('click', e => {
            e.preventDefault();
            switchPage(showPageId);
        });
    }
}

// ---------------------- AUTHENTICATION ----------------------
function initAuthForms() {
    document.getElementById('signin-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;

        try {
            const res = await window.api.login(email, password);
            if (res.success) {
                localStorage.setItem('token', res.token);
                localStorage.setItem('user', JSON.stringify(res.user));
                updateUIForLoggedInUser();
                navigateTo('generator');
            } else {
                showAuthMessage('signin-form', res.message || 'Помилка входу', 'error');
            }
        } catch (err) {
            showAuthMessage('signin-form', 'Помилка входу: ' + err.message, 'error');
        }
    });

    document.getElementById('signup-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;

        if (password !== confirm) {
            return showAuthMessage('signup-form', 'Паролі не співпадають', 'error');
        }

        try {
            const res = await window.api.register(email, password);
            if (res.success) {
                showAuthMessage('signup-form', 'Реєстрація успішна! Тепер увійдіть.', 'success');
                e.target.reset();
                setTimeout(() => navigateTo('signin'), 2000);
            } else {
                showAuthMessage('signup-form', res.message || 'Помилка реєстрації', 'error');
            }
        } catch (err) {
            showAuthMessage('signup-form', 'Помилка: ' + err.message, 'error');
        }
    });
}

function showAuthMessage(formId, message, type) {
    const msgEl = document.querySelector(`#${formId} .auth-message`);
    if (msgEl) {
        msgEl.textContent = message;
        msgEl.className = `auth-message ${type}`;
    }
}

// --------------------- UI UPDATES ---------------------
function updateUIForLoggedInUser() {
    const loginLink = document.getElementById('nav-login');
    const dashboardLink = document.getElementById('nav-dashboard');
    const logoutLink = document.getElementById('nav-logout');

    if (loginLink) loginLink.style.display = 'none';
    if (dashboardLink) dashboardLink.style.display = 'inline-block';
    if (logoutLink) logoutLink.style.display = 'inline-block';
}

function updateUIForLoggedOutUser() {
    const loginLink = document.getElementById('nav-login');
    const dashboardLink = document.getElementById('nav-dashboard');
    const logoutLink = document.getElementById('nav-logout');

    if (loginLink) loginLink.style.display = 'inline-block';
    if (dashboardLink) dashboardLink.style.display = 'none';
    if (logoutLink) logoutLink.style.display = 'none';
}

function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateUIForLoggedOutUser();
    navigateTo('generator');
}

// ---------------------- GENERATOR ----------------------
function initGenerator() {
    const generateButton = document.querySelector('.btn-generate');
    const functionInput = document.querySelector('.function-input');

    const resultContainer = document.querySelector('.result-container');
    resultContainer.innerHTML = `
        <label><input type="checkbox" id="amplitude-modulation"> Додати модуляцію гучності (на основі похідної)</label>
        <label><input type="checkbox" id="vibrato"> Додати вібрато (на основі другої похідної)</label>
        ${resultContainer.innerHTML}
    `;

    generateButton.addEventListener('click', function () {
        const functionExpression = functionInput.value;

        if (!functionExpression) {
            alert('Будь ласка, введіть математичну функцію');
            return;
        }

        const options = {
            useAmplitudeModulation: document.getElementById('amplitude-modulation').checked,
            useVibrato: document.getElementById('vibrato').checked
        };

        try {
            window.audioPlayer?.processAudioFromFunction?.(
                { functionString: functionExpression },
                options
            );
            console.log('🎼 Аудіо згенеровано');
        } catch (error) {
            alert('Помилка генерації: ' + error.message);
        }
    });

    const playBtn = document.querySelector('.btn-play');
    const pauseBtn = document.querySelector('.btn-pause');
    const stopBtn = document.querySelector('.btn-stop');
    const saveBtn = document.querySelector('.btn-save');
    const modifyBtn = document.querySelector('.btn-modify');

    playBtn?.addEventListener('click', () => {
        console.log('▶️ Відтворення');
        window.audioPlayer?.playMusic?.();
    });

    pauseBtn?.addEventListener('click', () => {
        console.log('⏸️ Пауза');
        window.audioPlayer?.pauseMusic?.();
    });

    stopBtn?.addEventListener('click', () => {
        console.log('⏹️ Стоп');
        window.audioPlayer?.stopMusic?.();
    });

    saveBtn?.addEventListener('click', () => {
        console.log('💾 Зберегти');
        window.api?.saveComposition?.()
            .then(res => {
                if (res.success) alert('Композицію збережено!');
                else alert('Помилка збереження: ' + res.message);
            })
            .catch(err => alert('Помилка: ' + err.message));
    });

    modifyBtn?.addEventListener('click', () => {
        console.log('✏️ Змінити');
        switchPage('generator-page');
    });

    if (window.audioPlayer?.initAudioPlayer) {
        window.audioPlayer.initAudioPlayer();
    }
    window.visualization?.drawFunctionGraph?.(functionExpression);
}


// ---------------------- EXAMPLES ----------------------
function initExamples() {
    document.querySelectorAll('.example-card button').forEach(button => {
        button.addEventListener('click', () => {
            const fn = button.parentElement.querySelector('.function')?.textContent;
            if (fn) {
                document.querySelector('.function-input').value = fn;
                navigateTo('generator');
                document.querySelector('.btn-generate')?.click();
            }
        });
    });

    window.visualization?.initExampleGraphs?.();
}

// ------------------ USER COMPOSITIONS ------------------
function loadUserCompositions() {
    window.api.loadUserCompositions()
        .then(data => {
            const container = document.getElementById('user-compositions');
            if (!container) return;

            container.innerHTML = '';
            if (!data.success) return alert('Помилка: ' + data.message);

            if (data.compositions.length === 0) {
                container.innerHTML = '<div class="no-compositions">У вас поки немає збережених композицій</div>';
                return;
            }

            data.compositions.forEach(comp => {
                const card = document.createElement('div');
                card.className = 'composition-card';
                card.innerHTML = `
                    <div class="composition-title">${comp.title}</div>
                    <div class="composition-function">${comp.function}</div>
                    <div class="composition-date">${new Date(comp.created_at).toLocaleString()}</div>
                    <div class="composition-actions">
                        <button class="btn-play">Відтворити</button>
                        <button class="btn-delete">Видалити</button>
                    </div>
                `;

                card.querySelector('.btn-play')?.addEventListener('click', () => playComposition(comp.function));
                card.querySelector('.btn-delete')?.addEventListener('click', () => deleteComposition(comp.id));

                container.appendChild(card);
            });
        })
        .catch(err => alert('Помилка завантаження: ' + err.message));
}

function deleteComposition(id) {
    window.api.deleteComposition(id)
        .then(data => {
            if (data.success) loadUserCompositions();
            else alert('Помилка при видаленні: ' + data.message);
        })
        .catch(err => alert('Помилка при видаленні: ' + err.message));
}
function saveAudioWAV() {
    if (!audioData) {
        alert("Немає згенерованої композиції");
        return;
    }

    exportWAV(audioData, (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'composition.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}


