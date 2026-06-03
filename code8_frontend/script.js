const API_BASE_URL = 'http://127.0.0.1:5000'; // 將來可以換成您的 Render 網址 (如 https://my-code8.onrender.com)

document.addEventListener('DOMContentLoaded', () => {
    const inputsContainer = document.getElementById('inputs-container');
    const refreshBtn = document.getElementById('refresh-btn');
    const resultsContainer = document.getElementById('results-container');
    const radioInputs = document.querySelectorAll('input[name="data-mode"]');
    const monthSelector = document.getElementById('month-selector');
    const monthInput = document.getElementById('month-input');

    // Chart elements
    const controlPanel = document.querySelector('.control-panel');
    const chartView = document.getElementById('chart-view');
    const backToTableBtn = document.getElementById('back-to-table-btn');
    const chartTitle = document.getElementById('chart-title');
    const chartPriceInfo = document.getElementById('chart-current-price');
    const rangeBtns = document.querySelectorAll('.range-btn');
    const ctx = document.getElementById('stockChart').getContext('2d');
    
    let currentChart = null;
    let currentChartSymbol = '';

    // Generate 3 input fields (changed from 4)
    for (let i = 0; i < 3; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input-field';
        input.placeholder = `股票代號/公司行號`;
        input.dataset.index = i;
        inputsContainer.appendChild(input);
    }

    // Set max month to current month, min to 5 years ago
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const fiveYearsAgoStr = `${today.getFullYear() - 5}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    monthInput.max = currentMonthStr;
    monthInput.min = fiveYearsAgoStr;
    monthInput.value = currentMonthStr;

    // Toggle month selector
    radioInputs.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'specific_month') {
                monthSelector.style.display = 'block';
            } else {
                monthSelector.style.display = 'none';
            }
        });
    });

    const getPriceClass = (current, prev) => {
        if (!current || !prev) return 'price-neutral';
        if (current > prev) return 'price-up';
        if (current < prev) return 'price-down';
        return 'price-neutral';
    };

    const openChartView = async (symbol) => {
        currentChartSymbol = symbol;
        controlPanel.style.display = 'none';
        resultsContainer.style.display = 'none';
        chartView.style.display = 'flex';
        
        // Reset active range button to 1M by default
        rangeBtns.forEach(b => b.classList.remove('active'));
        document.querySelector('.range-btn[data-range="1M"]').classList.add('active');
        
        await loadChartData(symbol, '1M');
    };

    const closeChartView = () => {
        chartView.style.display = 'none';
        controlPanel.style.display = 'flex';
        resultsContainer.style.display = 'flex';
        currentChartSymbol = '';
    };

    backToTableBtn.addEventListener('click', closeChartView);

    rangeBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(!currentChartSymbol) return;
            rangeBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const range = e.target.dataset.range;
            await loadChartData(currentChartSymbol, range);
        });
    });

    const loadChartData = async (symbol, range) => {
        chartTitle.textContent = "載入中...";
        chartPriceInfo.textContent = "--";
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/chart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, range })
            });
            const data = await response.json();
            
            if(data.error) {
                alert("無法取得該區間圖表資料");
                return;
            }
            
            chartTitle.textContent = data.display_title;
            const prices = data.prices;
            if(prices.length > 0) {
                const latest = prices[prices.length - 1];
                const first = prices[0];
                const diff = latest - first;
                const percent = (diff / first) * 100;
                
                const sign = diff >= 0 ? '+' : '';
                const colorClass = diff >= 0 ? 'price-up' : 'price-down';
                
                chartPriceInfo.innerHTML = `
                    <span class="${colorClass}">${latest.toFixed(2)}</span>
                    <span style="font-size: 1rem; margin-left: 10px;" class="${colorClass}">
                        ${sign}${diff.toFixed(2)} (${sign}${percent.toFixed(2)}%)
                    </span>
                `;
            }

            renderChart(data.labels, data.prices, data.range);
            
        } catch (error) {
            console.error(error);
            alert('抓取圖表資料失敗');
        }
    };

    const renderChart = (labels, dataPoints, range) => {
        if(currentChart) {
            currentChart.destroy();
        }

        // Create gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(255, 141, 161, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 141, 161, 0.0)');

        // Determine point size based on data points
        const pointRadius = dataPoints.length > 100 ? 0 : (dataPoints.length > 30 ? 1 : 3);

        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '收盤價',
                    data: dataPoints,
                    borderColor: '#ff8da1',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.2,
                    pointRadius: pointRadius,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#ff8da1',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#334155',
                        bodyColor: '#334155',
                        borderColor: '#fbcfe8',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxTicksLimit: 8,
                            color: '#94a3b8',
                            font: { family: 'Quicksand' }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(241, 245, 249, 0.5)',
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: 'Quicksand' }
                        }
                    }
                }
            }
        });
    };

    const renderUnifiedTable = (results) => {
        resultsContainer.innerHTML = ''; 

        const validStocks = results.filter(s => !s.error && s.data && s.data.length > 0);

        if (validStocks.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state glass-panel">
                    <div class="empty-icon">🎀</div>
                    <p>沒有查詢到任何有效資料，請檢查代號或名稱是否正確喔</p>
                </div>
            `;
            return;
        }

        const dateSet = new Set();
        validStocks.forEach(stock => stock.data.forEach(row => dateSet.add(row.date)));
        const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

        const lookup = {};
        validStocks.forEach(stock => {
            lookup[stock.symbol] = {};
            stock.data.forEach(row => { lookup[stock.symbol][row.date] = row; });
        });

        const container = document.createElement('div');
        container.className = 'unified-table-container';

        let theadHtml = `
            <thead>
                <tr>
                    <th rowspan="2" class="date-column">日期</th>
        `;

        validStocks.forEach(stock => {
            theadHtml += `<th colspan="5" class="stock-header-cell" data-symbol="${stock.symbol}">${stock.display_title} <br><span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(點擊看圖表)</span></th>`;
        });

        theadHtml += `</tr><tr>`;

        validStocks.forEach((stock, index) => {
            const isLast = index === validStocks.length - 1;
            const borderClass = isLast ? '' : 'border-right';
            theadHtml += `
                <th class="metric-header">昨收</th>
                <th class="metric-header">開盤</th>
                <th class="metric-header">最高</th>
                <th class="metric-header">最低</th>
                <th class="metric-header ${borderClass}">收盤</th>
            `;
        });

        theadHtml += `</tr></thead>`;

        let tbodyHtml = `<tbody>`;
        
        sortedDates.forEach(date => {
            const shortDate = date.substring(5);
            tbodyHtml += `<tr><td class="date-column">${shortDate}</td>`;

            validStocks.forEach((stock, index) => {
                const isLast = index === validStocks.length - 1;
                const borderClass = isLast ? '' : 'border-right';
                const rowData = lookup[stock.symbol][date];
                
                if (rowData) {
                    const openClass = getPriceClass(rowData.open, rowData.prev_close);
                    const highClass = getPriceClass(rowData.high, rowData.prev_close);
                    const lowClass = getPriceClass(rowData.low, rowData.prev_close);
                    const closeClass = getPriceClass(rowData.close, rowData.prev_close);

                    tbodyHtml += `
                        <td>${rowData.prev_close.toFixed(2)}</td>
                        <td class="${openClass}">${rowData.open.toFixed(2)}</td>
                        <td class="${highClass}">${rowData.high.toFixed(2)}</td>
                        <td class="${lowClass}">${rowData.low.toFixed(2)}</td>
                        <td class="${closeClass} ${borderClass}">${rowData.close.toFixed(2)}</td>
                    `;
                } else {
                    tbodyHtml += `<td>-</td><td>-</td><td>-</td><td>-</td><td class="${borderClass}">-</td>`;
                }
            });

            tbodyHtml += `</tr>`;
        });

        tbodyHtml += `</tbody>`;

        const tableHtml = `<table>${theadHtml}${tbodyHtml}</table>`;
        container.innerHTML = tableHtml;
        resultsContainer.appendChild(container);
        
        // Add click events to headers
        const headers = container.querySelectorAll('.stock-header-cell');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const symbol = header.dataset.symbol;
                openChartView(symbol);
            });
        });
        
        const failedStocks = results.filter(s => s.error || !s.data || s.data.length === 0);
        if (failedStocks.length > 0) {
            const errorMsg = document.createElement('div');
            errorMsg.style.color = 'var(--danger)';
            errorMsg.style.textAlign = 'center';
            errorMsg.style.marginTop = '1rem';
            errorMsg.style.fontWeight = 'bold';
            const names = failedStocks.map(s => s.display_title || s.symbol).join(', ');
            errorMsg.textContent = `以下查詢無法取得資料：${names}`;
            resultsContainer.appendChild(errorMsg);
        }
    };

    const fetchData = async () => {
        const inputs = Array.from(document.querySelectorAll('.input-field'));
        const symbols = inputs.map(input => input.value).filter(val => val.trim() !== '');
        
        if (symbols.length === 0) {
            alert('請至少輸入一個股票代號或名稱');
            return;
        }

        const mode = document.querySelector('input[name="data-mode"]:checked').value;
        const month = monthInput.value;

        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
        refreshBtn.querySelector('span').textContent = '魔法詠唱中...';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/stocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols, mode, month })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            renderUnifiedTable(data.results);
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('抓取資料失敗，請稍後再試');
        } finally {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
            refreshBtn.querySelector('span').textContent = '施展魔法更新資料 ✨';
        }
    };

    refreshBtn.addEventListener('click', fetchData);

    inputsContainer.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchData();
    });

    // --- Favorites Logic ---
    const favoritesDropdown = document.getElementById('favorites-dropdown');
    const saveFavBtn = document.getElementById('save-favorite-btn');
    const deleteFavBtn = document.getElementById('delete-favorite-btn');
    const recentFavContainer = document.getElementById('recent-favorites-container');

    const updateRecentFavorites = (name) => {
        let recents = JSON.parse(localStorage.getItem('recentFavorites') || '[]');
        recents = recents.filter(r => r !== name);
        recents.unshift(name);
        if (recents.length > 10) recents = recents.slice(0, 10);
        localStorage.setItem('recentFavorites', JSON.stringify(recents));
        renderRecentFavorites();
    };

    const renderRecentFavorites = () => {
        const recents = JSON.parse(localStorage.getItem('recentFavorites') || '[]');
        const saved = JSON.parse(localStorage.getItem('stockFavorites') || '{}');
        
        const validRecents = recents.filter(r => saved.hasOwnProperty(r));
        if (validRecents.length !== recents.length) {
            localStorage.setItem('recentFavorites', JSON.stringify(validRecents));
        }

        recentFavContainer.innerHTML = '';
        validRecents.forEach(name => {
            const pill = document.createElement('button');
            pill.className = 'recent-fav-pill';
            pill.textContent = name;
            pill.title = name;
            pill.addEventListener('click', () => {
                favoritesDropdown.value = name;
                favoritesDropdown.dispatchEvent(new Event('change'));
            });
            recentFavContainer.appendChild(pill);
        });
    };

    const loadFavorites = () => {
        const saved = JSON.parse(localStorage.getItem('stockFavorites') || '{}');
        while (favoritesDropdown.options.length > 1) {
            favoritesDropdown.remove(1);
        }
        for (const [name, symbols] of Object.entries(saved)) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            favoritesDropdown.appendChild(option);
        }
        renderRecentFavorites();
    };

    saveFavBtn.addEventListener('click', () => {
        const inputs = Array.from(document.querySelectorAll('#inputs-container .input-field')).slice(0, 3);
        const symbols = inputs.map(input => input.value).filter(val => val.trim() !== '');
        if (symbols.length === 0) {
            alert('請至少輸入一個代號後再儲存！');
            return;
        }
        
        const name = prompt('請為這個最愛清單命名（例如：我的科技股）:');
        if (!name || name.trim() === '') return;
        
        const saved = JSON.parse(localStorage.getItem('stockFavorites') || '{}');
        saved[name.trim()] = symbols;
        localStorage.setItem('stockFavorites', JSON.stringify(saved));
        
        loadFavorites();
        favoritesDropdown.value = name.trim();
        deleteFavBtn.style.display = 'inline-block';
        updateRecentFavorites(name.trim());
        alert('儲存成功！');
    });

    favoritesDropdown.addEventListener('change', (e) => {
        const name = e.target.value;
        if (!name) {
            deleteFavBtn.style.display = 'none';
            return;
        }
        deleteFavBtn.style.display = 'inline-block';
        
        const saved = JSON.parse(localStorage.getItem('stockFavorites') || '{}');
        const symbols = saved[name];
        if (symbols) {
            const inputs = Array.from(document.querySelectorAll('#inputs-container .input-field')).slice(0, 3);
            inputs.forEach(input => input.value = ''); // Clear current
            symbols.forEach((sym, idx) => {
                if (idx < inputs.length) {
                    inputs[idx].value = sym;
                }
            });
            updateRecentFavorites(name);
            fetchData(); // Auto search
        }
    });

    deleteFavBtn.addEventListener('click', () => {
        const name = favoritesDropdown.value;
        if (!name) return;
        if (confirm(`確定要刪除「${name}」嗎？`)) {
            const saved = JSON.parse(localStorage.getItem('stockFavorites') || '{}');
            delete saved[name];
            localStorage.setItem('stockFavorites', JSON.stringify(saved));
            loadFavorites();
            favoritesDropdown.value = '';
            deleteFavBtn.style.display = 'none';
        }
    });

    loadFavorites();

});
