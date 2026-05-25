import { initSettings } from './settings.js';

document.addEventListener('DOMContentLoaded', async () => {
    initGenerator();
    initExamples();
    initAudioEffects?.();
    initSettings();
});

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`${page}-page`);
    if (target) target.style.display = 'block';
    document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
    document.getElementById(`nav-${page}`)?.classList.add('active');
}


function updateUIForLoggedInUser() {
    window.updateUIForLoggedInUser?.();
}
function updateUIForLoggedOutUser() {
    window.updateUIForLoggedOutUser?.();
}
function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.updateUIForLoggedOutUser?.();
    navigateTo('generator');
}

function initGenerator() {
    const generateButton = document.querySelector('.btn-generate');
    const functionInput  = document.querySelector('.function-input');
    const genreSelect    = document.getElementById('genreSelect');
    const genreDesc      = document.getElementById('genreDescription');
    const instrSelect    = document.getElementById('instrumentSelect');

    if (genreSelect && genreDesc && window.genreEngine) {
        genreDesc.innerHTML = window.genreEngine.getGenreDescription(genreSelect.value);
        genreSelect.addEventListener('change', () => {
            genreDesc.innerHTML = window.genreEngine.getGenreDescription(genreSelect.value);
        });
    }

    if (instrSelect && window.genreEngine?.INSTRUMENT_PRESETS) {
        instrSelect.innerHTML = Object.keys(window.genreEngine.INSTRUMENT_PRESETS)
            .map(key => `<option value="${key}">${window.genreEngine.INSTRUMENT_PRESETS[key].name}</option>`)
            .join('');
    }

    generateButton?.addEventListener('click', () => {
        const functionString = functionInput?.value?.trim();
        if (!functionString) return alert('Будь ласка, введіть математичну функцію');

        const instruments = window.instrumentEngine?.getInstrumentSettings?.() || [];
        const options = {
            xRange: [
                parseFloat(document.getElementById('xMin')?.value || -10),
                parseFloat(document.getElementById('xMax')?.value || 10)
            ],
            pointCount:           parseInt(document.getElementById('pointCount')?.value || 100),
            noteDuration:         parseFloat(document.getElementById('noteDuration')?.value || 0.2),
            useAmplitudeModulation: document.getElementById('amplitude-modulation')?.checked ||
                                    document.getElementById('amplitudeModulation')?.checked || false,
            useVibrato:           document.getElementById('vibrato')?.checked ||
                                    document.getElementById('vibratoEffect')?.checked || false,
            genre:      document.getElementById('genreSelect')?.value || 'original',
            instrument: document.getElementById('instrumentSelect')?.value || 'piano',
            instruments
        };

        document.querySelector('.loading').style.display = 'block';
        try {
            window.audioPlayer.processAudioFromFunction({ functionString }, options);
        } catch (error) {
            document.querySelector('.loading').style.display = 'none';
            alert('Помилка генерації: ' + error.message);
        }
    });

    document.querySelector('.btn-play')?.addEventListener('click',   () => window.audioPlayer?.playMusic?.());
    document.querySelector('.btn-pause')?.addEventListener('click',  () => window.audioPlayer?.pauseMusic?.());
    document.querySelector('.btn-stop')?.addEventListener('click',   () => window.audioPlayer?.stopMusic?.());
    document.querySelector('.btn-modify')?.addEventListener('click', () => navigateTo('generator'));
    document.addEventListener('click', async (e) => {
        if (!e.target.closest('.btn-save')) return;

        if (isSaving) return;
        isSaving = true;

        try {
            if (!confirm('Зберегти композицію?')) return;

            const result = await window.api.saveCompositionToServer(data);

            alert(result.success ? 'Збережено' : result.message);

        } finally {
            isSaving = false;
        }
    });}

function initExamples() {
    window.visualization?.initExampleGraphs?.();
}

function loadUserCompositions() {
    window.api?.loadUserCompositions?.()
        .then(data => {
            const container = document.getElementById('user-compositions');
            if (!container) return;
            container.innerHTML = '';
            if (!data?.success || !data.compositions?.length) {
                container.innerHTML = '<div class="no-compositions">У вас поки немає збережених композицій</div>';
                return;
            }
            data.compositions.forEach(comp => {
                const card = document.createElement('div');
                card.className = 'composition-card';
                card.innerHTML = `
                    <div class="composition-title">${comp.title || 'Без назви'}</div>
                    <div class="composition-function">${comp.function}</div>
                    <div class="composition-date">${new Date(comp.created_at).toLocaleString()}</div>
                    <div class="composition-actions">
                        <button class="btn-play-comp">▶ Відтворити</button>
                        <button class="btn-delete-comp">🗑 Видалити</button>
                    </div>
                `;
                card.querySelector('.btn-play-comp')?.addEventListener('click', () => {
                    document.querySelector('.function-input').value = comp.function;
                    navigateTo('generator');
                    document.querySelector('.btn-generate')?.click();
                });
                card.querySelector('.btn-delete-comp')?.addEventListener('click', () => {
                    if (confirm('Видалити композицію?')) {
                        window.api?.deleteComposition?.(comp.id);
                    }
                });
                container.appendChild(card);
            });
        })
        .catch(err => console.error('loadUserCompositions error', err));
}

function generateCurrentComposition() {
    const functionString = document.querySelector('.function-input')?.value?.trim();
    if (!functionString) { alert('Введіть основну функцію'); return; }

    const instruments = window.instrumentEngine?.getInstrumentSettings?.() || [];
    const options = {
        xRange: [
            parseFloat(document.getElementById('xMin')?.value || -10),
            parseFloat(document.getElementById('xMax')?.value || 10)
        ],
        pointCount:             parseInt(document.getElementById('pointCount')?.value || 100),
        noteDuration:           parseFloat(document.getElementById('noteDuration')?.value || 0.2),
        useAmplitudeModulation: document.getElementById('amplitude-modulation')?.checked ||
                                document.getElementById('amplitudeModulation')?.checked || false,
        useVibrato:             document.getElementById('vibrato')?.checked ||
                                document.getElementById('vibratoEffect')?.checked || false,
        genre:      document.getElementById('genreSelect')?.value || 'original',
        instrument: document.getElementById('instrumentSelect')?.value || 'piano',
        instruments
    };

    const audioData = window.audioPlayer.processAudioFromFunction({ functionString }, options);
    window.visualization.drawFunctionGraph(functionString, options.xRange, audioData);
}
function once(fn) {
    let called = false;
    return function (...args) {
        if (called) return;
        called = true;
        return fn.apply(this, args);
    };
}

window.generateCurrentComposition = generateCurrentComposition;
window.loadUserCompositions = loadUserCompositions;