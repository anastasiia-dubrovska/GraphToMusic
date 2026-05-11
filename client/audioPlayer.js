const NOTE_DURATION = 0.2;
const DEFAULT_X_RANGE = [-10, 10];
const DEFAULT_POINT_COUNT = 100;
const SCALE_MIN = 220;
const SCALE_MAX = 880;

let audioContext = null;
let isPlaying = false;
let playbackPosition = 0;
let playbackStartTime = 0;
let currentNote = 0;
let playbackInterval = null;
let audioData = null;
let activeNodes = [];

let currentSettings = {
    xRange: DEFAULT_X_RANGE,
    pointCount: DEFAULT_POINT_COUNT,
    noteDuration: NOTE_DURATION,
    useAmplitudeModulation: false,
    useVibrato: false,
    genre: 'original',
    instrument: 'piano'
};

function ensureAudioContext() {
    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function mapToFrequency(norm) {
    return SCALE_MIN + norm * (SCALE_MAX - SCALE_MIN);
}

function generateAudioData(functionString, options = {}) {
    const {
        xRange = DEFAULT_X_RANGE,
        pointCount = DEFAULT_POINT_COUNT,
        useAmplitudeModulation = false,
        useVibrato = false,
        noteDuration = NOTE_DURATION,
        genre = 'original',
        instrument = 'piano'
    } = options;

    currentSettings = { xRange, pointCount, noteDuration, useAmplitudeModulation, useVibrato, genre, instrument };

    const compiledFunction = window.visualization.createFunction(functionString);
    const [xMin, xMax] = xRange;
    const step = (xMax - xMin) / (pointCount - 1);
    const xValues = Array.from({ length: pointCount }, (_, i) => xMin + i * step);

    const yValues = xValues.map(x => {
        try { return compiledFunction(x); } catch { return NaN; }
    });

    const validY = yValues.filter(y => Number.isFinite(y));
    if (validY.length === 0) throw new Error('Функція не дає коректних значень на вибраному інтервалі');

    const yMin = Math.min(...validY);
    const yMax = Math.max(...validY);
    const span = Math.max(1e-9, yMax - yMin);

    const normalizedValues = yValues.map(y => Number.isFinite(y) ? (y - yMin) / span : 0.5);

    let notes = normalizedValues.map((norm, index) => ({
        frequency: mapToFrequency(norm),
        duration: noteDuration,
        amplitude: 0.5,
        index
    }));

    if (useAmplitudeModulation) {
        const h = 0.001;
        const derivative = xValues.map(x => {
            try {
                return Math.abs((compiledFunction(x + h) - compiledFunction(x - h)) / (2 * h));
            } catch {
                return 0;
            }
        });
        const maxD = Math.max(...derivative, 1e-9);
        derivative.forEach((d, i) => {
            notes[i].amplitude = 0.2 + 0.8 * (d / maxD);
        });
    }

    if (useVibrato) {
        const h = 0.001;
        const secondDerivative = xValues.map(x => {
            try {
                return (compiledFunction(x + h) - 2 * compiledFunction(x) + compiledFunction(x - h)) / (h * h);
            } catch {
                return 0;
            }
        });
        const maxS = Math.max(...secondDerivative.map(v => Math.abs(v)), 1e-9);
        secondDerivative.forEach((s, i) => {
            const normalized = Math.abs(s) / maxS;
            notes[i].vibratoDepth = normalized * 8;
            notes[i].vibratoRate = 4 + normalized * 5;
        });
    }

    if (window.genreEngine?.applyGenreToNotes) {
        notes = window.genreEngine.applyGenreToNotes(notes, genre);
    }

    notes = notes.map(note => ({ ...note, instrument }));

    return {
        notes,
        tempo: 120,
        xValues,
        yValues,
        originalValues: yValues,
        normalizedValues,
        sourceFunction: functionString,
        genre,
        instrument
    };
}

function createInstrumentChain(ctx, preset, frequency, startTime, duration, amplitude) {
    const masterGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = preset.brightness || 1800;
    filter.Q.value = 1;

    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.gain.linearRampToValueAtTime(amplitude, startTime + (preset.attack || 0.02));
    masterGain.gain.linearRampToValueAtTime(0.0001, startTime + duration + (preset.release || 0.12));

    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    const oscillators = (preset.waveforms || ['sine']).map((waveform, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = waveform;
        osc.frequency.value = idx === 0 ? frequency : frequency * 2;
        osc.detune.value = idx === 0 ? 0 : (preset.detune || 0);
        gain.gain.value = idx === 0 ? 0.75 : 0.18;
        osc.connect(gain);
        gain.connect(filter);
        osc.start(startTime);
        osc.stop(startTime + duration + (preset.release || 0.12));
        activeNodes.push(osc, gain);
        return osc;
    });

    activeNodes.push(masterGain, filter);
    return { oscillators, filter, masterGain };
}

function playNote(note, startTime = ensureAudioContext().currentTime) {
    const ctx = ensureAudioContext();
    const preset = window.genreEngine?.INSTRUMENT_PRESETS?.[note.instrument || currentSettings.instrument] || window.genreEngine?.INSTRUMENT_PRESETS?.piano || { waveforms: ['sine'], attack: 0.02, release: 0.12, brightness: 2000 };
    const amplitude = note.amplitude ?? 0.5;
    const duration = note.duration ?? currentSettings.noteDuration;

    const chain = createInstrumentChain(ctx, preset, note.frequency, startTime, duration, amplitude);

    if (note.vibratoDepth && note.vibratoRate) {
        const vibratoOsc = ctx.createOscillator();
        const vibratoGain = ctx.createGain();
        vibratoOsc.type = 'sine';
        vibratoOsc.frequency.value = note.vibratoRate;
        vibratoGain.gain.value = note.vibratoDepth;
        vibratoOsc.connect(vibratoGain);
        chain.oscillators.forEach(osc => vibratoGain.connect(osc.frequency));
        vibratoOsc.start(startTime);
        vibratoOsc.stop(startTime + duration);
        activeNodes.push(vibratoOsc, vibratoGain);
    }
}

function clearActiveNodes() {
    activeNodes.forEach(node => {
        try {
            if (typeof node.stop === 'function') node.stop();
        } catch {}
        try {
            node.disconnect?.();
        } catch {}
    });
    activeNodes = [];
}

function playMusic() {
    if (!audioData?.notes?.length) return;

    if (isPlaying) stopMusic();
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    isPlaying = true;
    const playerLabel = document.querySelector('.player-label') || document.querySelector('.music-player span');
    if (playerLabel) playerLabel.textContent = 'Зараз грає...';
    document.querySelector('.music-player')?.classList.add('playing');

    let startTime = ctx.currentTime;
    if (playbackPosition > 0) {
        currentNote = Math.floor(playbackPosition / currentSettings.noteDuration);
        startTime -= playbackPosition - currentNote * currentSettings.noteDuration;
    }

    playbackStartTime = ctx.currentTime - playbackPosition;

    let timeCursor = startTime;
    for (let i = currentNote; i < audioData.notes.length; i++) {
        const note = audioData.notes[i];
        playNote(note, timeCursor);
        timeCursor += note.duration ?? currentSettings.noteDuration;
    }

    clearInterval(playbackInterval);
    playbackInterval = setInterval(updatePlaybackProgress, 100);

    setTimeout(() => {
        if (isPlaying) stopMusic();
    }, Math.max(0, (timeCursor - ctx.currentTime)) * 1000 + 150);
}

function updatePlaybackProgress() {
    if (!isPlaying || !audioData?.notes?.length || !audioContext) return;

    const currentTime = audioContext.currentTime - playbackStartTime;
    const totalTime = audioData.notes.reduce((sum, note) => sum + (note.duration ?? currentSettings.noteDuration), 0);
    const progressPercent = Math.min(100, (currentTime / totalTime) * 100);

    const bar = document.querySelector('.progress-bar');
    if (bar) bar.style.width = `${progressPercent}%`;

    const currentEl = document.getElementById('currentTime');
    const totalEl = document.getElementById('totalTime');
    if (currentEl) currentEl.textContent = formatTime(currentTime);
    if (totalEl) totalEl.textContent = formatTime(totalTime);

    window.visualization?.updateGraphCursor?.(currentTime, currentSettings.noteDuration, audioData.notes.length,
        parseFloat(document.getElementById('xMin')?.value ?? currentSettings.xRange[0]),
        parseFloat(document.getElementById('xMax')?.value ?? currentSettings.xRange[1]));

    if (currentTime >= totalTime) stopMusic();
}

function pauseMusic() {
    if (!isPlaying || !audioContext) return;
    audioContext.suspend();
    isPlaying = false;
    playbackPosition = audioContext.currentTime - playbackStartTime;
    clearInterval(playbackInterval);
    document.querySelector('.music-player')?.classList.remove('playing');
    const playerLabel = document.querySelector('.player-label') || document.querySelector('.music-player span');
    if (playerLabel) playerLabel.textContent = 'Пауза';
}

function stopMusic() {
    clearInterval(playbackInterval);
    playbackPosition = 0;
    currentNote = 0;
    isPlaying = false;
    clearActiveNodes();

    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().then(() => { audioContext = null; });
    }

    document.querySelector('.music-player')?.classList.remove('playing');
    const playerLabel = document.querySelector('.player-label') || document.querySelector('.music-player span');
    if (playerLabel) playerLabel.textContent = 'Натисніть, щоб послухати результат';

    const bar = document.querySelector('.progress-bar');
    if (bar) bar.style.width = '0%';
}

function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function saveComposition() {
    if (!audioData?.notes?.length) {
        alert('Немає даних для збереження.');
        return;
    }
    const blob = new Blob([JSON.stringify(audioData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'composition.json';
    a.click();
    URL.revokeObjectURL(url);
}

function processAudioFromFunction(functionData, options = {}) {
    if (!functionData?.functionString) throw new Error('Invalid function data');

    const mergedOptions = {
        xRange: options.xRange || currentSettings.xRange || DEFAULT_X_RANGE,
        pointCount: options.pointCount || currentSettings.pointCount || DEFAULT_POINT_COUNT,
        noteDuration: options.noteDuration || currentSettings.noteDuration || NOTE_DURATION,
        useAmplitudeModulation: options.useAmplitudeModulation ?? currentSettings.useAmplitudeModulation,
        useVibrato: options.useVibrato ?? currentSettings.useVibrato,
        genre: options.genre || currentSettings.genre || 'original',
        instrument: options.instrument || currentSettings.instrument || 'piano'
    };

    audioData = generateAudioData(functionData.functionString, mergedOptions);

    document.querySelector('.result-container')?.style && (document.querySelector('.result-container').style.display = 'block');
    const playerLabel = document.querySelector('.player-label') || document.querySelector('.music-player span');
    if (playerLabel) playerLabel.textContent = 'Натисніть, щоб послухати результат';

    window.visualization?.drawFunctionGraph?.(functionData.functionString, mergedOptions.xRange, audioData);
    return audioData;
}

function initAudioPlayer() {
    const pointCountInput = document.getElementById('pointCount');
    const pointCountValue = document.getElementById('pointCountValue');
    pointCountInput?.addEventListener('input', () => { if (pointCountValue) pointCountValue.textContent = pointCountInput.value; });

    const noteDurationInput = document.getElementById('noteDuration');
    const noteDurationValue = document.getElementById('noteDurationValue');
    noteDurationInput?.addEventListener('input', () => { if (noteDurationValue) noteDurationValue.textContent = `${noteDurationInput.value}s`; });

    document.querySelector('.music-player')?.addEventListener('click', () => {
        if (!audioData?.notes?.length) return;
        if (isPlaying) pauseMusic(); else playMusic();
    });

    ensureAudioContext();
}

function applySettings() {
    const xMin = parseFloat(document.getElementById('xMin')?.value);
    const xMax = parseFloat(document.getElementById('xMax')?.value);
    const pointCount = parseInt(document.getElementById('pointCount')?.value, 10);
    const noteDuration = parseFloat(document.getElementById('noteDuration')?.value);
    const useAmplitudeModulation = document.getElementById('amplitudeModulation')?.checked ?? false;
    const useVibrato = document.getElementById('vibratoEffect')?.checked ?? false;
    const genre = document.getElementById('genreSelect')?.value || 'original';
    const instrument = document.getElementById('instrumentSelect')?.value || 'piano';

    if ([xMin, xMax, pointCount, noteDuration].some(Number.isNaN)) return alert('Будь ласка, введіть коректні числові значення.');
    if (xMin >= xMax) return alert('Мінімальне значення X має бути менше за максимальне');

    const funcStr = document.querySelector('.function-input')?.value;
    if (!funcStr) return alert('Будь ласка, введіть математичну функцію');

    processAudioFromFunction({ functionString: funcStr }, {
        xRange: [xMin, xMax],
        pointCount,
        noteDuration,
        useAmplitudeModulation,
        useVibrato,
        genre,
        instrument
    });
}

window.audioPlayer = {
    initAudioPlayer,
    processAudioFromFunction,
    playMusic,
    pauseMusic,
    stopMusic,
    saveComposition,
    generateAudioData,
    applySettings,
    updatePlaybackProgress,
    getCurrentAudioData: () => audioData
};

window.applySettings = applySettings;
