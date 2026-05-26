export const defaultSettings = {
    theme: 'light',
    accentColor: '#2563eb',
    genre: 'original',
    instrument: 'piano',
    noteDuration: 0.2,
    saveNotifications: true,
    autosave: false
};


export let settingsState = { ...defaultSettings };

export function initSettings() {
    loadSettings();
    initThemeButtons();
    initColorButtons();
    initRange();

    document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);
    document.getElementById('btn-reset-settings')?.addEventListener('click', resetSettings);
}

function loadSettings() {
    const saved = localStorage.getItem('app-settings');
    if (saved) {
        settingsState = { ...defaultSettings, ...JSON.parse(saved) };
    }
    applySettings();
    fillSettingsUI();
}

function saveSettings() {
    collectSettings();
    localStorage.setItem('app-settings', JSON.stringify(settingsState));
    applySettings();


    if (settingsState.saveNotifications) {
        alert('Налаштування успішно збережено!');
    }
}

function resetSettings() {
    settingsState = { ...defaultSettings };
    localStorage.setItem('app-settings', JSON.stringify(settingsState));
    applySettings();
    fillSettingsUI();
    
    if (settingsState.saveNotifications) {
        alert('Налаштування скинуто до стандартних');
    }
}

function collectSettings() {
    const genreEl = document.getElementById('settings-genre');
    if (genreEl) settingsState.genre = genreEl.value;

    const instrEl = document.getElementById('settings-instrument');
    if (instrEl) settingsState.instrument = instrEl.value;

    const durEl = document.getElementById('settings-note-duration');
    if (durEl) settingsState.noteDuration = parseFloat(durEl.value);

    const notifEl = document.getElementById('settings-save-notifications');
    if (notifEl) settingsState.saveNotifications = notifEl.checked;

    const autoEl = document.getElementById('settings-autosave');
    if (autoEl) settingsState.autosave = autoEl.checked;

    const activeTheme = document.querySelector('.theme-btn.active');
    if (activeTheme) settingsState.theme = activeTheme.dataset.theme;

    const activeColor = document.querySelector('.color-dot.active');
    if (activeColor) settingsState.accentColor = activeColor.dataset.color;
}

function fillSettingsUI() {
    const genreEl = document.getElementById('settings-genre');
    if (genreEl) genreEl.value = settingsState.genre;

    const instrEl = document.getElementById('settings-instrument');
    if (instrEl) instrEl.value = settingsState.instrument;

    const durEl = document.getElementById('settings-note-duration');
    if (durEl) durEl.value = settingsState.noteDuration;

    const durValEl = document.getElementById('settings-note-duration-val');
    if (durValEl) durValEl.textContent = settingsState.noteDuration + 's';

    const notifEl = document.getElementById('settings-save-notifications');
    if (notifEl) notifEl.checked = settingsState.saveNotifications;

    const autoEl = document.getElementById('settings-autosave');
    if (autoEl) autoEl.checked = settingsState.autosave;

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === settingsState.theme);
    });

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.color === settingsState.accentColor);
    });
}

function applySettings() {

    document.body.setAttribute('data-theme', settingsState.theme);
    document.documentElement.style.setProperty('--accent-color', settingsState.accentColor);


    const mainGenreSelect = document.getElementById('genreSelect'); 
    const mainInstrSelect = document.getElementById('instrumentSelect'); 
    const mainNoteDur = document.getElementById('noteDuration'); 
    
    if (mainGenreSelect && settingsState.genre) mainGenreSelect.value = settingsState.genre;
    if (mainInstrSelect && settingsState.instrument) mainInstrSelect.value = settingsState.instrument;
    
    if (mainNoteDur && settingsState.noteDuration) {
        mainNoteDur.value = settingsState.noteDuration;
        const mainNoteDurVal = document.getElementById('noteDurationValue');
        if (mainNoteDurVal) mainNoteDurVal.textContent = settingsState.noteDuration + 's';
    }
}

function initThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function initColorButtons() {
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
        });
    });
}

function initRange() {
    document.getElementById('settings-note-duration')?.addEventListener('input', function () {
        const valEl = document.getElementById('settings-note-duration-val');
        if (valEl) valEl.textContent = this.value + 's';
    });
}