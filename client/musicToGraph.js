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
        reverseOptions
    );

    const graphPointCount = 300;
    const blockSize = Math.max(1, Math.floor(channelData.length / graphPointCount));
    const xValues = [];
    const envelopeValues = [];

    for (let i = 0; i < graphPointCount; i++) {
        const start = i * blockSize;
        const end = Math.min(start + blockSize, channelData.length);
        let sum = 0;
        for (let j = start; j < end; j++) sum += Math.abs(channelData[j]);
        xValues.push((i / (graphPointCount - 1)) * duration);
        envelopeValues.push(sum / Math.max(1, end - start));
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
        let sum = 0, count = 0;
        for (let j = i - windowSize; j <= i + windowSize; j++) {
            if (j >= 0 && j < values.length) { sum += values[j]; count++; }
        }
        result.push(sum / count);
    }
    return result;
}

function normalizeToMathRange(values, minTarget = -1, maxTarget = 1) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 0);
    return values.map(v => minTarget + ((v - min) / (max - min)) * (maxTarget - minTarget));
}

function estimateDominantFrequency(samples, sampleRate) {
    let zeroCrossings = 0;
    for (let i = 1; i < samples.length; i++) {
        if ((samples[i-1] < 0 && samples[i] >= 0) || (samples[i-1] > 0 && samples[i] <= 0))
            zeroCrossings++;
    }
    return Math.round((zeroCrossings / 2) / (samples.length / sampleRate));
}

function renderMusicGraph(xValues, yValues, info) {
    Plotly.newPlot('music-graph', [{
        x: xValues,
        y: yValues,
        mode: 'lines',
        type: 'scatter',
        name: 'Наближена функція',
        line: { color: '#2563eb', width: 3, shape: 'spline' }
    }], {
        title: 'Music → Graph',
        xaxis: { title: 'x / час', gridcolor: '#e5e7eb', zerolinecolor: '#9ca3af' },
        yaxis: { title: 'f(x)', range: [-1.1, 1.1], gridcolor: '#e5e7eb', zerolinecolor: '#9ca3af' },
        plot_bgcolor: '#f8fbff',
        paper_bgcolor: '#f8fbff',
        margin: { l: 60, r: 30, t: 60, b: 60 }
    }, { responsive: true });

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
        denoise:   document.getElementById('reverseDenoise')?.checked ?? true,
        deEcho:    document.getElementById('reverseDeEcho')?.checked ?? false,
        smooth:    document.getElementById('reverseSmooth')?.checked ?? true,
        highPass:  document.getElementById('reverseHighPass')?.checked ?? false,
        lowPass:   document.getElementById('reverseLowPass')?.checked ?? false
    };
}

function preprocessAudioSamples(samples, sampleRate, options) {
    let processed = Array.from(samples);
    if (options.normalize) processed = normalizeSamples(processed);
    if (options.denoise)   processed = noiseGate(processed, 0.015);
    if (options.deEcho)    processed = reduceEcho(processed, sampleRate);
    if (options.highPass)  processed = simpleHighPass(processed, 0.985);
    if (options.lowPass)   processed = simpleLowPass(processed, 0.08);
    return processed;
}

function normalizeSamples(samples) {
    let max = 0;
    for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i]);
        if (abs > max) max = abs;
    }
    if (max === 0) return samples;
    return samples.map(s => s / max);
}

function noiseGate(samples, threshold = 0.015) {
    return samples.map(s => Math.abs(s) < threshold ? 0 : s);
}

function reduceEcho(samples, sampleRate) {
    const delaySamples = Math.floor(sampleRate * 180 / 1000);
    const result = [...samples];
    for (let i = delaySamples; i < result.length; i++)
        result[i] = result[i] - 0.45 * result[i - delaySamples];
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
    let prevIn = samples[0] || 0, prevOut = 0;
    for (let i = 0; i < samples.length; i++) {
        const out = alpha * (prevOut + samples[i] - prevIn);
        result.push(out);
        prevIn = samples[i];
        prevOut = out;
    }
    return result;
}

function renderMusicMathPanel(xValues, yValues) {
    const panel = document.getElementById('musicMathStats');
    if (!panel || !xValues.length || !yValues.length) return;

    const firstDerivative  = calculateDerivative(xValues, yValues);
    const secondDerivative = calculateDerivative(xValues.slice(1), firstDerivative);

    const minY  = Math.min(...yValues);
    const maxY  = Math.max(...yValues);
    const meanY = average(yValues);
    const amplitude = (maxY - minY) / 2;

    const maxFD  = maxAbs(firstDerivative);
    const meanFD = averageAbs(firstDerivative);
    const maxSD  = maxAbs(secondDerivative);
    const meanSD = averageAbs(secondDerivative);

    const extremaCount  = countExtrema(yValues);
    const zeroCrossings = countZeroCrossings(yValues);

    panel.innerHTML = `
        <div class="math-stat-grid">
            <div class="math-stat-card"><span>Мінімум f(x)</span><strong>${minY.toFixed(3)}</strong></div>
            <div class="math-stat-card"><span>Максимум f(x)</span><strong>${maxY.toFixed(3)}</strong></div>
            <div class="math-stat-card"><span>Середнє значення</span><strong>${meanY.toFixed(3)}</strong></div>
            <div class="math-stat-card"><span>Амплітуда</span><strong>${amplitude.toFixed(3)}</strong></div>
            <div class="math-stat-card"><span>max |f′(x)|</span><strong>${maxFD.toFixed(3)}</strong></div>
            <div class="math-stat-card"><span>avg |f′(x)|</span><strong>${meanFD.toFixed(3)}</strong></div>
            <div class="math-stat-card"><span>max |f″(x)|</span><strong>${maxSD.toFixed(3)}</strong></div>
            <div class="math-stat-card"><span>avg |f″(x)|</span><strong>${meanSD.toFixed(3)}</strong></div>
            <div class="math-stat-card"><span>Кількість екстремумів</span><strong>${extremaCount}</strong></div>
            <div class="math-stat-card"><span>Перетини осі Ox</span><strong>${zeroCrossings}</strong></div>
        </div>

        <div class="math-explanation-box">
            <strong>Профіль сигналу:</strong>
            ${buildSignalProfileBlock(yValues)}
        </div>

        <div class="math-formula-box">
            <strong>Використані чисельні формули:</strong>
            <p>Перша похідна: <code>f′(xᵢ) ≈ (f(xᵢ₊₁) - f(xᵢ)) / (xᵢ₊₁ - xᵢ)</code></p>
            <p>Друга похідна: <code>f″(xᵢ) ≈ (f′(xᵢ₊₁) - f′(xᵢ)) / (xᵢ₊₁ - xᵢ)</code></p>
        </div>
    `;
}

function buildSignalProfileBlock(yValues) {
    if (!yValues?.length) return '<p>Немає даних</p>';

    const finite = yValues.filter(v => Number.isFinite(v));
    const n = finite.length;
    const mean = finite.reduce((a, b) => a + b, 0) / n;
    const variance = finite.reduce((a, b) => a + (b - mean) ** 2, 0) / n;

    let derivSum = 0;
    for (let i = 1; i < n; i++) derivSum += Math.abs(finite[i] - finite[i-1]);
    const smoothness = Math.max(0, Math.min(1, 1 / (1 + derivSum / n)));

    let symErr = 0;
    for (let i = 0; i < Math.floor(n / 2); i++)
        symErr += Math.abs(finite[i] - finite[n - 1 - i]);
    const symmetry = Math.max(0, Math.min(1, 1 - symErr / Math.max(1, n / 2)));

    let zc = 0;
    for (let i = 1; i < n; i++)
        if ((finite[i-1] >= 0 && finite[i] < 0) || (finite[i-1] < 0 && finite[i] >= 0)) zc++;
    const harmonicity = Math.max(0, Math.min(1, zc / Math.max(1, n / 10)));
    const complexity  = Math.max(0, Math.min(1, variance * 2 + (1 - smoothness)));

    const maxY = Math.max(...finite);
    const minY = Math.min(...finite);
    const amplitude = ((maxY - minY) / 2).toFixed(2);
    const offset    = mean.toFixed(2);

   
    const xs = Array.from({ length: n }, (_, i) => i / (n - 1));

    function rmse(predicted) {
        let sum = 0;
        for (let i = 0; i < n; i++) sum += (finite[i] - predicted[i]) ** 2;
        return Math.sqrt(sum / n);
    }

    // DFT
    function computeDFT(signal, maxTerms = 5) {
        const N = signal.length;
        const terms = [];
        for (let k = 1; k <= Math.min(maxTerms * 4, Math.floor(N / 2)); k++) {
            let re = 0, im = 0;
            for (let t = 0; t < N; t++) {
                const angle = (2 * Math.PI * k * t) / N;
                re += signal[t] * Math.cos(angle);
                im -= signal[t] * Math.sin(angle);
            }
            re = (2 * re) / N;
            im = (2 * im) / N;
            terms.push({ k, amp: Math.sqrt(re*re + im*im), phase: Math.atan2(im, re) });
        }
        terms.sort((a, b) => b.amp - a.amp);
        return terms.slice(0, maxTerms);
    }

    //Фур'є (топ-3 гармоніки)
    function fitFourier() {
        const centered = finite.map(v => v - mean);
        const terms = computeDFT(centered, 3);
        const pred = xs.map((_, i) => {
            let val = mean;
            for (const t of terms)
                val += t.amp * Math.cos((2 * Math.PI * t.k * i) / n + t.phase);
            return val;
        });
        const parts = terms.map(t => {
            const omega = (2 * Math.PI * t.k).toFixed(1);
            const phi = t.phase >= 0
                ? `+ ${t.phase.toFixed(2)}`
                : `− ${Math.abs(t.phase).toFixed(2)}`;
            return `${t.amp.toFixed(2)}·cos(${omega}x ${phi})`;
        });
        return {
            err: rmse(pred),
            type: "Фур'є",
            formula: `f(x) ≈ ${parts.join(' + ')}`,
            description: "Розклад у ряд Фур'є — топ-3 домінантні гармоніки сигналу",
            terms
        };
    }

    // A·sin(ωx+φ)·e^(−αx) + C
    function fitDampedSine() {
        const terms = computeDFT(finite.map(v => v - mean), 1);
        const omega0 = (terms[0]?.k || 3) * 2 * Math.PI;
        let bestErr = Infinity, bestAlpha = 1, bestOmega = omega0, bestPhi = 0;

        for (let alpha = 0.5; alpha <= 8; alpha += 0.5) {
            for (let om = 0.5; om <= 2; om += 0.25) {
                for (let phi = 0; phi < Math.PI * 2; phi += 0.5) {
                    const omega = omega0 * om;
                    const pred = xs.map(x =>
                        parseFloat(amplitude) * Math.sin(omega * x + phi) * Math.exp(-alpha * x) + mean
                    );
                    const err = rmse(pred);
                    if (err < bestErr) { bestErr = err; bestAlpha = alpha; bestOmega = omega; bestPhi = phi; }
                }
            }
        }

        const offStr = mean < 0 ? `− ${Math.abs(mean).toFixed(2)}` : `+ ${mean.toFixed(2)}`;
        return {
            err: bestErr,
            type: 'Затухаюча',
            formula: `f(x) ≈ ${amplitude}·sin(${bestOmega.toFixed(1)}x + ${bestPhi.toFixed(2)})·e^(−${bestAlpha.toFixed(1)}x) ${offStr}`,
            description: 'Синусоїда з експоненціальним затуханням — типово для струнних або дзвонів'
        };
    }

    // Поліном 3-го степеня 
    function fitPolynomial() {
        let a = 0, b = 0, c = 0, d = mean;
        const lr = 0.1;
        for (let iter = 0; iter < 300; iter++) {
            let da = 0, db = 0, dc = 0, dd = 0;
            for (let i = 0; i < n; i++) {
                const x = xs[i];
                const err2 = (a*x**3 + b*x**2 + c*x + d) - finite[i];
                da += err2 * x**3;
                db += err2 * x**2;
                dc += err2 * x;
                dd += err2;
            }
            a -= lr * da / n;
            b -= lr * db / n;
            c -= lr * dc / n;
            d -= lr * dd / n;
        }
        const pred = xs.map(x => a*x**3 + b*x**2 + c*x + d);
        const fmt = v => v >= 0 ? `+ ${v.toFixed(2)}` : `− ${Math.abs(v).toFixed(2)}`;
        return {
            err: rmse(pred),
            type: 'Поліноміальна',
            formula: `f(x) ≈ ${a.toFixed(2)}x³ ${fmt(b)}x² ${fmt(c)}x ${fmt(d)}`,
            description: 'Поліном 3-го степеня — підходить для трендових або асиметричних сигналів'
        };
    }

    // A·e^(−α(x−x0)²) + C
    function fitGaussian() {
        const peakIdx = finite.indexOf(Math.max(...finite));
        let bestErr = Infinity, bestAlpha = 5, bestX0 = xs[peakIdx];
        for (let alpha = 1; alpha <= 40; alpha++) {
            for (let x0 = 0.05; x0 <= 0.95; x0 += 0.05) {
                const pred = xs.map(x =>
                    parseFloat(amplitude) * Math.exp(-alpha * (x - x0)**2) + parseFloat(offset)
                );
                const err = rmse(pred);
                if (err < bestErr) { bestErr = err; bestAlpha = alpha; bestX0 = x0; }
            }
        }
        const offVal = parseFloat(offset);
        const offStr = offVal < 0 ? `− ${Math.abs(offVal).toFixed(2)}` : `+ ${offVal.toFixed(2)}`;
        return {
            err: bestErr,
            type: 'Дзвінова',
            formula: `f(x) ≈ ${amplitude}·e^(−${bestAlpha}(x − ${bestX0.toFixed(2)})²) ${offStr}`,
            description: 'Гауссова крива — пік енергії в одній точці, типово для ударних'
        };
    }

    // A·ln(bx+1) + C
    function fitLogarithmic() {
        let bestErr = Infinity, bestB = 1;
        for (let b = 0.5; b <= 20; b += 0.5) {
            const pred = xs.map(x =>
                parseFloat(amplitude) * Math.log(b * x + 1) / Math.log(b + 1) + parseFloat(offset)
            );
            const err = rmse(pred);
            if (err < bestErr) { bestErr = err; bestB = b; }
        }
        const offVal = parseFloat(offset);
        const offStr = offVal < 0 ? `− ${Math.abs(offVal).toFixed(2)}` : `+ ${offVal.toFixed(2)}`;
        return {
            err: bestErr,
            type: 'Логарифмічна',
            formula: `f(x) ≈ ${amplitude}·ln(${bestB.toFixed(1)}x + 1) ${offStr}`,
            description: 'Логарифмічне зростання — швидкий старт із поступовим уповільненням'
        };
    }

    // A·e^(−αx) + C
    function fitDecay() {
        let bestErr = Infinity, bestAlpha = 1;
        for (let alpha = 0.1; alpha <= 15; alpha += 0.1) {
            const pred = xs.map(x =>
                parseFloat(amplitude) * Math.exp(-alpha * x) + parseFloat(offset)
            );
            const err = rmse(pred);
            if (err < bestErr) { bestErr = err; bestAlpha = alpha; }
        }
        const offVal = parseFloat(offset);
        const offStr = offVal < 0 ? `− ${Math.abs(offVal).toFixed(2)}` : `+ ${offVal.toFixed(2)}`;
        return {
            err: bestErr,
            type: 'Затухання',
            formula: `f(x) ≈ ${amplitude}·e^(−${bestAlpha.toFixed(2)}x) ${offStr}`,
            description: 'Експоненціальне затухання — рівномірне спадання сигналу'
        };
    }

    
    const candidates = [
        fitFourier(),
        fitDampedSine(),
        fitPolynomial(),
        fitGaussian(),
        fitLogarithmic(),
        fitDecay()
    ];

    const best = candidates.reduce((a, b) => a.err < b.err ? a : b);
    const waveType   = best.type;
    const formula    = best.formula;
    const description = best.description;
    const bestError  = best.err.toFixed(3);

    const explanation = buildWaveExplanation(waveType, {
        harmonicity, smoothness, symmetry, complexity, zc, finite,
        bestError, candidates
    });

    const metrics = [
        { label: 'Гармонічність', value: harmonicity, color: '#3b82f6' },
        { label: 'Плавність',     value: smoothness,  color: '#10b981' },
        { label: 'Симетрія',      value: symmetry,    color: '#8b5cf6' },
        { label: 'Складність',    value: complexity,  color: '#f59e0b' },
    ];

    const bars = metrics.map(m => `
        <div class="profile-metric">
            <div class="profile-metric-label">
                <span>${m.label}</span>
                <span>${(m.value * 100).toFixed(0)}%</span>
            </div>
            <div class="profile-bar-track">
                <div class="profile-bar-fill" style="width:${(m.value * 100).toFixed(0)}%; background:${m.color}"></div>
            </div>
        </div>
    `).join('');

    return `
        <div class="signal-profile-block">
            <div class="signal-type-row">
                <span class="signal-type-badge">
                    ${waveType}
                    <span class="signal-tooltip-wrap">
                        <span class="signal-tooltip-icon">ℹ</span>
                        <span class="signal-tooltip-box">${explanation}</span>
                    </span>
                </span>
                <code class="signal-formula">${formula}</code>
            </div>
            <p class="signal-description">${description}</p>
            <div class="profile-metrics">${bars}</div>
        </div>
    `;
}

function buildWaveExplanation(waveType, { harmonicity, smoothness, symmetry, complexity, zc, finite, bestError, candidates }) {
    const h   = (harmonicity * 100).toFixed(0);
    const s   = (smoothness  * 100).toFixed(0);
    const sym = (symmetry    * 100).toFixed(0);
    const c   = (complexity  * 100).toFixed(0);

    const ranking = candidates
        ? [...candidates]
            .sort((a, b) => a.err - b.err)
            .map((cand, i) => `${i === 0 ? '✓' : `${i + 1}.`} ${cand.type} — RMSE: ${cand.err.toFixed(3)}`)
            .join('<br>')
        : '';

    return `Алгоритм аналізує 4 властивості сигналу:<br><br>`
        + `🔵 Гармонічність ${h}% — перетини нуля<br>`
        + `🟢 Плавність ${s}% — різниця сусідніх значень<br>`
        + `🟣 Симетрія ${sym}% — дзеркальність початку і кінця<br>`
        + `🟡 Складність ${c}% — дисперсія + нерівномірність<br><br>`
        + `Підібрано методом найменших квадратів (RMSE):<br>`
        + `${ranking}<br><br>`
        + `Обрано: <strong>${waveType}</strong> з похибкою RMSE = ${bestError}`;
}

function calculateDerivative(xValues, yValues) {
    const derivative = [];
    for (let i = 0; i < yValues.length - 1; i++) {
        const dx = xValues[i+1] - xValues[i];
        derivative.push(dx === 0 ? 0 : (yValues[i+1] - yValues[i]) / dx);
    }
    return derivative;
}

function average(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function averageAbs(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + Math.abs(b), 0) / values.length;
}

function maxAbs(values) {
    if (!values.length) return 0;
    return Math.max(...values.map(v => Math.abs(v)));
}

function countExtrema(values) {
    let count = 0;
    for (let i = 1; i < values.length - 1; i++) {
        if ((values[i] > values[i-1] && values[i] > values[i+1]) ||
            (values[i] < values[i-1] && values[i] < values[i+1]))
            count++;
    }
    return count;
}

function countZeroCrossings(values) {
    let count = 0;
    for (let i = 1; i < values.length; i++) {
        if ((values[i-1] < 0 && values[i] >= 0) || (values[i-1] > 0 && values[i] <= 0))
            count++;
    }
    return count;
}

function buildMathInterpretation(stats) {
    const parts = [];
    if (stats.amplitude > 0.7)
        parts.push('Графік має високу амплітуду, що відповідає значним змінам гучності або енергії сигналу.');
    else if (stats.amplitude > 0.35)
        parts.push('Графік має помірну амплітуду, тобто сигнал має відносно стабільну, але помітну динаміку.');
    else
        parts.push('Графік має низьку амплітуду, що вказує на слабкі зміни сигналу.');

    if (stats.meanFirstDerivative > 1.5)
        parts.push('Велике середнє значення першої похідної означає швидкі зміни форми графіка.');
    else
        parts.push('Невелике середнє значення першої похідної означає плавну зміну графіка.');

    if (stats.meanSecondDerivative > 4)
        parts.push('Високе значення другої похідної вказує на різкі переходи та значну кривизну сигналу.');
    else
        parts.push('Невелике значення другої похідної свідчить про відносно плавну кривизну.');

    if (stats.extremaCount > 20)
        parts.push('Велика кількість екстремумів означає складну коливальну структуру.');
    else
        parts.push('Невелика кількість екстремумів свідчить про простішу форму сигналу.');

    return parts.join(' ');
}

document.addEventListener('DOMContentLoaded', initMusicToGraph);