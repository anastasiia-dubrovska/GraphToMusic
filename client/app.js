document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initAuthForms();
    initGenerator();
    initExamples();
    initMusicToGraph();
    initAudioEffects?.();

    try {
        const isLoggedIn = await window.api?.checkAuthStatus?.();
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
});

function initNavigation() {
    const map = {
        'nav-generator': 'generator',
        'nav-examples': 'examples',
        'nav-info': 'info',
        'nav-instructions': 'instructions',
        'nav-login': 'signin',
        'nav-logout': 'logout'
    };

    Object.entries(map).forEach(([id, page]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', e => {
            e.preventDefault();
            if (page === 'logout') return logoutUser();
            navigateTo(page);
            if (page === 'dashboard') loadUserCompositions();
        });
    });

    document.getElementById('to-signup')?.addEventListener('click', e => { e.preventDefault(); navigateTo('signup'); });
    document.getElementById('to-signin')?.addEventListener('click', e => { e.preventDefault(); navigateTo('signin'); });
}

function navigateTo(page) {
    document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
    const active = document.getElementById(`nav-${page}`);
    if (active) active.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`${page}-page`);
    if (target) target.style.display = 'block';
}

function initAuthForms() {
    document.getElementById('signin-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;
        try {
            const res = await window.api?.login?.(email, password);
            if (res?.success) {
                showAuthMessage('signin-form', 'Вхід успішний', 'success');
                updateUIForLoggedInUser();
                navigateTo('dashboard');
                loadUserCompositions();
            } else {
                showAuthMessage('signin-form', res?.message || 'Помилка входу', 'error');
            }
        } catch (err) {
            showAuthMessage('signin-form', 'Помилка: ' + err.message, 'error');
        }
    });

    document.getElementById('signup-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;
        if (password !== confirm) return showAuthMessage('signup-form', 'Паролі не співпадають', 'error');
        try {
            const res = await window.api?.register?.(email, password);
            if (res?.success) {
                showAuthMessage('signup-form', 'Реєстрація успішна! Тепер увійдіть.', 'success');
                e.target.reset();
                setTimeout(() => navigateTo('signin'), 1200);
            } else {
                showAuthMessage('signup-form', res?.message || 'Помилка реєстрації', 'error');
            }
        } catch (err) {
            showAuthMessage('signup-form', 'Помилка: ' + err.message, 'error');
        }
    });
}

function showAuthMessage(formId, message, type) {
    const msgEl = document.querySelector(`#${formId} .auth-message`);
    if (!msgEl) return;
    msgEl.textContent = message;
    msgEl.className = `auth-message ${type}`;
}

function updateUIForLoggedInUser() {
    const loginLink = document.getElementById('nav-login');
    const logoutLink = document.getElementById('nav-logout');
    if (loginLink) loginLink.style.display = 'none';
    if (logoutLink) logoutLink.style.display = 'inline-block';
}

function updateUIForLoggedOutUser() {
    const loginLink = document.getElementById('nav-login');
    const logoutLink = document.getElementById('nav-logout');
    if (loginLink) loginLink.style.display = 'inline-block';
    if (logoutLink) logoutLink.style.display = 'none';
}

function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateUIForLoggedOutUser();
    navigateTo('generator');
}

function initGenerator() {
    const generateButton = document.querySelector('.btn-generate');
    const functionInput = document.querySelector('.function-input');
    const genreSelect = document.getElementById('genreSelect');
    const genreDescription = document.getElementById('genreDescription');
    const instrumentSelect = document.getElementById('instrumentSelect');

    if (genreSelect && genreDescription && window.genreEngine) {
        genreDescription.innerHTML = window.genreEngine.getGenreDescription(genreSelect.value);
        genreSelect.addEventListener('change', () => {
            genreDescription.innerHTML = window.genreEngine.getGenreDescription(genreSelect.value);
        });
    }

    if (instrumentSelect && window.genreEngine?.INSTRUMENT_PRESETS) {
        instrumentSelect.innerHTML = Object.keys(window.genreEngine.INSTRUMENT_PRESETS)
            .map(key => `<option value="${key}">${window.genreEngine.INSTRUMENT_PRESETS[key].name}</option>`)
            .join('');
    }

    generateButton?.addEventListener('click', () => {
        const functionExpression = functionInput?.value?.trim();
        if (!functionExpression) return alert('Будь ласка, введіть математичну функцію');


        const instruments = window.instrumentEngine?.getInstrumentSettings
            ? window.instrumentEngine.getInstrumentSettings()
            : [];

        const options = {
            useAmplitudeModulation: document.getElementById('amplitude-modulation')?.checked ?? false,
            useVibrato: document.getElementById('vibrato')?.checked ?? false,
            genre: document.getElementById('genreSelect')?.value || 'original',
            instrument: document.getElementById('instrumentSelect')?.value || 'piano',
            instruments
        };
        

        document.querySelector('.loading').style.display = 'block';
        try {
           const functionString = document.querySelector('.function-input')?.value?.trim();

            if (!functionString) {
                alert('Будь ласка, введіть математичну функцію');
                return;
            }

            window.audioPlayer.processAudioFromFunction(
                { functionString: functionString },
                options
            );
        } catch (error) {
            document.querySelector('.loading').style.display = 'none';
            alert('Помилка генерації: ' + error.message);
        }
    });

    document.querySelector('.btn-play')?.addEventListener('click', () => window.audioPlayer?.playMusic?.());
    document.querySelector('.btn-pause')?.addEventListener('click', () => window.audioPlayer?.pauseMusic?.());
    document.querySelector('.btn-stop')?.addEventListener('click', () => window.audioPlayer?.stopMusic?.());
    document.querySelector('.btn-save')?.addEventListener('click', () => window.audioPlayer?.saveComposition?.());
    document.querySelector('.btn-modify')?.addEventListener('click', () => navigateTo('generator'));

    window.audioPlayer?.initAudioPlayer?.();
}

function initExamples() {
    document.querySelectorAll('.example-card button').forEach(button => {
        button.addEventListener('click', () => {
            const fn = button.dataset.function || button.parentElement.querySelector('.function')?.textContent;
            if (!fn) return;
            document.querySelector('.function-input').value = fn;
            navigateTo('generator');
            document.querySelector('.btn-generate')?.click();
        });
    });
    window.visualization?.initExampleGraphs?.();
}

function initMusicToGraph() {
    const analyzeBtn = document.getElementById('analyzeMusicBtn');
    const fileInput = document.getElementById('musicFileInput');
    const status = document.getElementById('musicToGraphStatus');

    analyzeBtn?.addEventListener('click', async () => {
        const file = fileInput?.files?.[0];
        if (!file) return alert('Оберіть аудіофайл (wav/mp3/ogg)');
        if (status) status.textContent = 'Аналізую аудіо...';
        try {
            const result = await window.musicToGraph?.analyzeAudioFile?.(file);
            window.visualization?.renderAudioReverseGraph?.(result);
            if (status) status.textContent = 'Готово: графік побудовано.';
        } catch (error) {
            if (status) status.textContent = 'Помилка аналізу аудіо.';
            alert('Не вдалося проаналізувати файл: ' + error.message);
        }
    });
}

function loadUserCompositions() {
    window.api?.loadUserCompositions?.()
        .then(data => {
            const container = document.getElementById('user-compositions');
            if (!container) return;
            container.innerHTML = '';
            if (!data?.success) return;
            if (!data.compositions?.length) {
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
                    </div>
                `;
                card.querySelector('.btn-play')?.addEventListener('click', () => {
                    document.querySelector('.function-input').value = comp.function;
                    navigateTo('generator');
                    document.querySelector('.btn-generate')?.click();
                });
                container.appendChild(card);
            });
        })
        .catch(err => console.error('loadUserCompositions error', err));
}
function generateCurrentComposition() {
    const functionString = document.querySelector('.function-input')?.value?.trim();

    if (!functionString) {
        alert('Введіть основну функцію');
        return;
    }

    const instruments = window.instrumentEngine?.getInstrumentSettings
        ? window.instrumentEngine.getInstrumentSettings()
        : [];

    const options = {
        xRange: [
            parseFloat(document.getElementById('xMin')?.value || -10),
            parseFloat(document.getElementById('xMax')?.value || 10)
        ],
        pointCount: parseInt(document.getElementById('pointCount')?.value || 100, 10),
        noteDuration: parseFloat(document.getElementById('noteDuration')?.value || 0.2),
        useAmplitudeModulation:
            document.getElementById('amplitude-modulation')?.checked ||
            document.getElementById('amplitudeModulation')?.checked ||
            false,
        useVibrato:
            document.getElementById('vibrato')?.checked ||
            document.getElementById('vibratoEffect')?.checked ||
            false,
        genre: document.getElementById('genreSelect')?.value || 'original',
        instrument: document.getElementById('instrumentSelect')?.value || 'piano',
        instruments
    };

    const audioData = window.audioPlayer.processAudioFromFunction(
        { functionString },
        options
    );

    window.visualization.drawFunctionGraph(
        functionString,
        options.xRange,
        audioData
    );
}

window.generateCurrentComposition = generateCurrentComposition;