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
        instrument = 'piano',
        instruments = []
    } = options;

    currentSettings = { xRange, pointCount, noteDuration, useAmplitudeModulation, useVibrato, genre, instrument };

    const compiledFunction = window.visualization.createFunction(functionString);
    const [xMin, xMax] = xRange;
    const step = (xMax - xMin) / (pointCount - 1);
    const xValues = Array.from({ length: pointCount }, (_, i) => xMin + i * step);
    if (instruments && instruments.length > 0) {
        return generateMultiInstrumentAudioData(functionString, {
            xValues,
            xRange,
            pointCount,
            useAmplitudeModulation,
            useVibrato,
            noteDuration,
            genre,
            instrument,
            instruments
        });
    }

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


function generateMultiInstrumentAudioData(mainFunctionString, options) {
    const {
        xValues,
        useAmplitudeModulation,
        useVibrato,
        noteDuration,
        genre,
        instrument,
        instruments
    } = options;

    const tracks = [];
    const allNotes = [];

    instruments.forEach((inst, trackIndex) => {
        let compiledFunction;


        const formulaToUse = (inst.functionExpression && inst.functionExpression.trim() !== '') 
            ? inst.functionExpression 
            : mainFunctionString;

        try {
            compiledFunction = window.visualization.createFunction(formulaToUse);
        } catch (error) {
            console.warn('Некоректна функція інструмента:', formulaToUse, error);
            return;
        }

        const yValues = xValues.map(x => {
            try {
                return compiledFunction(x);
            } catch {
                return NaN;
            }
        });

        const validY = yValues.filter(y => Number.isFinite(y));
        if (validY.length === 0) return;

        const yMin = Math.min(...validY);
        const yMax = Math.max(...validY);
        const span = Math.max(1e-9, yMax - yMin);

        const normalizedValues = yValues.map(y =>
            Number.isFinite(y) ? (y - yMin) / span : 0.5
        );

        const trackOctave = parseInt(inst.octave, 10) || 0;
        const trackDuration = parseFloat(inst.noteDuration) || parseFloat(noteDuration);
        const trackVolume = inst.volume !== undefined && inst.volume !== null ? parseFloat(inst.volume) : 0.5;

        let notes = normalizedValues.map((norm, index) => ({
            frequency: mapToFrequency(norm) * Math.pow(2, trackOctave),
            duration: trackDuration,
            amplitude: trackVolume,
            index,
            trackIndex,
            instrument: inst.type || instrument,
            instrumentName: inst.name || inst.type,
            sourceFunction: formulaToUse
        }));

        if (useAmplitudeModulation) {
            const h = 0.001;
            const derivative = xValues.map(x => {
                try {
                    return Math.abs((compiledFunction(x + h) - compiledFunction(x - h)) / (2 * h));
                } catch { return 0; }
            });
            const maxD = Math.max(...derivative, 1e-9);
            derivative.forEach((d, i) => {
                notes[i].amplitude = Math.min(1, trackVolume * (0.3 + 0.7 * (d / maxD)));
            });
        }

        if (useVibrato) {
            const h = 0.001;
            const secondDerivative = xValues.map(x => {
                try {
                    return (compiledFunction(x + h) - 2 * compiledFunction(x) + compiledFunction(x - h)) / (h * h);
                } catch { return 0; }
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

        tracks.push({
            name: inst.name,
            type: inst.type,
            functionExpression: formulaToUse,
            notes,
            yValues,
            normalizedValues
        });

        allNotes.push(...notes);
    });

    if (!tracks.length) {
        throw new Error('Жоден інструмент не має коректної функції');
    }

    const trackCount = tracks.length;
    if (trackCount > 1) {
        allNotes.forEach(note => {
            note.amplitude = note.amplitude / Math.sqrt(trackCount);
        });
    }

    return {
        notes: allNotes,
        tracks,
        isMultiInstrument: true,
        tempo: 120,
        xValues,
        yValues: tracks[0].yValues,
        originalValues: tracks[0].yValues,
        normalizedValues: tracks[0].normalizedValues,
        sourceFunction: mainFunctionString,
        genre,
        instrument,
        instruments
    };
}

function playMultiInstrumentMusic(startTime) {
    console.log('MULTI TRACKS:', audioData.tracks);

    if (!audioData?.tracks?.length) return;

    let maxEndTime = startTime;

    audioData.tracks.forEach(track => {
        let timeCursor = startTime;

        track.notes.forEach(note => {
            playGeneratedNote(note, timeCursor);
            

            const duration = parseFloat(note.duration || currentSettings.noteDuration || 0.2);
            timeCursor += duration;
        });

        if (timeCursor > maxEndTime) {
            maxEndTime = timeCursor;
        }
    });

    const totalDurationMs = Math.max(0, (maxEndTime - ensureAudioContext().currentTime) * 1000);

    setTimeout(() => {
        isPlaying = false;
        clearInterval(playbackInterval);

        const bar = document.querySelector('.progress-bar');
        if (bar) bar.style.width = '100%';

        const playerLabel = document.querySelector('.player-label') || document.querySelector('.music-player span');
        if (playerLabel) playerLabel.textContent = 'Відтворення завершено';
    }, totalDurationMs + 700);
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
        gain.gain.value = idx === 0 ? 0.6 : 0.15;
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

function playGeneratedNote(note, startTime = ensureAudioContext().currentTime) {
    const ctx = ensureAudioContext();

    const instrumentKey = note.instrument || currentSettings.instrument || 'piano';

    const preset =
        window.instrumentEngine?.INSTRUMENT_PRESETS?.[instrumentKey] ||
        window.genreEngine?.INSTRUMENT_PRESETS?.[instrumentKey] ||
        window.instrumentEngine?.INSTRUMENT_PRESETS?.piano ||
        window.genreEngine?.INSTRUMENT_PRESETS?.piano ||
        {
            waveforms: ['sine'],
            attack: 0.02,
            release: 0.12,
            brightness: 2000
        };

    console.log('PLAY NOTE:', {
        instrument: instrumentKey,
        frequency: note.frequency,
        duration: note.duration,
        amplitude: note.amplitude,
        preset
    });

    const amplitude = note.amplitude ?? 0.5;
    const duration = note.duration ?? currentSettings.noteDuration;

    const chain = createInstrumentChain(
        ctx,
        preset,
        note.frequency,
        startTime,
        duration,
        amplitude
    );

    if (note.vibratoDepth && note.vibratoRate) {
        const vibratoOsc = ctx.createOscillator();
        const vibratoGain = ctx.createGain();

        vibratoOsc.type = 'sine';
        vibratoOsc.frequency.value = note.vibratoRate;
        vibratoGain.gain.value = note.vibratoDepth;

        vibratoOsc.connect(vibratoGain);

        chain.oscillators.forEach(osc => {
            vibratoGain.connect(osc.frequency);
        });

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

    const ctx = ensureAudioContext();


    if (ctx.state === 'suspended' && playbackPosition > 0) {
        ctx.resume().then(() => {
            isPlaying = true;
            const playerLabel = document.querySelector('.player-label') || document.querySelector('.music-player span');
            if (playerLabel) playerLabel.textContent = 'Зараз грає...';
            document.querySelector('.music-player')?.classList.add('playing');
            playbackStartTime = ctx.currentTime - playbackPosition;
            clearInterval(playbackInterval);
            playbackInterval = setInterval(updatePlaybackProgress, 100);
        });
        return;
    }

    if (isPlaying) {
        stopMusic();
    }

    isPlaying = true;
    const playerLabel = document.querySelector('.player-label') || document.querySelector('.music-player span');
    if (playerLabel) playerLabel.textContent = 'Зараз грає...';
    document.querySelector('.music-player')?.classList.add('playing');

    const doPlay = () => {
        const startTime = ctx.currentTime + 0.05;
        playbackStartTime = ctx.currentTime;
        playbackPosition = 0;
        currentNote = 0;

        if (audioData.isMultiInstrument && audioData.tracks?.length) {
            playMultiInstrumentMusic(startTime);
        } else {
            let timeCursor = startTime;
            for (let i = 0; i < audioData.notes.length; i++) {
                const note = audioData.notes[i];
                playGeneratedNote(note, timeCursor);
                timeCursor += note.duration ?? currentSettings.noteDuration;
            }
        }

        clearInterval(playbackInterval);
        playbackInterval = setInterval(updatePlaybackProgress, 100);
    };

    if (ctx.state === 'suspended') {
        ctx.resume().then(doPlay);
    } else {
        doPlay();
    }
}

function updatePlaybackProgress() {
    if (!isPlaying || !audioData?.notes?.length || !audioContext) return;

    const currentTime = audioContext.currentTime - playbackStartTime;
    

    const totalTime = audioData.isMultiInstrument && audioData.tracks?.length
    ? Math.max(...audioData.tracks.map(track => 
        track.notes.reduce((sum, note) => sum + (note.duration ?? currentSettings.noteDuration), 0)
      ))
    : audioData.notes.reduce((sum, note) => sum + (note.duration ?? currentSettings.noteDuration), 0);
        
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

    if (currentTime >= totalTime) {
        isPlaying = false;
        clearInterval(playbackInterval);
    }
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


    if (audioContext && audioContext.state === 'running') {
        audioContext.suspend();
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

async function saveComposition() {
    if (!audioData?.notes?.length) {
        alert('Немає даних для збереження.');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        alert('Необхідно увійти в систему, щоб зберегти композицію');
        return;
    }

    const title = prompt('Введіть назву композиції:', 'Моя композиція') || 'Без назви';

    const compositionData = {
        title,
        function: audioData.sourceFunction,
        data: audioData
    };

    const result = await window.api.saveCompositionToServer(compositionData);

    if (result.success) {
        alert('Композицію успішно збережено!');
    } else {
        alert('Помилка збереження: ' + result.message);
    }
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
        instrument: options.instrument || currentSettings.instrument || 'piano',
        instruments: options.instruments || []
    };

    audioData = generateAudioData(functionData.functionString, mergedOptions);

    document.querySelector('.result-container')?.style && (document.querySelector('.result-container').style.display = 'block');
    const playerLabel = document.querySelector('.player-label') || document.querySelector('.music-player span');
    if (playerLabel) playerLabel.textContent = 'Натисніть, щоб послухати результат';

    window.visualization?.drawFunctionGraph?.(functionData.functionString, mergedOptions.xRange, audioData);


    if (window.effectSettings) {
        if (audioData.tracks?.length) {
            audioData.tracks.forEach(track => {
                track.notes = window.applyEffectsToNotes(track.notes);
            });
            audioData.notes = audioData.tracks.flatMap(t => t.notes);
        } else if (audioData.notes) {
            audioData.notes = window.applyEffectsToNotes(audioData.notes);
        }
    }
    return audioData;
}

function initAudioPlayer() {
    const pointCountInput = document.getElementById('pointCount');
    const pointCountValue = document.getElementById('pointCountValue');

    pointCountInput?.addEventListener('input', () => {
        if (pointCountValue) pointCountValue.textContent = pointCountInput.value;
    });

    const noteDurationInput = document.getElementById('noteDuration');
    const noteDurationValue = document.getElementById('noteDurationValue');

    noteDurationInput?.addEventListener('input', () => {
        if (noteDurationValue) noteDurationValue.textContent = `${noteDurationInput.value}s`;
    });

    document.querySelector('.music-player')?.addEventListener('click', (e) => {
        if (e.target !== e.currentTarget && !e.target.classList.contains('player-label')) return;
        

        applySettings();
        
        if (!audioData?.notes?.length) return;
        if (isPlaying) pauseMusic();
        else playMusic();
    });

    document.querySelector('.btn-play')?.addEventListener('click', (e) => {
        e.stopPropagation(); 
        

        applySettings(); 

        console.log('PLAY MULTI-TRACK AUDIO DATA:', audioData);

        if (!audioData?.notes?.length) {
            alert('Не вдалося згенерувати композицію. Перевірте введені дані.');
            return;
        }
        playMusic();
    });

    document.querySelector('.btn-pause')?.addEventListener('click', (e) => {
        e.stopPropagation();
        pauseMusic();
    });

    document.querySelector('.btn-stop')?.addEventListener('click', (e) => {
        e.stopPropagation();
        stopMusic();
    });

    document.querySelector('.btn-save')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await saveComposition();
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

    const instruments = window.instrumentEngine?.getInstrumentSettings
        ? window.instrumentEngine.getInstrumentSettings()
        : [];

    processAudioFromFunction({ functionString: funcStr }, {
        xRange: [xMin, xMax],
        pointCount,
        noteDuration,
        useAmplitudeModulation,
        useVibrato,
        genre,
        instrument,
        instruments
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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudioPlayer);
} else {
    initAudioPlayer();
}