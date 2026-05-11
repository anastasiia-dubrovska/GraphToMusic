
const INSTRUMENT_PRESETS = {
    piano: {
        name: 'Piano',
        waveform: 'triangle',
        volume: 0.55,
        octave: 0,
        noteDuration: 0.22
    },
    bass: {
        name: 'Bass',
        waveform: 'sine',
        volume: 0.7,
        octave: -1,
        noteDuration: 0.35
    },
    flute: {
        name: 'Flute',
        waveform: 'sine',
        volume: 0.45,
        octave: 1,
        noteDuration: 0.28
    },
    synth: {
        name: 'Synth',
        waveform: 'sawtooth',
        volume: 0.5,
        octave: 0,
        noteDuration: 0.18
    },
    guitar: {
        name: 'Guitar',
        waveform: 'square',
        volume: 0.5,
        octave: 0,
        noteDuration: 0.25
    },
    violin: {
        name: 'Violin',
        waveform: 'sawtooth',
        volume: 0.42,
        octave: 1,
        noteDuration: 0.3
    },
    pad: {
        name: 'Ambient Pad',
        waveform: 'triangle',
        volume: 0.35,
        octave: 0,
        noteDuration: 0.55
    },
    bell: {
        name: 'Bell',
        waveform: 'sine',
        volume: 0.4,
        octave: 2,
        noteDuration: 0.18
    }
};

let instrumentCounter = 0;

function createInstrumentCard(data = {}) {
    instrumentCounter++;

    const id = `instrument-${instrumentCounter}`;

    const wrapper = document.createElement('div');
    wrapper.className = 'instrument-card';
    wrapper.dataset.instrumentId = id;

    wrapper.innerHTML = `
        <div class="instrument-card-header">
            <h4>Інструмент ${instrumentCounter}</h4>
            <button type="button" class="remove-instrument-btn">×</button>
        </div>

        <label>
            Тип інструменту
            <select class="instrument-type">
                <option value="piano">Piano</option>
                <option value="bass">Bass</option>
                <option value="flute">Flute</option>
                <option value="synth">Synth</option>
                <option value="guitar">Guitar</option>
                <option value="violin">Violin</option>
                <option value="pad">Ambient Pad</option>
                <option value="bell">Bell</option>
            </select>
        </label>

        <label>
            Функція для інструменту
            <input type="text" class="instrument-function" value="${data.function || 'sin(x)'}">
        </label>

        <div class="instrument-grid">
            <label>
                Гучність
                <input type="range" class="instrument-volume" min="0.1" max="1" step="0.05" value="${data.volume || 0.5}">
            </label>

            <label>
                Октава
                <input type="number" class="instrument-octave" min="-3" max="3" value="${data.octave || 0}">
            </label>

            <label>
                Тривалість ноти
                <input type="number" class="instrument-duration" min="0.05" max="1" step="0.05" value="${data.noteDuration || 0.2}">
            </label>
        </div>
    `;

    const typeSelect = wrapper.querySelector('.instrument-type');
    typeSelect.value = data.type || 'piano';

    typeSelect.addEventListener('change', () => {
        const preset = INSTRUMENT_PRESETS[typeSelect.value];

        wrapper.querySelector('.instrument-volume').value = preset.volume;
        wrapper.querySelector('.instrument-octave').value = preset.octave;
        wrapper.querySelector('.instrument-duration').value = preset.noteDuration;
    });

    wrapper.querySelector('.remove-instrument-btn').addEventListener('click', () => {
        wrapper.remove();
    });

    return wrapper;
}

function initInstrumentEngine() {
    const list = document.getElementById('instrumentList');
    const addBtn = document.getElementById('addInstrumentBtn');

    if (!list || !addBtn) return;
    list.innerHTML = '';

    addBtn.addEventListener('click', () => {
        list.appendChild(createInstrumentCard());
    });

    list.appendChild(createInstrumentCard({
        type: 'piano',
        function: 'sin(x)',
        volume: 0.55,
        octave: 0,
        noteDuration: 0.22
    }));

    list.appendChild(createInstrumentCard({
        type: 'bass',
        function: 'cos(x)',
        volume: 0.7,
        octave: -1,
        noteDuration: 0.35
    }));
}

function getInstrumentSettings() {
    const cards = document.querySelectorAll('.instrument-card');

    return Array.from(cards).map(card => {
        const type = card.querySelector('.instrument-type').value;
        const preset = INSTRUMENT_PRESETS[type];

        return {
            type,
            name: preset.name,
            waveform: preset.waveform,
            functionExpression: card.querySelector('.instrument-function').value,
            volume: parseFloat(card.querySelector('.instrument-volume').value),
            octave: parseInt(card.querySelector('.instrument-octave').value),
            noteDuration: parseFloat(card.querySelector('.instrument-duration').value)
        };
    });
}

window.instrumentEngine = {
    initInstrumentEngine,
    getInstrumentSettings,
    INSTRUMENT_PRESETS
};

function safeInitInstrumentEngine() {
    const list = document.getElementById('instrumentList');
    const addBtn = document.getElementById('addInstrumentBtn');

    if (!list || !addBtn) {
        console.warn('instrumentList або addInstrumentBtn не знайдено');
        return;
    }

    if (list.dataset.initialized === 'true') return;
    list.dataset.initialized = 'true';

    initInstrumentEngine();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitInstrumentEngine);
} else {
    safeInitInstrumentEngine();
}