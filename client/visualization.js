// visualization.js - Provides graph visualization using Plotly.js

function renderFunctionGraph(functionString, container, xRange = [-10, 10], pointCount = 1000) {
    try {
        document.getElementById(container).innerHTML = '';

        const fn = createFunction(functionString);

        const x = [];
        const y = [];
        const graphDiv = document.getElementById(container);
        

        const step = (xRange[1] - xRange[0]) / pointCount;
        for (let i = 0; i <= pointCount; i++) {
            const xi = xRange[0] + i * step;
            let yi = fn(xi);
            if (typeof yi === 'number' && isFinite(yi)) {
                x.push(xi);
                y.push(yi);
            } else {
                x.push(xi);
                y.push(null);
            }
        }

        const trace = {
            x: x,
            y: y,
            type: 'scatter',
            mode: 'lines',
            line: { color: 'blue', width: 2 }
        };

        const layout = {
            margin: { t: 10, r: 10, b: 30, l: 30 },
            xaxis: { title: 'x', range: [-5, 5], fixedrange: true },
            yaxis: { title: 'y', range: [-1.5, 1.5], fixedrange: true },
            plot_bgcolor: '#fff',
            paper_bgcolor: '#fff',
        };

        const data = [trace];
        Plotly.newPlot(graphDiv, data, layout, { responsive: true });


        return { success: true };

    } catch (error) {
        console.error('Error rendering function graph:', error);
        document.getElementById(container).innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; flex-direction: column;">
                <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p style="color: #ff4444; margin-top: 10px;">Помилка візуалізації функції:</p>
                <p>${error.message}</p>
            </div>
        `;
        return {
            success: false,
            error: error.message
        };
    }
}


function createFunction(expression) {

    const mathFunctions = {
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
        sqrt: Math.sqrt,
        abs: Math.abs,
        log: Math.log,
        exp: Math.exp,
        pow: Math.pow,
        max: Math.max,
        min: Math.min,
        random: () => 0 
    };
    

    if (!expression || typeof expression !== 'string' || expression.trim() === '') {
        throw new Error('Порожній або некоректний вираз');
    }
    

    const forbiddenPatterns = [/eval\(/, /while\(/, /for\(/, /function\(/, /new\s/, /document\./];
    if (forbiddenPatterns.some(pattern => pattern.test(expression))) {
        throw new Error('Використання заборонених конструкцій у виразі');
    }
    

    expression = expression.replace(/\^/g, '**').replace(/[^-()\s\w.*+\/^%&|!=<>?:,]/g, '');
    

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
            try {
                return ${expression};
            } catch (e) {
                throw new Error('Помилка обчислення виразу: ' + e.message);
            }
        `);
    } catch (error) {
        throw new Error('Неправильний синтаксис функції: ' + error.message);
    }
}


function initExampleGraphs() {
    document.querySelectorAll('.example-graph').forEach((graph, index) => {
        if (!graph.id) {
            graph.id = 'example-graph-' + (index + 1);
        }
        const func = graph.getAttribute('data-function');
        renderFunctionGraph(func, graph.id, [-5, 5], 200);
    });
}


window.visualization = {
    renderFunctionGraph,
    createFunction,
    initExampleGraphs
};