const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const JAZZ_SCALE = [0, 2, 3, 5, 7, 9, 10];
const EDM_SCALE = [0, 2, 3, 5, 7, 8, 10];

const INSTRUMENT_PRESETS = {
    piano: {
        name: 'Піаніно',
        waveforms: ['triangle', 'sine'],
        attack: 0.01,
        release: 0.18,
        brightness: 1500,
        detune: 0
    },
    synth: {
        name: 'Синтезатор',
        waveforms: ['sawtooth', 'square'],
        attack: 0.02,
        release: 0.12,
        brightness: 2600,
        detune: 4
    },
    bass: {
        name: 'Бас',
        waveforms: ['square', 'sine'],
        attack: 0.015,
        release: 0.14,
        brightness: 700,
        detune: 0
    },
    flute: {
        name: 'Флейта',
        waveforms: ['sine', 'triangle'],
        attack: 0.04,
        release: 0.2,
        brightness: 2100,
        detune: 1
    }
};

function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function frequencyToMidi(freq) {
    return 69 + 12 * Math.log2(freq / 440);
}

function quantizeMidiToScale(midi, scale) {
    let bestMidi = Math.round(midi);
    let minDistance = Infinity;

    for (let octaveShift = -2; octaveShift <= 2; octaveShift++) {
        for (const note of scale) {
            const candidate = Math.floor(midi / 12) * 12 + note + octaveShift * 12;
            const dist = Math.abs(candidate - midi);
            if (dist < minDistance) {
                minDistance = dist;
                bestMidi = candidate;
            }
        }
    }

    return bestMidi;
}

function getGenreDescription(genre) {
    switch (genre) {
        case 'pop':
            return '<strong>Поп:</strong> діатонічне квантування до множини S = {0,2,4,5,7,9,11} mod 12, рівномірний ритм і стабільна гармонічна поведінка.';
        case 'jazz':
            return '<strong>Джаз:</strong> робота в просторі mod 12, джазова шкала, акордові наближення та swing-ритм через нерівномірний поділ часу.';
        case 'edm':
            return '<strong>Електронна танцювальна музика:</strong> ритмічні акценти, спектрально яскравіший тембр, басові просадки та пульсуюча амплітуда.';
        default:
            return '<strong>Оригінальний:</strong> пряме перетворення значень функції у висоти без жанрового обмеження.';
    }
}

function applyGenreToNotes(notes, genre) {
    if (!Array.isArray(notes)) return notes;

    return notes.map((note, index) => {
        const next = { ...note };

        if (genre === 'pop') {
            const midi = frequencyToMidi(next.frequency);
            next.frequency = midiToFrequency(quantizeMidiToScale(midi, MAJOR_SCALE));
            next.duration = note.duration;
        }

        if (genre === 'jazz') {
            const midi = frequencyToMidi(next.frequency);
            next.frequency = midiToFrequency(quantizeMidiToScale(midi, JAZZ_SCALE));
            next.duration = note.duration * (index % 2 === 0 ? 1.14 : 0.86);
            next.amplitude = Math.min(1, (next.amplitude ?? 0.5) * (index % 2 === 0 ? 1.05 : 0.92));
        }

        if (genre === 'edm') {
            const midi = frequencyToMidi(next.frequency);
            next.frequency = midiToFrequency(quantizeMidiToScale(midi, EDM_SCALE));
            if (index % 4 === 0) next.amplitude = Math.min(1, (next.amplitude ?? 0.5) + 0.25);
            if (index % 8 < 2) next.frequency *= 0.5;
            next.duration = note.duration;
        }

        return next;
    });
}

window.genreEngine = {
    INSTRUMENT_PRESETS,
    applyGenreToNotes,
    getGenreDescription
};
