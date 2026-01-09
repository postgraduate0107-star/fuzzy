document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dirtSlider = document.getElementById('dirt-slider');
    const greaseSlider = document.getElementById('grease-slider');
    const dirtValueSpan = document.getElementById('dirt-value');
    const greaseValueSpan = document.getElementById('grease-value');
    const outputTimeSpan = document.getElementById('output-time');

    // --- Fuzzy Logic Configuration ---

    // 1. Membership Functions (MF) points [a, b, c] for triangle shape
    const dirtMf = {
        SD: [-100, 0, 100],   // Small Dirt
        MD: [0, 100, 200],   // Medium Dirt
        LD: [100, 200, 300], // Large Dirt
    };

    const greaseMf = {
        NG: [-100, 0, 100],   // No Grease
        MG: [0, 100, 200],   // Medium Grease
        LG: [100, 200, 300], // Large Grease
    };

    const timeMf = {
        VS: [-10, 0, 10],     // Very Short
        S:  [0, 10, 25],      // Short
        M:  [10, 25, 40],     // Medium
        L:  [25, 40, 60],     // Long
        VL: [40, 60, 70],     // Very Long
    };

    // 2. Fuzzy Rules Matrix
    const rules = {
        SD: { NG: 'VS', MG: 'S',  LG: 'M' },
        MD: { NG: 'S',  MG: 'M',  LG: 'L' },
        LD: { NG: 'M',  MG: 'L',  LG: 'VL'},
    };

    // --- Utility Functions ---

    /**
     * Calculates membership degree for a triangular MF.
     * @param {number} x The input value.
     * @param {Array<number>} points The [a, b, c] points of the triangle.
     * @returns {number} Membership degree (0 to 1).
     */
    const triangleMf = (x, [a, b, c]) => {
        if (x <= a || x >= c) return 0;
        if (x > a && x <= b) return (x - a) / (b - a);
        if (x > b && x < c) return (c - x) / (c - b);
        return 0;
    };

    /**
     * Generates dataset points for a triangular MF.
     * @param {Array<number>} points The [a, b, c] points of the triangle.
     * @param {number} minX Minimum X value for the domain.
     * @param {number} maxX Maximum X value for the domain.
     * @returns {Array<{x: number, y: number}>}
     */
    const generateMfPoints = ([a, b, c], minX, maxX) => {
        // Collect all relevant x-coordinates to define the shape within the domain
        const xCoords = new Set([minX, maxX]);
        if (a >= minX && a <= maxX) xCoords.add(a);
        if (b >= minX && b <= maxX) xCoords.add(b);
        if (c >= minX && c <= maxX) xCoords.add(c);

        // Map the unique, sorted x-coordinates to their y-values
        return Array.from(xCoords)
            .map(x => ({ x: x, y: triangleMf(x, [a, b, c]) }))
            .sort((p1, p2) => p1.x - p2.x);
    };
    
    // --- Chart.js Setup ---
    const chartOptions = (title, min, max) => ({
        plugins: {
            legend: { position: 'bottom' },
            title: { display: false }
        },
        scales: {
            x: { type: 'linear', position: 'bottom', min: min, max: max, title: { display: true, text: title } },
            y: { min: 0, max: 1.1, title: { display: true, text: '隸屬度 (μ)' } }
        },
        animation: { duration: 200 },
        maintainAspectRatio: false
    });
    
    const lineColors = ['#36a2eb', '#ff6384', '#4bc0c0', '#ff9f40', '#9966ff'];

    const createMfChart = (ctx, title, mfData, domain, colors) => {
        const datasets = Object.keys(mfData).map((key, i) => ({
            label: key,
            data: generateMfPoints(mfData[key], domain[0], domain[1]),
            borderColor: colors[i % colors.length],
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0
        }));

        // Add a dataset for the vertical line marker
        datasets.push({
            label: 'Current Value',
            data: [],
            borderColor: '#ff0000',
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
        });

        return new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: chartOptions(title, domain[0], domain[1])
        });
    };

    const dirtChart = createMfChart(document.getElementById('dirt-chart').getContext('2d'), '污泥', dirtMf, [0, 200], lineColors);
    const greaseChart = createMfChart(document.getElementById('grease-chart').getContext('2d'), '油污', greaseMf, [0, 200], lineColors);
    const timeChart = createMfChart(document.getElementById('time-chart').getContext('2d'), '清洗時間 (分)', timeMf, [0, 60], lineColors);

    // Result chart is special
    const resultChart = new Chart(document.getElementById('result-chart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                {
                    label: '聚合輸出函數',
                    data: [],
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 0,
                },
                {
                    label: '重心 (COG)',
                    data: [],
                    borderColor: '#dc3545',
                    borderWidth: 3,
                    fill: false,
                    pointRadius: 0,
                    borderDash: [5, 5]
                }
            ]
        },
        options: chartOptions('清洗時間 (分)', 0, 60)
    });

    // --- Core Fuzzy Logic Execution ---
    const update = () => {
        const dirtValue = parseFloat(dirtSlider.value);
        const greaseValue = parseFloat(greaseSlider.value);

        dirtValueSpan.textContent = dirtValue.toFixed(0);
        greaseValueSpan.textContent = greaseValue.toFixed(0);

        // 1. Fuzzification
        const dirtDegrees = {
            SD: triangleMf(dirtValue, dirtMf.SD),
            MD: triangleMf(dirtValue, dirtMf.MD),
            LD: triangleMf(dirtValue, dirtMf.LD),
        };
        const greaseDegrees = {
            NG: triangleMf(greaseValue, greaseMf.NG),
            MG: triangleMf(greaseValue, greaseMf.MG),
            LG: triangleMf(greaseValue, greaseMf.LG),
        };

        // 2. Rule Evaluation (Antecedent & Implication)
        // Find the maximum activation level for each output fuzzy set
        const outputActivation = { VS: 0, S: 0, M: 0, L: 0, VL: 0 };
        for (const dirtSet in rules) {
            for (const greaseSet in rules[dirtSet]) {
                const ruleOutputSet = rules[dirtSet][greaseSet];
                const strength = Math.min(dirtDegrees[dirtSet], greaseDegrees[greaseSet]);
                if (strength > outputActivation[ruleOutputSet]) {
                    outputActivation[ruleOutputSet] = strength;
                }
            }
        }
        
        // 3. Aggregation
        const aggregatedPoints = [];
        const samples = 120; // Resolution for integration
        for (let t = 0; t <= 60; t += 60 / samples) {
            let maxDegree = 0;
            for (const timeSet in outputActivation) {
                const activationLevel = outputActivation[timeSet];
                const mfDegree = triangleMf(t, timeMf[timeSet]);
                const degree = Math.min(activationLevel, mfDegree);
                if (degree > maxDegree) {
                    maxDegree = degree;
                }
            }
            aggregatedPoints.push({ x: t, y: maxDegree });
        }

        // 4. Defuzzification (Center of Gravity)
        let numerator = 0;   // sum(t * μ(t))
        let denominator = 0; // sum(μ(t))
        aggregatedPoints.forEach(p => {
            numerator += p.x * p.y;
            denominator += p.y;
        });
        
        const cog = (denominator === 0) ? 30 : numerator / denominator;
        outputTimeSpan.textContent = cog.toFixed(2);

        // --- Update Charts ---
        dirtChart.data.datasets[3].data = [{x: dirtValue, y: 0}, {x: dirtValue, y: 1.1}];
        dirtChart.update();

        greaseChart.data.datasets[3].data = [{x: greaseValue, y: 0}, {x: greaseValue, y: 1.1}];
        greaseChart.update();
        
        timeChart.update(); // no change needed, just redraw

        resultChart.data.datasets[0].data = aggregatedPoints;
        resultChart.data.datasets[1].data = [{x: cog, y: 0}, {x: cog, y: 1.1}];
        resultChart.update();
    };

    // --- Event Listeners ---
    dirtSlider.addEventListener('input', update);
    greaseSlider.addEventListener('input', update);

    // Initial calculation
    update();
});
