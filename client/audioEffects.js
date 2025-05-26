/**
 * audioEffects.js
 * 
 * Модуль, що забезпечує додаткові аудіо-ефекти для музики, згенерованої з математичних функцій.
 * Розширює базовий audioPlayer, додаючи ефекти відлуння, гармонізації, арпеджіатора,
 * зміни тону, LFO фільтра та інтерфейс для управління цими ефектами.
 * 
 * Структура:
 * 1. Константи та налаштування ефектів
 * 2. Основні функції відтворення із застосуванням ефектів
 * 3. Функції для кожного окремого ефекту (відлуння, гармонізація, арпеджіатор та ін.)
 * 4. Користувацький інтерфейс для ефектів
 * 5. Стилі для інтерфейсу
 * 6. Ініціалізація та експорт
 */

// Константи для аудіо-ефектів
const ECHO_TIME = 0.3; // Час затримки (delay) у секундах
const ECHO_FEEDBACK = 0.4; // Коефіцієнт зворотного зв'язку (feedback)
const HARMONY_INTERVALS = [4, 7]; // Інтервали для гармонізації (терція і квінта)
const ARPEGGIO_SPEED = 0.1; // Швидкість арпеджіо у секундах на ноту
const LFO_RATE = 0.5; // Швидкість низькочастотного осцилятора (LFO)
const LFO_DEPTH = 300; // Глибина LFO

// Розширений об'єкт налаштувань
const effectSettings = {
    useEcho: false,
    echoTime: ECHO_TIME,
    echoFeedback: ECHO_FEEDBACK,
    useArpeggiator: false,
    arpeggioSpeed: ARPEGGIO_SPEED,
    arpeggioPattern: 'up', // 'up', 'down', 'updown', 'random'
    useHarmony: false,
    harmonyIntervals: HARMONY_INTERVALS,
    usePitchShift: false,
    pitchShiftAmount: 0, // півтони зсуву (-12 до +12)
    useLFO: false,
    lfoRate: LFO_RATE,
    lfoDepth: LFO_DEPTH
};

/**
 * Функція для відтворення окремої ноти з підтримкою ефектів
 * @param {number} frequency - Частота ноти в герцах
 * @param {number} duration - Тривалість ноти в секундах
 * @param {number} startTime - Час початку відтворення в контексті аудіо
 * @param {number} amplitude - Гучність ноти (0-1)
 * @param {Object} options - Додаткові опції для ноти
 * @returns {OscillatorNode} - Створений осцилятор для подальших маніпуляцій
 */
function playNote(frequency, duration, startTime = audioContext.currentTime, amplitude = 0.5, options = {}) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Застосовуємо зсув висоти тону, якщо він активований
    if (effectSettings.usePitchShift) {
        frequency = frequency * Math.pow(2, effectSettings.pitchShiftAmount / 12);
    }
    
    // Створюємо основний осцилятор
    const oscillator = audioContext.createOscillator();
    oscillator.type = options.waveform || 'sine';
    oscillator.frequency.value = frequency;
    
    // Застосовуємо LFO фільтр, якщо він активований
    if (effectSettings.useLFO) {
        applyLFO(oscillator, startTime, duration);
    }
    
    // Налаштовуємо гучність
    const gainNode = audioContext.createGain();
    gainNode.gain.value = amplitude;
    
    // Створюємо огинаючу для плавного звучання
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(amplitude, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration - 0.01);
    
    // Застосовуємо вібрато, якщо він заданий
    if (options.vibrato && options.vibrato.vibratoDepth && options.vibrato.vibratoRate) {
        const vibratoOscillator = audioContext.createOscillator();
        vibratoOscillator.type = 'sine';
        vibratoOscillator.frequency.value = options.vibrato.vibratoRate;
        
        const vibratoGain = audioContext.createGain();
        vibratoGain.gain.value = options.vibrato.vibratoDepth;
        
        vibratoOscillator.connect(vibratoGain);
        vibratoGain.connect(oscillator.frequency);
        vibratoOscillator.start(startTime);
        vibratoOscillator.stop(startTime + duration);
    }
    
    oscillator.connect(gainNode);
    
    // Застосовуємо ефект відлуння, якщо він активований
    if (effectSettings.useEcho) {
        const outputNode = applyEcho(gainNode, startTime, duration);
        outputNode.connect(audioContext.destination);
    } else {
        gainNode.connect(audioContext.destination);
    }
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
    
    return oscillator;
}

/**
 * Функція для застосування ефекту відлуння
 * @param {AudioNode} sourceNode - Джерело звуку
 * @param {number} startTime - Час початку
 * @param {number} duration - Тривалість
 * @returns {AudioNode} - Вихідний вузол для подальшого підключення
 */
function applyEcho(sourceNode, startTime, duration) {
    const delayNode = audioContext.createDelay();
    delayNode.delayTime.value = effectSettings.echoTime;
    
    const feedbackGain = audioContext.createGain();
    feedbackGain.gain.value = effectSettings.echoFeedback;
    
    const outputGain = audioContext.createGain();
    
    // З'єднуємо вузли
    sourceNode.connect(outputGain); // Оригінальний сигнал
    sourceNode.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode); // Зворотній зв'язок для кількох повторень
    feedbackGain.connect(outputGain); // Додаємо затриманий сигнал до виходу
    
    // Зупиняємо ефект відлуння після закінчення (з додатковим часом для загасання)
    const stopTime = startTime + duration + (effectSettings.echoTime * 5);
    setTimeout(() => {
        feedbackGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    }, (stopTime - audioContext.currentTime) * 1000);
    
    return outputGain;
}

/**
 * Функція для застосування LFO фільтра
 * @param {OscillatorNode} oscillator - Осцилятор для модуляції
 * @param {number} startTime - Час початку
 * @param {number} duration - Тривалість
 * @returns {AudioNode} - Фільтр для подальшого підключення
 */
function applyLFO(oscillator, startTime, duration) {
    const lfo = audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = effectSettings.lfoRate;
    
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = effectSettings.lfoDepth;
    
    lfo.connect(lfoGain);
    
    // Створюємо фільтр
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 5000; // Базова частота фільтра
    
    // З'єднуємо LFO з частотою фільтра
    lfoGain.connect(filter.frequency);
    
    // Ставимо фільтр між осцилятором і виходом
    oscillator.connect(filter);
    oscillator.disconnect(); // Від'єднуємо прямий вихід
    
    lfo.start(startTime);
    lfo.stop(startTime + duration);
    
    return filter;
}

/**
 * Функція для гри з гармонізацією
 * @param {Array} notes - Масив нот для відтворення
 * @param {number} startTime - Час початку відтворення
 * @param {Object} options - Додаткові параметри
 */
function playWithHarmony(notes, startTime = audioContext.currentTime, options = {}) {
    if (!notes || notes.length === 0) return;
    
    const noteDuration = currentSettings.noteDuration || NOTE_DURATION;
    
    notes.forEach((note, index) => {
        const noteTime = startTime + index * noteDuration;
        
        // Граємо основну ноту
        playNote(note.frequency, noteDuration, noteTime, note.amplitude, note);
        
        // Додаємо гармонійні ноти, якщо ввімкнено гармонізацію
        if (effectSettings.useHarmony) {
            effectSettings.harmonyIntervals.forEach(interval => {
                // Для простої гармонізації використовуємо множник частоти
                // Для терції (4 півтони): 2^(4/12) ≈ 1.2599
                // Для квінти (7 півтонів): 2^(7/12) ≈ 1.4983
                const harmonicFreq = note.frequency * Math.pow(2, interval / 12);
                playNote(harmonicFreq, noteDuration, noteTime, note.amplitude * 0.6, note);
            });
        }
    });
}

/**
 * Функція для гри з арпеджіатором
 * @param {Array} notes - Масив нот для відтворення
 * @param {number} startTime - Час початку відтворення
 * @param {Object} options - Додаткові параметри
 */
function playWithArpeggiator(notes, startTime = audioContext.currentTime, options = {}) {
    if (!notes || notes.length === 0) return;
    
    const noteDuration = currentSettings.noteDuration || NOTE_DURATION;
    const chordSize = 3; // Розмір акорду для арпеджіо
    
    // Групуємо ноти в акорди
    for (let i = 0; i < notes.length; i += chordSize) {
        const chord = notes.slice(i, i + chordSize);
        
        // Якщо арпеджіатор увімкнений, граємо ноти акорду послідовно
        if (effectSettings.useArpeggiator && chord.length > 1) {
            let arpNotes = [...chord];
            
            // Застосовуємо різні патерни арпеджіо
            switch (effectSettings.arpeggioPattern) {
                case 'down':
                    arpNotes.reverse();
                    break;
                case 'updown':
                    arpNotes = [...chord, ...chord.slice(1, -1).reverse()];
                    break;
                case 'random':
                    arpNotes.sort(() => Math.random() - 0.5);
                    break;
                // За замовчуванням 'up' - не змінюємо порядок
            }
            
            // Граємо кожну ноту арпеджіо
            arpNotes.forEach((note, arpIndex) => {
                const arpTime = startTime + (i * noteDuration) + (arpIndex * effectSettings.arpeggioSpeed);
                playNote(note.frequency, effectSettings.arpeggioSpeed * 0.9, arpTime, note.amplitude, note);
            });
        } else {
            // Інакше граємо ноти як зазвичай
            chord.forEach((note, index) => {
                playNote(note.frequency, noteDuration, startTime + (i * noteDuration), note.amplitude, note);
            });
        }
    }
}

/**
 * Оновлена функція для відтворення музики з новими ефектами
 */
function playMusicWithEffects() {
    if (!audioData || !audioData.notes || audioData.notes.length === 0) {
        console.error('Немає аудіоданих для відтворення');
        return;
    }
    
    if (isPlaying) {
        stopMusic();
    }
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    isPlaying = true;
    document.querySelector('.music-player').classList.add('playing');
    document.querySelector('.music-player span').textContent = 'Зараз грає...';
    
    let startTime = audioContext.currentTime;
    let elapsed = 0;
    let noteDuration = currentSettings.noteDuration || NOTE_DURATION;
    
    if (playbackPosition > 0) {
        currentNote = Math.floor(playbackPosition / noteDuration);
        elapsed = playbackPosition - (currentNote * noteDuration);
        startTime -= elapsed;
    }
    
    playbackStartTime = audioContext.currentTime - playbackPosition;
    
    // Вибираємо метод відтворення залежно від активованих ефектів
    const notesToPlay = audioData.notes.slice(currentNote);
    
    if (effectSettings.useHarmony) {
        playWithHarmony(notesToPlay, startTime + elapsed);
    } else if (effectSettings.useArpeggiator) {
        playWithArpeggiator(notesToPlay, startTime + elapsed);
    } else {
        // Стандартне відтворення з оновленими ефектами
        for (let i = 0; i < notesToPlay.length; i++) {
            const note = notesToPlay[i];
            const noteTime = startTime + (i * noteDuration) + elapsed;
            
            const vibratoOptions = note.vibratoDepth ? 
                { vibratoDepth: note.vibratoDepth, vibratoRate: note.vibratoRate } : null;
            
            playNote(note.frequency, noteDuration, noteTime, note.amplitude, { vibrato: vibratoOptions });
        }
    }
    
    playbackInterval = setInterval(updatePlaybackProgress, 100);
    
    setTimeout(() => {
        if (isPlaying) {
            stopMusic();
        }
    }, (notesToPlay.length * noteDuration * 1000) + 1000); // Додатковий час для ефектів
}

/**
 * Функція для оновлення звучання з новими налаштуваннями ефектів
 * @param {Object} newEffects - Нові налаштування ефектів
 */
function updateEffects(newEffects) {
    // Оновлюємо налаштування ефектів
    Object.assign(effectSettings, newEffects);
    
    console.log('🎛️ Ефекти оновлено:', effectSettings);
    
    // Якщо музика вже відтворюється, перезапускаємо її з новими ефектами
    if (isPlaying) {
        const currentPosition = audioContext.currentTime - playbackStartTime;
        stopMusic();
        playbackPosition = currentPosition;
        playMusicWithEffects();
    }
}

/**
 * Функція для ініціалізації інтерфейсу ефектів
 */
function initEffectsUI() {
    const effectsContainer = document.createElement('div');
    effectsContainer.className = 'effects-container';
    effectsContainer.innerHTML = `
        <div class="effects-header">
            <h3>Аудіо-ефекти</h3>
            <button id="expand-effects" class="btn-expand">▼</button>
        </div>
        <div class="effects-panel" style="display: none;">
            <div class="effect-group">
                <label><input type="checkbox" id="effect-echo"> Відлуння (Echo)</label>
                <div class="effect-params">
                    <label>Час: <input type="range" id="echo-time" min="0.1" max="1" step="0.05" value="${ECHO_TIME}"> <span id="echo-time-value">${ECHO_TIME}s</span></label>
                    <label>Зворотній зв'язок: <input type="range" id="echo-feedback" min="0.1" max="0.9" step="0.1" value="${ECHO_FEEDBACK}"> <span id="echo-feedback-value">${ECHO_FEEDBACK}</span></label>
                </div>
            </div>
            
            <div class="effect-group">
                <label><input type="checkbox" id="effect-harmony"> Гармонізація</label>
                <div class="effect-params">
                    <select id="harmony-type">
                        <option value="major">Мажорна</option>
                        <option value="minor">Мінорна</option>
                        <option value="seventh">Септакорд</option>
                    </select>
                </div>
            </div>
            
            <div class="effect-group">
                <label><input type="checkbox" id="effect-arpeggiator"> Арпеджіатор</label>
                <div class="effect-params">
                    <label>Швидкість: <input type="range" id="arp-speed" min="0.05" max="0.5" step="0.05" value="${ARPEGGIO_SPEED}"> <span id="arp-speed-value">${ARPEGGIO_SPEED}s</span></label>
                    <label>Патерн: 
                        <select id="arp-pattern">
                            <option value="up">Вгору</option>
                            <option value="down">Вниз</option>
                            <option value="updown">Вгору-вниз</option>
                            <option value="random">Випадковий</option>
                        </select>
                    </label>
                </div>
            </div>
            
            <div class="effect-group">
                <label><input type="checkbox" id="effect-pitch"> Зміна тону</label>
                <div class="effect-params">
                    <label>Півтони: <input type="range" id="pitch-amount" min="-12" max="12" step="1" value="0"> <span id="pitch-amount-value">0</span></label>
                </div>
            </div>
            
            <div class="effect-group">
                <label><input type="checkbox" id="effect-lfo"> Фільтр з модуляцією (LFO)</label>
                <div class="effect-params">
                    <label>Швидкість: <input type="range" id="lfo-rate" min="0.1" max="5" step="0.1" value="${LFO_RATE}"> <span id="lfo-rate-value">${LFO_RATE} Hz</span></label>
                    <label>Глибина: <input type="range" id="lfo-depth" min="50" max="1000" step="50" value="${LFO_DEPTH}"> <span id="lfo-depth-value">${LFO_DEPTH}</span></label>
                </div>
            </div>
            
            <div class="waveform-selector">
                <label>Форма хвилі: 
                    <select id="waveform-type">
                        <option value="sine">Синусоїда</option>
                        <option value="square">Квадратна</option>
                        <option value="sawtooth">Пилкоподібна</option>
                        <option value="triangle">Трикутна</option>
                    </select>
                </label>
            </div>
            
            <button id="apply-effects" class="btn-apply">Застосувати ефекти</button>
        </div>
    `;
    
    // Знаходимо контейнер для результатів і вставляємо наш блок перед ним
    const resultContainer = document.querySelector('.result-container');
    if (resultContainer) {
        resultContainer.parentNode.insertBefore(effectsContainer, resultContainer);
    }
    
    // Додаємо обробники подій для інтерфейсу ефектів
    document.getElementById('expand-effects').addEventListener('click', function() {
        const panel = document.querySelector('.effects-panel');
        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'block' : 'none';
        this.textContent = isHidden ? '▲' : '▼';
    });
    
    // Оновлюємо відображення значень для повзунків
    document.getElementById('echo-time').addEventListener('input', function() {
        document.getElementById('echo-time-value').textContent = this.value + 's';
    });
    
    document.getElementById('echo-feedback').addEventListener('input', function() {
        document.getElementById('echo-feedback-value').textContent = this.value;
    });
    
    document.getElementById('arp-speed').addEventListener('input', function() {
        document.getElementById('arp-speed-value').textContent = this.value + 's';
    });
    
    document.getElementById('pitch-amount').addEventListener('input', function() {
        document.getElementById('pitch-amount-value').textContent = this.value;
    });
    
    document.getElementById('lfo-rate').addEventListener('input', function() {
        document.getElementById('lfo-rate-value').textContent = this.value + ' Hz';
    });
    
    document.getElementById('lfo-depth').addEventListener('input', function() {
        document.getElementById('lfo-depth-value').textContent = this.value;
    });
    
    // Обробник для кнопки застосування ефектів
    document.getElementById('apply-effects').addEventListener('click', function() {
        const newEffects = {
            useEcho: document.getElementById('effect-echo').checked,
            echoTime: parseFloat(document.getElementById('echo-time').value),
            echoFeedback: parseFloat(document.getElementById('echo-feedback').value),
            
            useHarmony: document.getElementById('effect-harmony').checked,
            harmonyType: document.getElementById('harmony-type').value,
            
            useArpeggiator: document.getElementById('effect-arpeggiator').checked,
            arpeggioSpeed: parseFloat(document.getElementById('arp-speed').value),
            arpeggioPattern: document.getElementById('arp-pattern').value,
            
            usePitchShift: document.getElementById('effect-pitch').checked,
            pitchShiftAmount: parseInt(document.getElementById('pitch-amount').value),
            
            useLFO: document.getElementById('effect-lfo').checked,
            lfoRate: parseFloat(document.getElementById('lfo-rate').value),
            lfoDepth: parseFloat(document.getElementById('lfo-depth').value),
            
            waveform: document.getElementById('waveform-type').value
        };
        
        // Встановлюємо інтервали для гармонізації відповідно до вибраного типу
        switch (newEffects.harmonyType) {
            case 'minor':
                newEffects.harmonyIntervals = [3, 7]; // Мінорна терція і квінта
                break;
            case 'seventh':
                newEffects.harmonyIntervals = [4, 7, 10]; // Мажорний септакорд
                break;
            default: // 'major'
                newEffects.harmonyIntervals = [4, 7]; // Мажорна терція і квінта
        }
        
        updateEffects(newEffects);
        
        // Перезапускаємо відтворення з новими ефектами, якщо воно було активним
        if (document.querySelector('.music-player').classList.contains('playing')) {
            console.log('🔄 Перезапуск з новими ефектами');
            stopMusic();
            setTimeout(() => playMusicWithEffects(), 100);
        }
    });
}

/**
 * Функція для додавання CSS стилів для інтерфейсу ефектів
 */
function addEffectsStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .effects-container {
            margin: 20px 0;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .effects-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            background-color: #f5f5f5;
            border-bottom: 1px solid #ddd;
        }
        
        .effects-header h3 {
            margin: 0;
            font-size: 16px;
        }
        
        .btn-expand {
            background: none;
            border: none;
            font-size: 16px;
            cursor: pointer;
        }
        
        .effects-panel {
            padding: 15px;
        }
        
        .effect-group {
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #eee;
        }
        
        .effect-params {
            padding-left: 25px;
            margin-top: 8px;
        }
        
        .effect-params label {
            display: block;
            margin: 5px 0;
        }
        
        .waveform-selector {
            margin: 15px 0;
        }
        
        .btn-apply {
            display: block;
            width: 100%;
            padding: 8px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
        }
        
        .btn-apply:hover {
            background-color: #45a049;
        }
    `;
    document.head.appendChild(styleElement);
}

/**
 * Функція для ініціалізації аудіо-ефектів, замінює стандартну функцію відтворення
 */
function initAudioEffects() {
    // Зберігаємо оригінальну функцію відтворення
    const originalPlayMusic = window.audioPlayer.playMusic;
    
    // Замінюємо її на нашу функцію з ефектами
    window.audioPlayer.playMusic = playMusicWithEffects;
    
    // Додаємо інтерфейс для ефектів
    initEffectsUI();
    addEffectsStyles();
    
    console.log('🎛️ Аудіо-ефекти ініціалізовано');
}

// Експортуємо нові функції
window.audioEffects = {
    initAudioEffects,
    updateEffects,
    effectSettings
};