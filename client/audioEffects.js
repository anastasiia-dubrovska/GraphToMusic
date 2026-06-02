const ECHO_TIME = 0.3;
const ECHO_FEEDBACK = 0.4;
const HARMONY_INTERVALS = [4, 7];
const ARPEGGIO_SPEED = 0.1;
const LFO_RATE = 0.5;
const LFO_DEPTH = 300;

window.effectSettings = {
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
    lfoDepth: LFO_DEPTH,
    waveform: 'sine'
};


window.applyEffectsToNotes = function applyEffectsToNotes(notes) {
    if (!notes?.length) return notes;
    let result = [...notes];


    if (window.effectSettings.usePitchShift && window.effectSettings.pitchShiftAmount !== 0) {
        result = result.map(n => ({
            ...n,
            frequency: n.frequency * Math.pow(2, window.effectSettings.pitchShiftAmount / 12)
        }));
    }


    if (window.effectSettings.useHarmony) {
        const extra = [];
        result.forEach(n => {
            window.effectSettings.harmonyIntervals.forEach(interval => {
                extra.push({
                    ...n,
                    frequency: n.frequency * Math.pow(2, interval / 12),
                    amplitude: (n.amplitude ?? 0.5) * 0.6
                });
            });
        });
        result = [...result, ...extra];
    }


    if (window.effectSettings.useArpeggiator) {
        const chordSize = 3;
        const arpSpeed = window.effectSettings.arpeggioSpeed;
        const newNotes = [];
        for (let i = 0; i < result.length; i += chordSize) {
            let chord = result.slice(i, i + chordSize);
            switch (window.effectSettings.arpeggioPattern) {
                case 'down': chord = chord.reverse(); break;
                case 'updown': chord = [...chord, ...chord.slice(1, -1).reverse()]; break;
                case 'random': chord = chord.sort(() => Math.random() - 0.5); break;
            }
            chord.forEach((note, j) => {
                newNotes.push({ ...note, duration: arpSpeed * 0.9 });
            });
        }
        result = newNotes;
    }

    return result;
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
        const harmonyType = document.getElementById('harmony-type').value;
        let harmonyIntervals;
        switch (harmonyType) {
            case 'minor':   harmonyIntervals = [3, 7]; break;
            case 'seventh': harmonyIntervals = [4, 7, 10]; break;
            default:        harmonyIntervals = [4, 7];
        }

        Object.assign(window.effectSettings, {
            useEcho:          document.getElementById('effect-echo').checked,
            echoTime:         parseFloat(document.getElementById('echo-time').value),
            echoFeedback:     parseFloat(document.getElementById('echo-feedback').value),
            useHarmony:       document.getElementById('effect-harmony').checked,
            harmonyIntervals,
            useArpeggiator:   document.getElementById('effect-arpeggiator').checked,
            arpeggioSpeed:    parseFloat(document.getElementById('arp-speed').value),
            arpeggioPattern:  document.getElementById('arp-pattern').value,
            usePitchShift:    document.getElementById('effect-pitch').checked,
            pitchShiftAmount: parseInt(document.getElementById('pitch-amount').value),
            useLFO:           document.getElementById('effect-lfo').checked,
            lfoRate:          parseFloat(document.getElementById('lfo-rate').value),
            lfoDepth:         parseFloat(document.getElementById('lfo-depth').value),
            waveform:         document.getElementById('waveform-type').value
        });


        const audioData = window.audioPlayer.getCurrentAudioData();
        if (!audioData) return;

        if (audioData.tracks?.length) {
            audioData.tracks.forEach(track => {
                track.notes = applyEffectsToNotes(track.notes);
            });
            audioData.notes = audioData.tracks.flatMap(t => t.notes);
        } else if (audioData.notes) {
            audioData.notes = applyEffectsToNotes(audioData.notes);
        }

        console.log('✅ Ефекти застосовано, перша нота:', audioData.notes[0]);
    });
}

function addEffectsStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .effects-container { margin: 20px 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .effects-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background-color: #f5f5f5; border-bottom: 1px solid #ddd; }
        .effects-header h3 { margin: 0; font-size: 16px; }
        .btn-expand { background: none; border: none; font-size: 16px; cursor: pointer; }
        .effects-panel { padding: 15px; }
        .effect-group { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
        .effect-params { padding-left: 25px; margin-top: 8px; }
        .effect-params label { display: block; margin: 5px 0; }
        .waveform-selector { margin: 15px 0; }
        .btn-apply { display: block; width: 100%; padding: 8px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 10px; }
        .btn-apply:hover { background-color: #45a049; }
    `;
    document.head.appendChild(styleElement);
}

function initAudioEffects() {
    initEffectsUI();
    addEffectsStyles();
    console.log('🎛️ Аудіо-ефекти ініціалізовано');
}

window.audioEffects = { initAudioEffects, effectSettings: window.effectSettings };