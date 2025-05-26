// audioPlayer.js - Updated section

const NOTE_DURATION = 0.2; 
const BASE_FREQUENCY = 440; 
const SCALE_FACTOR = 100;
const DEFAULT_X_RANGE = [-10, 10]; 
const DEFAULT_POINT_COUNT = 100; 
let audioContext = null;
let isPlaying = false;
let playbackPosition = 0;
let playbackStartTime = 0;
let currentNote = 0;
let playbackInterval = null;
let audioData = null;
let currentSettings = {
    xRange: DEFAULT_X_RANGE,
    pointCount: DEFAULT_POINT_COUNT,
    noteDuration: NOTE_DURATION,
    useAmplitudeModulation: false,
    useVibrato: false
};


function generateAudioData(functionString, options = {}) {
    const {
        xRange = DEFAULT_X_RANGE,
        pointCount = DEFAULT_POINT_COUNT,
        useAmplitudeModulation = false,
        useVibrato = false,
        noteDuration = NOTE_DURATION
    } = options;

    currentSettings = {
        xRange,
        pointCount,
        noteDuration,
        useAmplitudeModulation,
        useVibrato
    };

    const compiledFunction = window.visualization.createFunction(functionString);
    if (typeof compiledFunction !== 'function') {
        throw new Error("Помилка: створена функція недійсна. Перевір синтаксис виразу.");
    }

    const [xMin, xMax] = xRange;

    const step = (xMax - xMin) / (pointCount - 1);
    const xValues = Array.from({ length: pointCount }, (_, i) => xMin + i * step);


    const yValues = xValues.map(x => {
        try {
            return compiledFunction(x);
        } catch {
            return NaN;
        }
    });


    const validY = yValues.filter(y => !isNaN(y));
    const yMin = Math.min(...validY);
    const yMax = Math.max(...validY);

  
    const normalizedValues = yValues.map(y => (isNaN(y) ? 0.5 : (y - yMin) / (yMax - yMin)));


    const SCALE_MIN = 220; 
    const SCALE_MAX = 880; 
    const mapToFrequency = norm => SCALE_MIN + norm * (SCALE_MAX - SCALE_MIN);

    const notes = normalizedValues.map(norm => ({
        frequency: mapToFrequency(norm),
        duration: noteDuration 
    }));

    // Vi = g(|f'(x)|)
    if (useAmplitudeModulation) {
        const h = 0.001;
        const derivative = xValues.map((x, i) => {
            const xp = x + h, xm = x - h;
            try {
                return Math.abs((compiledFunction(xp) - compiledFunction(xm)) / (2 * h));
            } catch {
                return 0;
            }
        });
        derivative.forEach((d, i) => {
            notes[i].amplitude = Math.min(1, d / 10);
        });
    } else {
        notes.forEach(n => n.amplitude = 0.5);
    }


    if (useVibrato) {
        const h = 0.001;
        const secondDerivative = xValues.map((x, i) => {
            const xp = x + h, x0 = x, xm = x - h;
            try {
                return (compiledFunction(xp) - 2 * compiledFunction(x0) + compiledFunction(xm)) / (h * h);
            } catch {
                return 0;
            }
        });
        secondDerivative.forEach((s, i) => {
            notes[i].vibratoDepth = Math.abs(s) / 20;
            notes[i].vibratoRate = 5 + Math.abs(s) / 5;
        });
    }


    return {
        notes,
        tempo: 120,
        xValues,
        originalValues: yValues,
        normalizedValues
    };
}


function computeDerivative(functionString, xValues) {
    const compiledFunction = window.visualization.createFunction(functionString);
    const h = 0.001;
    return xValues.map((x, i) => {
        if (i === 0 || i === xValues.length - 1) return 0; 
        const y1 = compiledFunction(x + h);
        const y2 = compiledFunction(x - h);
        return (y1 - y2) / (2 * h);
    });
}

function computeSecondDerivative(functionString, xValues) {
    const compiledFunction = window.visualization.createFunction(functionString);
    const h = 0.001; 
    return xValues.map((x, i) => {
        if (i === 0 || i === xValues.length - 1 || i === 1 || i === xValues.length - 2) return 0; 
        const y1 = compiledFunction(x + h);
        const y2 = compiledFunction(x);
        const y3 = compiledFunction(x - h);
        return (y1 - 2 * y2 + y3) / (h * h);
    });
}


function playNote(frequency, duration, startTime = audioContext.currentTime, amplitude = 0.5, vibrato = null) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = amplitude;


    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(amplitude, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration - 0.01);


    if (vibrato && vibrato.vibratoDepth && vibrato.vibratoRate) {
        const vibratoOscillator = audioContext.createOscillator();
        vibratoOscillator.type = 'sine';
        vibratoOscillator.frequency.value = vibrato.vibratoRate;

        const vibratoGain = audioContext.createGain();
        vibratoGain.gain.value = vibrato.vibratoDepth;

        vibratoOscillator.connect(vibratoGain);
        vibratoGain.connect(oscillator.frequency);
        vibratoOscillator.start(startTime);
        vibratoOscillator.stop(startTime + duration);
    }

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);

    return oscillator;
}

function playMusic() {
    if (!audioData || !audioData.notes || audioData.notes.length === 0) {
        console.error('No audio data to play');
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

    for (let i = currentNote; i < audioData.notes.length; i++) {
        const note = audioData.notes[i];
        const noteTime = startTime + (i - currentNote) * noteDuration + elapsed;
        playNote(note.frequency, noteDuration, noteTime, note.amplitude, note.vibratoDepth ? { vibratoDepth: note.vibratoDepth, vibratoRate: note.vibratoRate } : null);
    }

    playbackInterval = setInterval(updatePlaybackProgress, 100);

    setTimeout(() => {
        if (isPlaying) {
            stopMusic();
        }
    }, (audioData.notes.length - currentNote) * noteDuration * 1000);
}

function updatePlaybackProgress() {
    if (!isPlaying || !audioData || !audioData.notes) return;

    const currentTime = audioContext.currentTime - playbackStartTime;
    const totalTime = audioData.notes.length * currentSettings.noteDuration;

    const progressPercent = (currentTime / totalTime) * 100;
    document.querySelector('.progress-bar').style.width = `${progressPercent}%`;


    document.getElementById('currentTime').textContent = formatTime(currentTime);
    document.getElementById('totalTime').textContent = formatTime(totalTime);


    updateGraphCursor(
        currentTime,
        currentSettings.noteDuration,
        audioData.notes.length,
        parseFloat(document.getElementById('xMin').value),
        parseFloat(document.getElementById('xMax').value)
    );

    if (currentTime >= totalTime) {
        stopMusic();
    }
}

function pauseMusic() {
    if (!isPlaying || !audioContext) return;
    
    audioContext.suspend();
    isPlaying = false;
    playbackPosition = audioContext.currentTime - playbackStartTime;

    clearInterval(playbackInterval);
    document.querySelector('.music-player').classList.remove('playing');
    document.querySelector('.music-player span').textContent = 'Пауза';
}

function stopMusic() {
    if (!isPlaying || !audioContext) return;

    clearInterval(playbackInterval);
    playbackPosition = 0;
    currentNote = 0;
    isPlaying = false;

    if (audioContext.state !== 'closed') {

        audioContext.close().then(() => {
            audioContext = null;
        });
    }

    document.querySelector('.music-player').classList.remove('playing');
    document.querySelector('.music-player span').textContent = 'Зупинено';
}
function saveAudioFromCurrentData() {
    if (!audioData) {
        alert("Немає аудіо для збереження.");
        return;
    }

    const sampleRate = 44100;
    const wavBlob = encodeWAV(audioData.notes, sampleRate);
    const url = URL.createObjectURL(wavBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'composition.wav';
    a.click();

    URL.revokeObjectURL(url);
}
function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}


function saveComposition() {
    if (!audioData || !audioData.notes) {
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
    if (!functionData || !functionData.functionString) {
        throw new Error('Invalid function data');
    }

    const mergedOptions = {
        xRange: options.xRange || currentSettings.xRange || DEFAULT_X_RANGE,
        pointCount: options.pointCount || currentSettings.pointCount || DEFAULT_POINT_COUNT,
        noteDuration: options.noteDuration || currentSettings.noteDuration || NOTE_DURATION,
        useAmplitudeModulation: options.useAmplitudeModulation !== undefined ? 
                                options.useAmplitudeModulation : 
                                currentSettings.useAmplitudeModulation,
        useVibrato: options.useVibrato !== undefined ? 
                     options.useVibrato : 
                     currentSettings.useVibrato
    };

    audioData = generateAudioData(functionData.functionString, mergedOptions);

    document.querySelector('.result-container').style.display = 'block';
    document.querySelector('.music-player span').textContent = 'Натисніть, щоб послухати результат';
    
    if (window.visualization && window.visualization.drawFunctionGraph) {
        window.visualization.drawFunctionGraph(functionData.functionString, mergedOptions.xRange);
    }

    return audioData;
}

function initAudioPlayer() {
    console.log("🎧 Ініціалізація аудіоплеєра...");

    const pointCountInput = document.getElementById('pointCount');
    const pointCountValue = document.getElementById('pointCountValue');
    if (pointCountInput && pointCountValue) {
        pointCountInput.addEventListener('input', () => {
            pointCountValue.textContent = pointCountInput.value;
        });
    }
    
    const noteDurationInput = document.getElementById('noteDuration');
    const noteDurationValue = document.getElementById('noteDurationValue');
    if (noteDurationInput && noteDurationValue) {
        noteDurationInput.addEventListener('input', () => {
            noteDurationValue.textContent = `${noteDurationInput.value}s`;
        });
    }
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.error('Web Audio API не підтримується в цьому браузері', e);
    }
}

function applySettings() {
    const xMin = parseFloat(document.getElementById('xMin').value);
    const xMax = parseFloat(document.getElementById('xMax').value);
    const pointCount = parseInt(document.getElementById('pointCount').value);
    const noteDuration = parseFloat(document.getElementById('noteDuration').value);
    const useAmplitudeModulation = document.getElementById('amplitudeModulation').checked;
    const useVibrato = document.getElementById('vibratoEffect').checked;

    if (isNaN(xMin) || isNaN(xMax) || isNaN(pointCount) || isNaN(noteDuration)) {
        alert('Будь ласка, введіть коректні числові значення для всіх полів');
        return;
    }
    
    if (xMin >= xMax) {
        alert('Мінімальне значення X має бути менше за максимальне');
        return;
    }

    if (pointCount < 10 || pointCount > 500) {
        alert('Кількість точок має бути від 10 до 500');
        return;
    }

    if (noteDuration < 0.05 || noteDuration > 1) {
        alert('Тривалість ноти має бути від 0.05 до 1 секунди');
        return;
    }

    const options = {
        xRange: [xMin, xMax],
        pointCount,
        noteDuration,
        useAmplitudeModulation,
        useVibrato
    };

    currentSettings = options;

    const funcStr = document.querySelector('#functionInput')?.value || 
                    document.querySelector('.function-input')?.value;
    
    if (!funcStr) {
        alert('Будь ласка, введіть математичну функцію');
        return;
    }

    try {
        processAudioFromFunction({ functionString: funcStr }, options);
        console.log('🎼 Аудіо згенеровано з новими налаштуваннями', options);
    } catch (error) {
        alert('Помилка генерації: ' + error.message);
    }
}
function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      output.setInt16(offset, s, true);
    }
  }

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: 'audio/wav' });
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
    saveAudioFromCurrentData,
    encodeWAV
};