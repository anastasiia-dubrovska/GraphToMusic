function findMinMax(xValues, yValues) {
    return {
        minX: Math.min(...xValues),
        maxX: Math.max(...xValues),
        minY: Math.min(...yValues),
        maxY: Math.max(...yValues)
    };
}

function renderFunctionGraph(_functionString = '', targetId = 'function-graph', xRange = [-10, 10], providedAudioData = null) {
    const localAudioData = providedAudioData || window.audioPlayer?.getCurrentAudioData?.();
    if (!localAudioData?.xValues || !localAudioData?.yValues) {
        document.querySelector('.loading')?.style && (document.querySelector('.loading').style.display = 'none');
        return;
    }

    const trace = {
        x: localAudioData.xValues,
        y: localAudioData.yValues,
        mode: 'lines',
        type: 'scatter',
        name: 'f(x)',
        line: { color: '#00aaff', width: 2 }
    };

    const layout = {
        title: 'Графік функції',
        xaxis: { title: 'x', range: xRange },
        yaxis: { title: 'f(x)', autorange: true },
        margin: { t: 50, b: 50, l: 50, r: 30 },
        shapes: [],
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: '#fbfdff'
    };

    Plotly.newPlot(targetId, [trace], layout, { responsive: true, displayModeBar: false });
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

    const meta = document.getElementById('musicGraphMeta');
    if (meta) {
        meta.innerHTML = `
            <strong>Тривалість:</strong> ${analysisResult.duration.toFixed(2)} c &nbsp;•&nbsp;
            <strong>Домінантна частота:</strong> ${analysisResult.dominantFrequency.toFixed(1)} Hz &nbsp;•&nbsp;
            <strong>Семплів для графіка:</strong> ${analysisResult.smoothedValues.length}
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
    const currentIndex = Math.min(Math.floor(playbackPosition / noteDuration), Math.max(0, n - 1));
    const xPosition = xMin + (currentIndex / Math.max(1, n - 1)) * (xMax - xMin);

    Plotly.relayout('function-graph', {
        shapes: [{
            type: 'line',
            x0: xPosition,
            x1: xPosition,
            y0: Math.min(...audioData.yValues),
            y1: Math.max(...audioData.yValues),
            line: { color: 'red', width: 2, dash: 'dash' }
        }]
    });
}

window.visualization = {
    renderFunctionGraph,
    drawFunctionGraph,
    renderAudioReverseGraph,
    createFunction,
    initExampleGraphs,
    updateGraphCursor
};
