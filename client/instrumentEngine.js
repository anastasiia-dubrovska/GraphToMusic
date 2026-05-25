const INSTRUMENT_LIST = {
    piano: { name: 'Piano', waveforms: ['triangle', 'sine'], attack: 0.02, release: 0.18, brightness: 2200 },
    synth: { name: 'Synth', waveforms: ['sawtooth', 'square'], attack: 0.01, release: 0.12, brightness: 3200 },
    bass: { name: 'Bass', waveforms: ['sine'], attack: 0.03, release: 0.16, brightness: 900 },
    flute: { name: 'Flute', waveforms: ['sine', 'triangle'], attack: 0.08, release: 0.25, brightness: 2600 },
    guitar: { name: 'Guitar', waveforms: ['square', 'triangle'], attack: 0.02, release: 0.22, brightness: 1800 },
    violin: { name: 'Violin', waveforms: ['sawtooth', 'triangle'], attack: 0.09, release: 0.3, brightness: 2800 },
    bell: { name: 'Bell', waveforms: ['sine', 'triangle'], attack: 0.005, release: 0.45, brightness: 4200 },
    pad: { name: 'Ambient Pad', waveforms: ['triangle', 'sine'], attack: 0.25, release: 0.55, brightness: 1600 }
};

let extraInstrumentCounter = 0;

function fillMainInstrumentSelect() {
    const select = document.getElementById('instrumentSelect');
    if (!select) return;

    select.innerHTML = Object.entries(INSTRUMENT_LIST)
        .map(([key, preset]) => `<option value="${key}">${preset.name}</option>`)
        .join('');

    select.value = 'piano';
}

function createExtraInstrumentCard() {
    extraInstrumentCounter++;

    const card = document.createElement('div');
    card.className = 'instrument-card';

    const options = Object.entries(INSTRUMENT_LIST)
        .map(([key, preset]) => `<option value="${key}">${preset.name}</option>`)
        .join('');

    card.innerHTML = `
        <div class="instrument-card-header">
            <h4>Додаткова функція ${extraInstrumentCounter}</h4>
            <button type="button" class="remove-instrument-btn">×</button>
        </div>

        <label>
            Функція
            <input type="text" class="instrument-function" value="cos(x)">
        </label>

        <label>
            Інструмент
            <select class="instrument-type">
                ${options}
            </select>
        </label>

        <div class="instrument-grid">
            <label>
                Гучність
                <input type="range" class="instrument-volume" min="0.1" max="1" step="0.05" value="0.5">
            </label>

            <label>
                Октава
                <input type="number" class="instrument-octave" min="-3" max="3" value="0">
            </label>

            <label>
                Тривалість ноти
                <input type="number" class="instrument-duration" min="0.05" max="1" step="0.05" value="0.2">
            </label>
        </div>
    `;

    card.querySelector('.instrument-type').value = 'violin';

    card.querySelector('.remove-instrument-btn').addEventListener('click', () => {
        card.remove();
    });

    return card;
}

function addExtraInstrument() {
    const list = document.getElementById('instrumentList');
    if (!list) return;

    list.appendChild(createExtraInstrumentCard());
    const applyBtn = document.getElementById('applyInstrumentsBtn');

    if (applyBtn) {
        applyBtn.style.display = 'inline-flex';
    }
}

function getInstrumentSettings() {
    const mainFunction = document.querySelector('.function-input')?.value?.trim() || 'sin(x)';
    const mainInstrument = document.getElementById('instrumentSelect')?.value || 'piano';
    const noteDuration = parseFloat(document.getElementById('noteDuration')?.value || '0.2');

    const instruments = [
        {
            type: mainInstrument,
            name: INSTRUMENT_LIST[mainInstrument]?.name || 'Piano',
            functionExpression: mainFunction,
            volume: 0.5,
            octave: 0,
            noteDuration,
            ...INSTRUMENT_LIST[mainInstrument]
        }
    ];

    document.querySelectorAll('.instrument-card').forEach(card => {
        const type = card.querySelector('.instrument-type')?.value || 'piano';
        const functionExpression = card.querySelector('.instrument-function')?.value?.trim();

        if (!functionExpression) return;

        instruments.push({
            type,
            name: INSTRUMENT_LIST[type]?.name || type,
            functionExpression,
            volume: parseFloat(card.querySelector('.instrument-volume')?.value || '0.5'),
            octave: parseInt(card.querySelector('.instrument-octave')?.value || '0', 10),
            noteDuration: parseFloat(card.querySelector('.instrument-duration')?.value || noteDuration),
            ...INSTRUMENT_LIST[type]
        });
    });

    return instruments;
}

function initInstrumentEngine() {
    fillMainInstrumentSelect();

    const addBtn = document.getElementById('addInstrumentBtn');
    if (addBtn) {
        addBtn.onclick = addExtraInstrument;
    }

    const applyBtn = document.getElementById('applyInstrumentsBtn');
    if (applyBtn) {
        applyBtn.onclick = () => {
            if (typeof window.generateCurrentComposition === 'function') {
                window.generateCurrentComposition();
            } else {
                alert('Функцію генерації не знайдено');
            }
        };
    }
}
window.instrumentEngine = {
    INSTRUMENT_PRESETS: INSTRUMENT_LIST,
    initInstrumentEngine,
    getInstrumentSettings,
    addExtraInstrument
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInstrumentEngine);
} else {
    initInstrumentEngine();
}