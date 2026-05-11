

let selectedMusicFile = null;

function initMusicToGraph() {
    const fileInput = document.getElementById('musicFileInput');
    const analyzeBtn = document.getElementById('analyzeMusicBtn');
    const status = document.getElementById('musicToGraphStatus');

    if (!fileInput || !analyzeBtn) return;

    fileInput.addEventListener('change', () => {
        selectedMusicFile = fileInput.files[0] || null;

        if (status) {
            status.textContent = selectedMusicFile
                ? `Обрано файл: ${selectedMusicFile.name}`
                : 'Оберіть аудіофайл для аналізу.';
        }
    });

    analyzeBtn.addEventListener('click', async () => {
        if (!selectedMusicFile) {
            if (status) status.textContent = 'Спочатку оберіть аудіофайл.';
            return;
        }

        try {
            if (status) status.textContent = 'Аналіз аудіофайлу...';
            await analyzeAudioFile(selectedMusicFile);
            if (status) status.textContent = 'Графік успішно побудовано.';
        } catch (error) {
            console.error('Помилка аналізу аудіо:', error);
            if (status) status.textContent = 'Не вдалося обробити аудіофайл.';
        }
    });
}

async function analyzeAudioFile(file) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const originalChannelData = audioBuffer.getChannelData(0);
    const duration = audioBuffer.duration;

    const reverseOptions = getReverseOptions();

    const channelData = preprocessAudioSamples(
    Array.from(originalChannelData),
    audioBuffer.sampleRate,
    reverseOptions);

    const graphPointCount = 300;
    const blockSize = Math.max(1, Math.floor(channelData.length / graphPointCount));

    const xValues = [];
    const envelopeValues = [];

    for (let i = 0; i < graphPointCount; i++) {
        const start = i * blockSize;
        const end = Math.min(start + blockSize, channelData.length);

        let sum = 0;

        for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j]);
        }

        const avgAmplitude = sum / Math.max(1, end - start);

        xValues.push((i / (graphPointCount - 1)) * duration);
        envelopeValues.push(avgAmplitude);
    }

    const smoothed = smoothArray(envelopeValues, 10);
    const normalized = normalizeToMathRange(smoothed, -1, 1);

    renderMusicGraph(xValues, normalized, {
        duration,
        sampleCount: graphPointCount,
        dominantFrequency: estimateDominantFrequency(channelData, audioBuffer.sampleRate)
    });
}

function smoothArray(values, windowSize = 10) {
    const result = [];

    for (let i = 0; i < values.length; i++) {
        let sum = 0;
        let count = 0;

        for (let j = i - windowSize; j <= i + windowSize; j++) {
            if (j >= 0 && j < values.length) {
                sum += values[j];
                count++;
            }
        }

        result.push(sum / count);
    }

    return result;
}

function normalizeToMathRange(values, minTarget = -1, maxTarget = 1) {
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max === min) {
        return values.map(() => 0);
    }

    return values.map(v => {
        return minTarget + ((v - min) / (max - min)) * (maxTarget - minTarget);
    });
}

function estimateDominantFrequency(samples, sampleRate) {
    let zeroCrossings = 0;

    for (let i = 1; i < samples.length; i++) {
        if (
            (samples[i - 1] < 0 && samples[i] >= 0) ||
            (samples[i - 1] > 0 && samples[i] <= 0)
        ) {
            zeroCrossings++;
        }
    }

    const duration = samples.length / sampleRate;
    return Math.round((zeroCrossings / 2) / duration);
}

function renderMusicGraph(xValues, yValues, info) {
    const trace = {
        x: xValues,
        y: yValues,
        mode: 'lines',
        type: 'scatter',
        name: 'Наближена функція',
        line: {
            color: '#2563eb',
            width: 3,
            shape: 'spline'
        }
    };

    const layout = {
        title: 'Music → Graph',
        xaxis: {
            title: 'x / час',
            gridcolor: '#e5e7eb',
            zerolinecolor: '#9ca3af'
        },
        yaxis: {
            title: 'f(x)',
            range: [-1.1, 1.1],
            gridcolor: '#e5e7eb',
            zerolinecolor: '#9ca3af'
        },
        plot_bgcolor: '#f8fbff',
        paper_bgcolor: '#f8fbff',
        margin: {
            l: 60,
            r: 30,
            t: 60,
            b: 60
        }
    };

    Plotly.newPlot('music-graph', [trace], layout, {
        responsive: true
    });

    const metaBlock = document.getElementById('musicGraphMeta');

    if (metaBlock) {
        metaBlock.innerHTML = `
            <strong>Тривалість:</strong> ${info.duration.toFixed(2)} с
            &nbsp;•&nbsp;
            <strong>Домінантна частота:</strong> ${info.dominantFrequency} Hz
            &nbsp;•&nbsp;
            <strong>Точок графіка:</strong> ${info.sampleCount}
        `;
    }
    renderMusicMathPanel(xValues, yValues);
}
function getReverseOptions() {
    return {
        normalize: document.getElementById('reverseNormalize')?.checked ?? true,
        denoise: document.getElementById('reverseDenoise')?.checked ?? true,
        deEcho: document.getElementById('reverseDeEcho')?.checked ?? false,
        smooth: document.getElementById('reverseSmooth')?.checked ?? true,
        highPass: document.getElementById('reverseHighPass')?.checked ?? false,
        lowPass: document.getElementById('reverseLowPass')?.checked ?? false
    };
}

function preprocessAudioSamples(samples, sampleRate, options) {
    let processed = Array.from(samples);

    if (options.normalize) {
        processed = normalizeSamples(processed);
    }

    if (options.denoise) {
        processed = noiseGate(processed, 0.015);
    }

    if (options.deEcho) {
        processed = reduceEcho(processed, sampleRate);
    }

    if (options.highPass) {
        processed = simpleHighPass(processed, 0.985);
    }

    if (options.lowPass) {
        processed = simpleLowPass(processed, 0.08);
    }

    return processed;
}

function normalizeSamples(samples) {
    let max = 0;

    for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i]);
        if (abs > max) max = abs;
    }

    if (max === 0) return samples;

    const result = new Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
        result[i] = samples[i] / max;
    }

    return result;
}

function noiseGate(samples, threshold = 0.015) {
    const result = new Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
        result[i] = Math.abs(samples[i]) < threshold ? 0 : samples[i];
    }

    return result;
}

function reduceEcho(samples, sampleRate) {
    const delayMs = 180;
    const delaySamples = Math.floor(sampleRate * delayMs / 1000);
    const echoAmount = 0.45;

    const result = [...samples];

    for (let i = delaySamples; i < result.length; i++) {
        result[i] = result[i] - echoAmount * result[i - delaySamples];
    }

    return normalizeSamples(result);
}

function simpleLowPass(samples, alpha = 0.08) {
    const result = [];
    let previous = samples[0] || 0;

    for (let i = 0; i < samples.length; i++) {
        previous = previous + alpha * (samples[i] - previous);
        result.push(previous);
    }

    return result;
}

function simpleHighPass(samples, alpha = 0.985) {
    const result = [];
    let previousInput = samples[0] || 0;
    let previousOutput = 0;

    for (let i = 0; i < samples.length; i++) {
        const output = alpha * (previousOutput + samples[i] - previousInput);
        result.push(output);

        previousInput = samples[i];
        previousOutput = output;
    }

    return result;
}
function renderMusicMathPanel(xValues, yValues) {
    const panel = document.getElementById('musicMathStats');
    if (!panel || !xValues.length || !yValues.length) return;

    const firstDerivative = calculateDerivative(xValues, yValues);
    const secondDerivative = calculateDerivative(xValues.slice(1), firstDerivative);

    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const meanY = average(yValues);
    const amplitude = (maxY - minY) / 2;

    const maxFirstDerivative = maxAbs(firstDerivative);
    const meanFirstDerivative = averageAbs(firstDerivative);

    const maxSecondDerivative = maxAbs(secondDerivative);
    const meanSecondDerivative = averageAbs(secondDerivative);

    const extremaCount = countExtrema(yValues);
    const zeroCrossings = countZeroCrossings(yValues);

    const interpretation = buildMathInterpretation({
        amplitude,
        meanFirstDerivative,
        meanSecondDerivative,
        extremaCount,
        zeroCrossings
    });

    panel.innerHTML = `
        <div class="math-stat-grid">
            <div class="math-stat-card">
                <span>Мінімум f(x)</span>
                <strong>${minY.toFixed(3)}</strong>
            </div>

            <div class="math-stat-card">
                <span>Максимум f(x)</span>
                <strong>${maxY.toFixed(3)}</strong>
            </div>

            <div class="math-stat-card">
                <span>Середнє значення</span>
                <strong>${meanY.toFixed(3)}</strong>
            </div>

            <div class="math-stat-card">
                <span>Амплітуда</span>
                <strong>${amplitude.toFixed(3)}</strong>
            </div>

            <div class="math-stat-card">
                <span>max |f′(x)|</span>
                <strong>${maxFirstDerivative.toFixed(3)}</strong>
            </div>

            <div class="math-stat-card">
                <span>avg |f′(x)|</span>
                <strong>${meanFirstDerivative.toFixed(3)}</strong>
            </div>

            <div class="math-stat-card">
                <span>max |f″(x)|</span>
                <strong>${maxSecondDerivative.toFixed(3)}</strong>
            </div>

            <div class="math-stat-card">
                <span>avg |f″(x)|</span>
                <strong>${meanSecondDerivative.toFixed(3)}</strong>
            </div>

            <div class="math-stat-card">
                <span>Кількість екстремумів</span>
                <strong>${extremaCount}</strong>
            </div>

            <div class="math-stat-card">
                <span>Перетини осі Ox</span>
                <strong>${zeroCrossings}</strong>
            </div>
        </div>

        <div class="math-explanation-box">
            <strong>Інтерпретація:</strong>
            <p>${interpretation}</p>
        </div>

        <div class="math-formula-box">
            <strong>Використані чисельні формули:</strong>
            <p>
                Перша похідна:
                <code>f′(xᵢ) ≈ (f(xᵢ₊₁) - f(xᵢ)) / (xᵢ₊₁ - xᵢ)</code>
            </p>
            <p>
                Друга похідна:
                <code>f″(xᵢ) ≈ (f′(xᵢ₊₁) - f′(xᵢ)) / (xᵢ₊₁ - xᵢ)</code>
            </p>
        </div>
    `;
}

function calculateDerivative(xValues, yValues) {
    const derivative = [];

    for (let i = 0; i < yValues.length - 1; i++) {
        const dx = xValues[i + 1] - xValues[i];

        if (dx === 0) {
            derivative.push(0);
        } else {
            derivative.push((yValues[i + 1] - yValues[i]) / dx);
        }
    }

    return derivative;
}

function average(values) {
    if (!values.length) return 0;

    let sum = 0;

    for (const value of values) {
        sum += value;
    }

    return sum / values.length;
}

function averageAbs(values) {
    if (!values.length) return 0;

    let sum = 0;

    for (const value of values) {
        sum += Math.abs(value);
    }

    return sum / values.length;
}

function maxAbs(values) {
    if (!values.length) return 0;

    let max = 0;

    for (const value of values) {
        const abs = Math.abs(value);
        if (abs > max) max = abs;
    }

    return max;
}

function countExtrema(values) {
    let count = 0;

    for (let i = 1; i < values.length - 1; i++) {
        const prev = values[i - 1];
        const curr = values[i];
        const next = values[i + 1];

        if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
            count++;
        }
    }

    return count;
}

function countZeroCrossings(values) {
    let count = 0;

    for (let i = 1; i < values.length; i++) {
        if (
            (values[i - 1] < 0 && values[i] >= 0) ||
            (values[i - 1] > 0 && values[i] <= 0)
        ) {
            count++;
        }
    }

    return count;
}

function buildMathInterpretation(stats) {
    const parts = [];

    if (stats.amplitude > 0.7) {
        parts.push('Графік має високу амплітуду, що відповідає значним змінам гучності або енергії сигналу.');
    } else if (stats.amplitude > 0.35) {
        parts.push('Графік має помірну амплітуду, тобто сигнал має відносно стабільну, але помітну динаміку.');
    } else {
        parts.push('Графік має низьку амплітуду, що вказує на слабкі зміни сигналу.');
    }

    if (stats.meanFirstDerivative > 1.5) {
        parts.push('Велике середнє значення першої похідної означає швидкі зміни форми графіка.');
    } else {
        parts.push('Невелике середнє значення першої похідної означає плавну зміну графіка.');
    }

    if (stats.meanSecondDerivative > 4) {
        parts.push('Високе значення другої похідної вказує на різкі переходи та значну кривизну сигналу.');
    } else {
        parts.push('Невелике значення другої похідної свідчить про відносно плавну кривизну.');
    }

    if (stats.extremaCount > 20) {
        parts.push('Велика кількість екстремумів означає складну коливальну структуру.');
    } else {
        parts.push('Невелика кількість екстремумів свідчить про простішу форму сигналу.');
    }

    return parts.join(' ');
}

document.addEventListener('DOMContentLoaded', initMusicToGraph);