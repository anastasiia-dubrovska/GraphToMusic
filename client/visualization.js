function findMinMax(xValues, yValues) {
    return {
        minX: Math.min(...xValues),
        maxX: Math.max(...xValues),
        minY: Math.min(...yValues),
        maxY: Math.max(...yValues)
    };
}

function normalizeForDisplay(values) {
    const finiteValues = values.filter(v => Number.isFinite(v));

    if (!finiteValues.length) return values.map(() => 0);

    const min = Math.min(...finiteValues);
    const max = Math.max(...finiteValues);
    const span = Math.max(1e-9, max - min);

    return values.map(v => {
        if (!Number.isFinite(v)) return null;
        return -1 + 2 * ((v - min) / span);
    });
}

function renderFunctionGraph(_functionString = '', targetId = 'function-graph', xRange = [-10, 10], providedAudioData = null) {
    const localAudioData = providedAudioData || window.audioPlayer?.getCurrentAudioData?.();

    if (!localAudioData?.xValues) {
        document.querySelector('.loading')?.style && (document.querySelector('.loading').style.display = 'none');
        return;
    }

    let traces = [];

    if (localAudioData?.tracks?.length) {
        traces = localAudioData.tracks.map((track, index) => ({
            x: localAudioData.xValues,
            y: normalizeForDisplay(track.yValues),
            mode: 'lines',
            type: 'scatter',
            name: `${track.name || 'Instrument'}: ${track.functionExpression}`,
            line: {
                width: 2.5
            }
        }));
    } else {
        if (!localAudioData?.yValues) {
            document.querySelector('.loading')?.style && (document.querySelector('.loading').style.display = 'none');
            return;
        }

        traces = [{
            x: localAudioData.xValues,
            y: localAudioData.yValues,
            mode: 'lines',
            type: 'scatter',
            name: 'f(x)',
            line: { color: '#00aaff', width: 2 }
        }];
    }

    const layout = {
        title: localAudioData?.tracks?.length
            ? 'Графіки функцій інструментів'
            : 'Графік функції',
        xaxis: { title: 'x', range: xRange },
        yaxis: { title: 'f(x)', autorange: true },
        margin: { t: 50, b: 50, l: 50, r: 30 },
        shapes: [],
        legend: {
            orientation: 'h',
            y: -0.25
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: '#fbfdff'
    };

    Plotly.newPlot(targetId, traces, layout, {
        responsive: true,
        displayModeBar: false
    });

    document.querySelector('.loading')?.style && (document.querySelector('.loading').style.display = 'none');
    document.querySelector('.result-container')?.style && (document.querySelector('.result-container').style.display = 'block');
}

function drawFunctionGraph(functionString = '', xRange = [-10, 10], providedAudioData = null) {
    return renderFunctionGraph(functionString, 'function-graph', xRange, providedAudioData);
}

function renderAudioReverseGraph(analysisResult) {
    if (!analysisResult?.xValues?.length || !analysisResult?.smoothedValues?.length) return;

    const waveformTrace = {
        x: analysisResult.timeAxis,
        y: analysisResult.waveformPreview,
        mode: 'lines',
        type: 'scatter',
        name: 'Хвиля',
        line: { color: '#2563eb', width: 1.5 }
    };

    const approxTrace = {
        x: analysisResult.xValues,
        y: analysisResult.smoothedValues,
        mode: 'lines',
        type: 'scatter',
        name: 'Наближений графік',
        line: { color: '#ef4444', width: 3 }
    };

    Plotly.newPlot('music-graph', [waveformTrace, approxTrace], {
        title: 'Music → Graph',
        xaxis: { title: 'Час / нормований x' },
        yaxis: { title: 'Амплітуда' },
        margin: { t: 50, b: 50, l: 50, r: 30 },
        legend: { orientation: 'h' },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: '#fbfdff'
    }, { responsive: true, displayModeBar: false });

    const profile = analyzeSignalProfile(
    analysisResult.smoothedValues,
    analysisResult.dominantFrequency);
    const approximationHtml = buildApproximation(analysisResult, profile);

    console.log('PROFILE:', profile);

    const meta = document.getElementById('musicMathStats');
        if (meta) {

        meta.innerHTML = `
            <div class="signal-analysis-grid">

                <div class="signal-card">
                    <div class="signal-title">
                        Audio Information
                    </div>

                    <div>
                        <strong>Duration:</strong>
                        ${analysisResult.duration.toFixed(2)} s
                    </div>

                    <div>
                        <strong>Dominant frequency:</strong>
                        ${analysisResult.dominantFrequency.toFixed(1)} Hz
                    </div>

                    <div>
                        <strong>Samples:</strong>
                        ${analysisResult.smoothedValues.length}
                    </div>
                </div>

                <div class="signal-card">
                    <div class="signal-title">
                        Mathematical Signal Profile
                    </div>

                    <div class="metric-row">
                        <span>Function family</span>
                        <span>${profile.family}</span>
                    </div>

                    <div class="metric-row">
                        <span>Harmonicity</span>
                        <span>${(profile.harmonicity * 100).toFixed(0)}%</span>
                    </div>

                    <div class="metric-row">
                        <span>Smoothness</span>
                        <span>${(profile.smoothness * 100).toFixed(0)}%</span>
                    </div>

                    <div class="metric-row">
                        <span>Symmetry</span>
                        <span>${(profile.symmetry * 100).toFixed(0)}%</span>
                    </div>

                    <div class="metric-row">
                        <span>Complexity</span>
                        <span>${(profile.complexity * 100).toFixed(0)}%</span>
                    </div>

                    <div class="signal-description">
                        The analyzed audio signal behaves similarly
                        to a <strong>${profile.family}</strong>
                        mathematical structure.
                    </div>
                    
                </div>

            </div>
            ${approximationHtml}
        `;
    }
}

function createFunction(expression) {
    if (!expression || typeof expression !== 'string' || expression.trim() === '') {
        throw new Error('Порожній або некоректний вираз');
    }

    const forbiddenPatterns = [/eval\(/, /while\(/, /for\(/, /function\(/, /new\s/, /document\./];
    if (forbiddenPatterns.some(pattern => pattern.test(expression))) {
        throw new Error('Використання заборонених конструкцій у виразі');
    }

    expression = expression.replace(/\^/g, '**').replace(/[^-()\s\w.*+\/\^%&|!=<>?:,]/g, '');

    try {
        return new Function('x', `
            const sin = Math.sin;
            const cos = Math.cos;
            const tan = Math.tan;
            const asin = Math.asin;
            const acos = Math.acos;
            const atan = Math.atan;
            const sqrt = Math.sqrt;
            const abs = Math.abs;
            const log = Math.log;
            const exp = Math.exp;
            const pow = Math.pow;
            const pi = Math.PI;
            const e = Math.E;
            return ${expression};
        `);
    } catch (error) {
        throw new Error('Неправильний синтаксис функції: ' + error.message);
    }
}

function initExampleGraphs() {
    document.querySelectorAll('.example-graph').forEach((graph, index) => {
        if (!graph.id) graph.id = `example-graph-${index + 1}`;
        const func = graph.getAttribute('data-function');
        if (!func) return;

        const fn = createFunction(func);
        const xValues = Array.from({ length: 120 }, (_, i) => -5 + i * (10 / 119));
        const yValues = xValues.map(x => fn(x));

        Plotly.newPlot(graph.id, [{
            x: xValues,
            y: yValues,
            mode: 'lines',
            type: 'scatter',
            line: { color: '#4a90e2', width: 2 }
        }], {
            margin: { t: 10, l: 10, r: 10, b: 10 },
            xaxis: { visible: false },
            yaxis: { visible: false },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, { staticPlot: true, displayModeBar: false, responsive: true });
    });
}

function updateGraphCursor(playbackPosition, noteDuration, n, xMin, xMax) {
    const audioData = window.audioPlayer?.getCurrentAudioData?.();

    if (!audioData?.xValues?.length) return;

    const totalPoints = audioData.xValues.length;
    const currentIndex = Math.min(
        Math.floor(playbackPosition / noteDuration),
        Math.max(0, totalPoints - 1)
    );

    const xPosition = xMin + (currentIndex / Math.max(1, totalPoints - 1)) * (xMax - xMin);

    let allY = [];

    if (audioData.tracks?.length) {
        audioData.tracks.forEach(track => {
            allY.push(...normalizeForDisplay(track.yValues).filter(v => Number.isFinite(v)));
        });
    } else if (audioData.yValues?.length) {
        allY = audioData.yValues.filter(v => Number.isFinite(v));
    }

    if (!allY.length) allY = [-1, 1];

    Plotly.relayout('function-graph', {
        shapes: [{
            type: 'line',
            x0: xPosition,
            x1: xPosition,
            y0: Math.min(...allY),
            y1: Math.max(...allY),
            line: {
                color: 'red',
                width: 2,
                dash: 'dash'
            }
        }]
    });
}
function buildApproximation(analysisResult) {
    const values = analysisResult.smoothedValues;

    if (!values?.length) {
        return 'Не вдалося визначити';
    }

    const finite = values.filter(v => Number.isFinite(v));

    if (!finite.length) {
        return 'Некоректний сигнал';
    }

    const max = Math.max(...finite);
    const min = Math.min(...finite);
    const amplitude = ((max - min) / 2).toFixed(2);

    const dominantFreq = analysisResult.dominantFrequency || 1;

    const normalizedFreq = (dominantFreq / 120).toFixed(2);

    const mean =
        finite.reduce((a, b) => a + b, 0) / finite.length;

    const variance =
        finite.reduce((a, b) => a + (b - mean) ** 2, 0) / finite.length;

    let detectedType = 'гармонічна';

    if (variance < 0.005) {
        detectedType = 'майже стала';
    } else if (Math.abs(mean) > amplitude * 0.6) {
        detectedType = 'експоненціальна / трендова';
    }

    return `
        <div class="math-analysis-block">
            <div><strong>Тип сигналу:</strong> ${detectedType}</div>
            <div><strong>Сім'я функцій:</strong> <em>${profile?.family ?? '—'}</em></div>
            <div><strong>Апроксимація:</strong></div>
            <div class="approx-formula">
                f(x) ≈ ${amplitude}·sin(${normalizedFreq}x)
            </div>
            <div class="math-explanation">
                Сигнал апроксимовано тригонометричною функцією на основі домінантної частоти аудіоспектра.
            </div>
        </div>
    `;
}

function analyzeSignalProfile(values, dominantFrequency = 0) {

    if (!Array.isArray(values) || !values.length) {
        return {
            family: 'Unknown',
            harmonicity: 0,
            smoothness: 0,
            symmetry: 0,
            complexity: 0
        };
    }

    const finite = values.filter(v => Number.isFinite(v));

    if (!finite.length) {
        return {
            family: 'Unknown',
            harmonicity: 0,
            smoothness: 0,
            symmetry: 0,
            complexity: 0
        };
    }

    const mean =
        finite.reduce((a, b) => a + b, 0) / finite.length;

    const variance =
        finite.reduce((a, b) => a + (b - mean) ** 2, 0) / finite.length;


    let derivativeSum = 0;

    for (let i = 1; i < finite.length; i++) {
        derivativeSum += Math.abs(finite[i] - finite[i - 1]);
    }

    const smoothness =
        Math.max(
            0,
            Math.min(
                1,
                1 / (1 + derivativeSum / finite.length)
            )
        );


    let symmetryError = 0;

    for (let i = 0; i < Math.floor(finite.length / 2); i++) {
        symmetryError += Math.abs(
            finite[i] - finite[finite.length - 1 - i]
        );
    }

    symmetryError /= Math.max(1, finite.length / 2);

    const symmetry =
        Math.max(
            0,
            Math.min(
                1,
                1 - symmetryError
            )
        );


    let zeroCrossings = 0;

    for (let i = 1; i < finite.length; i++) {
        if (
            (finite[i - 1] >= 0 && finite[i] < 0) ||
            (finite[i - 1] < 0 && finite[i] >= 0)
        ) {
            zeroCrossings++;
        }
    }

    const harmonicity =
        Math.max(
            0,
            Math.min(
                1,
                zeroCrossings / Math.max(1, finite.length / 10)
            )
        );

    const complexity =
        Math.max(
            0,
            Math.min(
                1,
                variance * 2 + (1 - smoothness)
            )
        );

    let family = 'Mixed';

    if (harmonicity > 0.7 && smoothness > 0.5) {
        family = 'Trigonometric';
    }
    else if (complexity > 0.75) {
        family = 'Chaotic / Noise-like';
    }
    else if (variance < 0.02) {
        family = 'Polynomial-like';
    }
    else if (Math.abs(mean) > 0.3) {
        family = 'Exponential-like';
    }

    return {
        family,
        harmonicity,
        smoothness,
        symmetry,
        complexity,
        dominantFrequency
    };
}

window.visualization = {
    renderFunctionGraph,
    drawFunctionGraph,
    renderAudioReverseGraph,
    createFunction,
    initExampleGraphs,
    updateGraphCursor
};
