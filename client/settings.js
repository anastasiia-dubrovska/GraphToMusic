const defaultSettings = {
    theme: 'light',
    accentColor: '#2563eb',
    language: 'ua',
    genre: 'original',
    instrument: 'piano',
    noteDuration: 0.2,
    saveNotifications: true,
    autosave: false
};

let settingsState = { ...defaultSettings };

export function initSettings() {

    loadSettings();

    initThemeButtons();
    initColorButtons();
    initRange();

    document.getElementById('btn-save-settings')
        ?.addEventListener('click', saveSettings);

    document.getElementById('btn-reset-settings')
        ?.addEventListener('click', resetSettings);
}

function loadSettings() {

    const saved = localStorage.getItem('app-settings');

    if (saved) {
        settingsState = {
            ...defaultSettings,
            ...JSON.parse(saved)
        };
    }

    applySettings();
    fillSettingsUI();
}

function saveSettings() {

    collectSettings();

    localStorage.setItem(
        'app-settings',
        JSON.stringify(settingsState)
    );

    applySettings();

    alert('Налаштування збережено');
}

function resetSettings() {

    settingsState = { ...defaultSettings };

    localStorage.setItem(
        'app-settings',
        JSON.stringify(settingsState)
    );

    applySettings();
    fillSettingsUI();

    alert('Скинуто');
}

function collectSettings() {

    settingsState.language =
        document.getElementById('settings-language').value;

    settingsState.genre =
        document.getElementById('settings-genre').value;

    settingsState.instrument =
        document.getElementById('settings-instrument').value;

    settingsState.noteDuration =
        document.getElementById('settings-note-duration').value;

    settingsState.saveNotifications =
        document.getElementById('settings-save-notifications').checked;

    settingsState.autosave =
        document.getElementById('settings-autosave').checked;

    const activeTheme =
        document.querySelector('.theme-btn.active');

    if (activeTheme) {
        settingsState.theme = activeTheme.dataset.theme;
    }

    const activeColor =
        document.querySelector('.color-dot.active');

    if (activeColor) {
        settingsState.accentColor = activeColor.dataset.color;
    }
}

function fillSettingsUI() {

    document.getElementById('settings-language').value =
        settingsState.language;

    document.getElementById('settings-genre').value =
        settingsState.genre;

    document.getElementById('settings-instrument').value =
        settingsState.instrument;

    document.getElementById('settings-note-duration').value =
        settingsState.noteDuration;

    document.getElementById('settings-note-duration-val').textContent =
        settingsState.noteDuration + 's';

    document.getElementById('settings-save-notifications').checked =
        settingsState.saveNotifications;

    document.getElementById('settings-autosave').checked =
        settingsState.autosave;

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle(
            'active',
            btn.dataset.theme === settingsState.theme
        );
    });

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.toggle(
            'active',
            dot.dataset.color === settingsState.accentColor
        );
    });
}

function applySettings() {
    document.body.setAttribute('data-theme', settingsState.theme);
    document.documentElement.style.setProperty('--accent-color', settingsState.accentColor);

    const genreSelect = document.getElementById('genreSelect');
    const instrSelect = document.getElementById('instrumentSelect');
    if (genreSelect && settingsState.genre) genreSelect.value = settingsState.genre;
    if (instrSelect && settingsState.instrument) instrSelect.value = settingsState.instrument;


    const noteDur = document.getElementById('noteDuration');
    if (noteDur && settingsState.noteDuration) {
        noteDur.value = settingsState.noteDuration;
        document.getElementById('noteDurationValue').textContent = settingsState.noteDuration + 's';
    }
}

function initThemeButtons() {

    document.querySelectorAll('.theme-btn').forEach(btn => {

        btn.addEventListener('click', () => {

            document.querySelectorAll('.theme-btn')
                .forEach(b => b.classList.remove('active'));

            btn.classList.add('active');
        });
    });
}

function initColorButtons() {

    document.querySelectorAll('.color-dot').forEach(dot => {

        dot.addEventListener('click', () => {

            document.querySelectorAll('.color-dot')
                .forEach(d => d.classList.remove('active'));

            dot.classList.add('active');
        });
    });
}

function initRange() {

    document.getElementById('settings-note-duration')
        ?.addEventListener('input', function () {

            document.getElementById(
                'settings-note-duration-val'
            ).textContent = this.value + 's';
        });
}