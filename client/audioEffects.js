
const ECHO_TIME = 0.3;
const ECHO_FEEDBACK = 0.4; 
const HARMONY_INTERVALS = [4, 7];
const ARPEGGIO_SPEED = 0.1;
const LFO_RATE = 0.5; 
const LFO_DEPTH = 300; 

const effectSettings = {
    useEcho: false,
    echoTime: ECHO_TIME,
    echoFeedback: ECHO_FEEDBACK,
    useArpeggiator: false,
    arpeggioSpeed: ARPEGGIO_SPEED,
    arpeggioPattern: 'up',
    useHarmony: false,
    harmonyIntervals: HARMONY_INTERVALS,
    usePitchShift: false,
    pitchShiftAmount: 0, 
    useLFO: false,
    lfoRate: LFO_RATE,
    lfoDepth: LFO_DEPTH
};


function playNote(frequency, duration, startTime = audioContext.currentTime, amplitude = 0.5, options = {}) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (effectSettings.usePitchShift) {
        frequency = frequency * Math.pow(2, effectSettings.pitchShiftAmount / 12);
    }
    

    const oscillator = audioContext.createOscillator();
    oscillator.type = options.waveform || 'sine';
    oscillator.frequency.value = frequency;
    
    if (effectSettings.useLFO) {
        applyLFO(oscillator, startTime, duration);
    }
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = amplitude;
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(amplitude, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration - 0.01);
    
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


function applyEcho(sourceNode, startTime, duration) {
    const delayNode = audioContext.createDelay();
    delayNode.delayTime.value = effectSettings.echoTime;
    
    const feedbackGain = audioContext.createGain();
    feedbackGain.gain.value = effectSettings.echoFeedback;
    
    const outputGain = audioContext.createGain();

    sourceNode.connect(outputGain); 
    sourceNode.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    feedbackGain.connect(outputGain); 
    
    
    const stopTime = startTime + duration + (effectSettings.echoTime * 5);
    setTimeout(() => {
        feedbackGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    }, (stopTime - audioContext.currentTime) * 1000);
    
    return outputGain;
}


function applyLFO(oscillator, startTime, duration) {
    const lfo = audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = effectSettings.lfoRate;
    
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = effectSettings.lfoDepth;
    
    lfo.connect(lfoGain);
    

    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 5000;
    
    lfoGain.connect(filter.frequency);
    
    oscillator.connect(filter);
    oscillator.disconnect();
    
    lfo.start(startTime);
    lfo.stop(startTime + duration);
    
    return filter;
}

function playWithHarmony(notes, startTime = audioContext.currentTime, options = {}) {
    if (!notes || notes.length === 0) return;
    
    const noteDuration = currentSettings.noteDuration || NOTE_DURATION;
    
    notes.forEach((note, index) => {
        const noteTime = startTime + index * noteDuration;
        
        playNote(note.frequency, noteDuration, noteTime, note.amplitude, note);
        
        if (effectSettings.useHarmony) {
            effectSettings.harmonyIntervals.forEach(interval => {
                const harmonicFreq = note.frequency * Math.pow(2, interval / 12);
                playNote(harmonicFreq, noteDuration, noteTime, note.amplitude * 0.6, note);
            });
        }
    });
}

function playWithArpeggiator(notes, startTime = audioContext.currentTime, options = {}) {
    if (!notes || notes.length === 0) return;
    
    const noteDuration = currentSettings.noteDuration || NOTE_DURATION;
    const chordSize = 3;
    
    for (let i = 0; i < notes.length; i += chordSize) {
        const chord = notes.slice(i, i + chordSize);
        
        if (effectSettings.useArpeggiator && chord.length > 1) {
            let arpNotes = [...chord];
            
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
            }
            

            arpNotes.forEach((note, arpIndex) => {
                const arpTime = startTime + (i * noteDuration) + (arpIndex * effectSettings.arpeggioSpeed);
                playNote(note.frequency, effectSettings.arpeggioSpeed * 0.9, arpTime, note.amplitude, note);
            });
        } else {
            chord.forEach((note, index) => {
                playNote(note.frequency, noteDuration, startTime + (i * noteDuration), note.amplitude, note);
            });
        }
    }
}

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

    isPlaying = true;
    document.querySelector('.music-player').classList.add('playing');
    const playerLabel = document.querySelector('.player-label') || document.querySelector('.music-player span');
    if (playerLabel) playerLabel.textContent = 'Зараз грає...';

    const doPlay = () => {
        playbackStartTime = audioContext.currentTime;
        playbackPosition = 0;
        currentNote = 0;

        if (audioData.isMultiInstrument && audioData.tracks?.length) {
            const startTime = audioContext.currentTime + 0.05;
            playMultiInstrumentMusic(startTime);
            clearInterval(playbackInterval);
            playbackInterval = setInterval(updatePlaybackProgress, 100);
            return;
        }


        const startTime = audioContext.currentTime + 0.05;
        const noteDuration = currentSettings.noteDuration || NOTE_DURATION;
        const notesToPlay = audioData.notes;

        if (effectSettings.useHarmony) {
            playWithHarmony(notesToPlay, startTime);
        } else if (effectSettings.useArpeggiator) {
            playWithArpeggiator(notesToPlay, startTime);
        } else {
            for (let i = 0; i < notesToPlay.length; i++) {
                const note = notesToPlay[i];
                const noteTime = startTime + (i * noteDuration);
                const vibratoOptions = note.vibratoDepth ?
                    { vibratoDepth: note.vibratoDepth, vibratoRate: note.vibratoRate } : null;
                playNote(note.frequency, noteDuration, noteTime, note.amplitude, { vibrato: vibratoOptions });
            }
        }

        clearInterval(playbackInterval);
        playbackInterval = setInterval(updatePlaybackProgress, 100);

        setTimeout(() => {
            if (isPlaying) stopMusic();
        }, (notesToPlay.length * noteDuration * 1000) + 1000);
    };

    if (audioContext.state === 'suspended') {
        audioContext.resume().then(doPlay);
    } else {
        doPlay();
    }
}

function updateEffects(newEffects) {

    Object.assign(effectSettings, newEffects);
    
    console.log('🎛️ Ефекти оновлено:', effectSettings);
    
    if (isPlaying) {
        const currentPosition = audioContext.currentTime - playbackStartTime;
        stopMusic();
        playbackPosition = currentPosition;
        playMusicWithEffects();
    }
}


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
    
    const resultContainer = document.querySelector('.result-container');
    if (resultContainer) {
        resultContainer.parentNode.insertBefore(effectsContainer, resultContainer);
    }
    
    document.getElementById('expand-effects').addEventListener('click', function() {
        const panel = document.querySelector('.effects-panel');
        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'block' : 'none';
        this.textContent = isHidden ? '▲' : '▼';
    });
    
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
        
        switch (newEffects.harmonyType) {
            case 'minor':
                newEffects.harmonyIntervals = [3, 7];
                break;
            case 'seventh':
                newEffects.harmonyIntervals = [4, 7, 10]; 
                break;
            default: // 'major'
                newEffects.harmonyIntervals = [4, 7]; 
        }
        
        updateEffects(newEffects);
        

        if (document.querySelector('.music-player').classList.contains('playing')) {
            console.log('🔄 Перезапуск з новими ефектами');
            stopMusic();
            setTimeout(() => playMusicWithEffects(), 100);
        }
    });
}


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

function initAudioEffects() {

    const originalPlayMusic = window.audioPlayer.playMusic;
    

    window.audioPlayer.playMusic = playMusicWithEffects;
    

    initEffectsUI();
    addEffectsStyles();
    
    console.log('🎛️ Аудіо-ефекти ініціалізовано');
}


window.audioEffects = {
    initAudioEffects,
    updateEffects,
    effectSettings
};