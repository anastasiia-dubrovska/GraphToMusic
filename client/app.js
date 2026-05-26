import { initSettings, settingsState } from './settings.js';

window.__isSavingTrack = false;
window.__isLiveModeEnabled = false;

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

function updateUIForLoggedInUser() { window.updateUIForLoggedInUser?.(); }
function updateUIForLoggedOutUser() { window.updateUIForLoggedOutUser?.(); }

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

    generateButton?.addEventListener('click', async () => {
        const functionString = functionInput?.value?.trim();
        if (!functionString) return alert('Будь ласка, введіть математичну функцію');

        const instruments = window.instrumentEngine?.getInstrumentSettings?.() || [];
        const options = {
            xRange: [parseFloat(document.getElementById('xMin')?.value || -10), parseFloat(document.getElementById('xMax')?.value || 10)],
            pointCount:           parseInt(document.getElementById('pointCount')?.value || 100),
            noteDuration:         parseFloat(document.getElementById('noteDuration')?.value || 0.2),
            useAmplitudeModulation: document.getElementById('amplitude-modulation')?.checked || document.getElementById('amplitudeModulation')?.checked || false,
            useVibrato:           document.getElementById('vibrato')?.checked || document.getElementById('vibratoEffect')?.checked || false,
            genre:      document.getElementById('genreSelect')?.value || 'original',
            instrument: document.getElementById('instrumentSelect')?.value || 'piano',
            instruments
        };

        const loadingSpinner = document.querySelector('.loading');
        if (loadingSpinner) loadingSpinner.style.display = 'block';

        try {
            if (window.audioPlayer && window.audioPlayer.processAudioFromFunction) {
                window.audioPlayer.processAudioFromFunction({ functionString }, options);

                if (settingsState.autosave && window.api?.saveCompositionToServer) {
                    const autoData = { title: `Автозбереження (${new Date().toLocaleTimeString()})`, function: functionString };
                    const result = await window.api.saveCompositionToServer(autoData);
                    if (result.success && settingsState.saveNotifications) console.log('Автозбереження: трек збережено!');
                }
            }
        } catch (error) {
            alert('Помилка генерації: ' + error.message);
        } finally {
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        }
    });

    document.querySelector('.btn-play')?.addEventListener('click',   () => window.audioPlayer?.playMusic?.());
    document.querySelector('.btn-pause')?.addEventListener('click',  () => window.audioPlayer?.pauseMusic?.());
    document.querySelector('.btn-stop')?.addEventListener('click',   () => window.audioPlayer?.stopMusic?.());

    const btnModify = document.querySelector('.btn-modify');
    if (btnModify) {
        const newBtnModify = btnModify.cloneNode(true);
        btnModify.parentNode.replaceChild(newBtnModify, btnModify);
        
        newBtnModify.addEventListener('click', () => {
            navigateTo('generator');
            const funcInput = document.querySelector('.function-input');
            if (funcInput) funcInput.focus();

            if (!window.__isLiveModeEnabled) {
                window.__isLiveModeEnabled = true;
                
                newBtnModify.innerText = '✨ Live Режим';
                newBtnModify.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                newBtnModify.style.boxShadow = '0 10px 24px rgba(16, 185, 129, 0.3)';
                newBtnModify.style.color = '#fff';
                newBtnModify.style.border = 'none';
                
                const safeLiveUpdate = () => {
                    clearTimeout(window.__liveUpdateTimer);
                    window.__liveUpdateTimer = setTimeout(() => {

                        if (!window.audioPlayer || !window.audioPlayer.processAudioFromFunction) return;

                        const functionString = document.querySelector('.function-input')?.value?.trim();
                        if (!functionString) return;

                        try {
                            const options = {
                                xRange: [parseFloat(document.getElementById('xMin')?.value || -10), parseFloat(document.getElementById('xMax')?.value || 10)],
                                pointCount: parseInt(document.getElementById('pointCount')?.value || 100),
                                noteDuration: parseFloat(document.getElementById('noteDuration')?.value || 0.2),
                                useAmplitudeModulation: document.getElementById('amplitude-modulation')?.checked || document.getElementById('amplitudeModulation')?.checked || false,
                                useVibrato: document.getElementById('vibrato')?.checked || document.getElementById('vibratoEffect')?.checked || false,
                                genre: document.getElementById('genreSelect')?.value || 'original',
                                instrument: document.getElementById('instrumentSelect')?.value || 'piano',
                                instruments: window.instrumentEngine?.getInstrumentSettings?.() || []
                            };

                            const audioData = window.audioPlayer.processAudioFromFunction({ functionString }, options);
                            window.visualization.drawFunctionGraph(functionString, options.xRange, audioData);
                            window.audioPlayer?.playMusic?.();
                        } catch (err) {}
                    }, 600);
                };

                document.querySelector('.function-input')?.addEventListener('input', safeLiveUpdate);
                document.getElementById('xMin')?.addEventListener('input', safeLiveUpdate);
                document.getElementById('xMax')?.addEventListener('input', safeLiveUpdate);
                document.getElementById('noteDuration')?.addEventListener('input', safeLiveUpdate);
                document.getElementById('genreSelect')?.addEventListener('change', safeLiveUpdate);
                document.getElementById('instrumentSelect')?.addEventListener('change', safeLiveUpdate);
            }
        });
    }

    const saveBtns = document.querySelectorAll('.btn-save');
    saveBtns.forEach(saveBtn => {
        const cleanBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(cleanBtn, saveBtn);

        cleanBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();

            if (window.__isSavingTrack) return;
            window.__isSavingTrack = true;

            const originalText = cleanBtn.innerText;
            cleanBtn.innerText = 'Збереження...';
            cleanBtn.style.opacity = '0.6';
            cleanBtn.style.pointerEvents = 'none';

            try {
                const functionString = document.querySelector('.function-input')?.value?.trim();
                if (!functionString) {
                    if (settingsState.saveNotifications) alert('Немає функції для збереження!');
                    return;
                }

                const title = prompt('Введіть назву композиції (або "Скасувати", щоб передумати):', 'Моя композиція');
                if (title === null) return; 
                
                const finalTitle = title.trim() || 'Моя композиція';
                const result = await window.api.saveCompositionToServer({ title: finalTitle, function: functionString });

                if (settingsState.saveNotifications) alert(result.success ? 'Успішно збережено!' : 'Помилка: ' + result.message);
                if (document.getElementById('dashboard-page')?.style.display === 'block') loadUserCompositions();
            } catch (err) {
                console.error(err);
            } finally {
                window.__isSavingTrack = false;
                cleanBtn.innerText = originalText;
                cleanBtn.style.opacity = '1';
                cleanBtn.style.pointerEvents = 'auto';
            }
        });
    });
}

function initExamples() { window.visualization?.initExampleGraphs?.(); }

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
                const dateObj = new Date(comp.created_at);
                const formattedDate = dateObj.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                const card = document.createElement('div');
                card.className = 'composition-card';
                card.innerHTML = `
                    <div class="composition-title">${comp.title || 'Без назви'}</div>
                    <div class="composition-function">${comp.function}</div>
                    <div class="composition-date">Створено: ${formattedDate}</div>
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
                    if (confirm('Видалити композицію?')) window.api?.deleteComposition?.(comp.id).then(() => loadUserCompositions());
                });
                container.appendChild(card);
            });
        })
        .catch(err => console.error(err));
}

function generateCurrentComposition() {
    const functionString = document.querySelector('.function-input')?.value?.trim();
    if (!functionString) return alert('Введіть основну функцію');

    const options = {
        xRange: [parseFloat(document.getElementById('xMin')?.value || -10), parseFloat(document.getElementById('xMax')?.value || 10)],
        pointCount:             parseInt(document.getElementById('pointCount')?.value || 100),
        noteDuration:           parseFloat(document.getElementById('noteDuration')?.value || 0.2),
        useAmplitudeModulation: document.getElementById('amplitude-modulation')?.checked || document.getElementById('amplitudeModulation')?.checked || false,
        useVibrato:             document.getElementById('vibrato')?.checked || document.getElementById('vibratoEffect')?.checked || false,
        genre:      document.getElementById('genreSelect')?.value || 'original',
        instrument: document.getElementById('instrumentSelect')?.value || 'piano',
        instruments: window.instrumentEngine?.getInstrumentSettings?.() || []
    };

    if (window.audioPlayer && window.audioPlayer.processAudioFromFunction) {
        const audioData = window.audioPlayer.processAudioFromFunction({ functionString }, options);
        window.visualization.drawFunctionGraph(functionString, options.xRange, audioData);
    }
}

function once(fn) {
    let called = false;
    return function (...args) { if (called) return; called = true; return fn.apply(this, args); };
}

window.generateCurrentComposition = generateCurrentComposition;
window.loadUserCompositions = loadUserCompositions;