const COLS = 6;
const ROWS = 8;
const BLOCK_SIZE = 60; // 60px
const GAP = 4; // 4px

const COLORS = ['red', 'pink', 'blue', 'green', 'yellow'];
const ALL_DRAW_OPTIONS = ['red', 'pink', 'blue', 'green', 'yellow', 'white', 'roulette'];

const COMBO_MULTIPLIERS = {
    4: 0.4,
    5: 0.8,
    6: 1.2,
    7: 1.6,
    8: 2.0,
    9: 5.0,
    10: 10.0
};

let board = [];
let isPlaying = false;
let currentCombo = 0;
let totalWin = 0;
let ballCount = 0;
let drawTimeout = null;
let credit = 10000;

let historyTracker = {
    red: 0, pink: 0, blue: 0, green: 0, yellow: 0, white: 0, rainbow: 0
};

let isRainbowActive = false; // Next draw will draw 3 balls

const DOM = {
    board: document.getElementById('game-board'),
    credit: document.getElementById('credit-display'),
    betInput: document.getElementById('bet-input'),
    betMinus: document.getElementById('bet-minus'),
    betPlus: document.getElementById('bet-plus'),
    win: document.getElementById('win-display'),
    ballHistory: document.getElementById('ball-history'),
    safeIndicator: document.getElementById('safe-indicator'),
    drawStatus: document.getElementById('draw-status'),
    btnStart: document.getElementById('btn-start'),
    comboOverlay: document.getElementById('combo-overlay')
};

// Initialize UI
DOM.betMinus.addEventListener('click', () => adjustBet(-10));
DOM.betPlus.addEventListener('click', () => adjustBet(10));
DOM.btnStart.addEventListener('click', startGame);
updateLadderRewards(parseInt(DOM.betInput.value));

function adjustBet(amount) {
    if (isPlaying) return;
    let currentBet = parseInt(DOM.betInput.value);
    currentBet += amount;
    if (currentBet < 10) currentBet = 10;
    if (currentBet > credit) currentBet = credit;
    DOM.betInput.value = currentBet;
    updateLadderRewards(currentBet);
}

function updateLadderRewards(bet) {
    for (let chain = 4; chain <= 10; chain++) {
        let el = document.getElementById(`reward-${chain}`);
        if (el) {
            let mult = COMBO_MULTIPLIERS[chain] || 10.0;
            el.textContent = Math.floor(bet * mult);
        }
    }
}

function updateCreditDisplay() {
    DOM.credit.textContent = credit;
}

function updateWinDisplay() {
    DOM.win.textContent = totalWin;
}

function updateHistoryUI() {
    document.getElementById('track-red').textContent = historyTracker.red;
    document.getElementById('track-pink').textContent = historyTracker.pink;
    document.getElementById('track-blue').textContent = historyTracker.blue;
    document.getElementById('track-green').textContent = historyTracker.green;
    document.getElementById('track-yellow').textContent = historyTracker.yellow;
    document.getElementById('track-white').textContent = historyTracker.white;
    document.getElementById('track-rainbow').textContent = historyTracker.rainbow;
}

function getRandomColor(r, c) {
    // 10% chance to match a neighbor's color (to prevent dead boards)
    if (r !== undefined && c !== undefined && Math.random() < 0.10) {
        let neighbors = [];
        if (r > 0 && board[r-1][c] && !board[r-1][c].isMoney) neighbors.push(board[r-1][c].color);
        if (r < ROWS-1 && board[r+1][c] && !board[r+1][c].isMoney) neighbors.push(board[r+1][c].color);
        if (c > 0 && board[r][c-1] && !board[r][c-1].isMoney) neighbors.push(board[r][c-1].color);
        if (c < COLS-1 && board[r][c+1] && !board[r][c+1].isMoney) neighbors.push(board[r][c+1].color);
        
        if (neighbors.length > 0) {
            return neighbors[Math.floor(Math.random() * neighbors.length)];
        }
    }
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// 建立方塊 DOM
function createBlock(r, c, color, isMoney = false, moneyValue = 0, isFlash = false) {
    const el = document.createElement('div');
    el.className = `block`;
    
    if (isMoney) {
        el.classList.add('money-ball');
        el.textContent = moneyValue;
    } else {
        el.classList.add(`color-${color}`);
        if (isFlash) {
            el.classList.add('flash-ball');
        }
    }
    
    // Position using absolute coordinates based on row and col
    el.style.left = `${c * (BLOCK_SIZE + GAP)}px`;
    el.style.top = `${r * (BLOCK_SIZE + GAP)}px`;
    
    DOM.board.appendChild(el);
    return { r, c, color, isMoney, moneyValue, isFlash, el };
}

// 初始化 8x6 盤面
function initBoard() {
    DOM.board.innerHTML = '';
    board = [];
    
    // Create empty board structure
    for (let r = 0; r < ROWS; r++) {
        board.push(new Array(COLS).fill(null));
    }
    
    const bet = parseInt(DOM.betInput.value);
    const initialMoneyValue = Math.floor(bet / 5);

    // Place 4 initial money balls randomly in rows 0~2 (top 3 rows, user specified 6~8層)
    let placedMoney = 0;
    while (placedMoney < 4) {
        let r = Math.floor(Math.random() * 3); // 0, 1, 2
        let c = Math.floor(Math.random() * COLS);
        if (board[r][c] === null) {
            board[r][c] = { isMoney: true, moneyValue: initialMoneyValue, r, c }; // temp object
            placedMoney++;
        }
    }

    // Fill the rest with colors, avoiding initial matches (flood-fill check is complex, we just avoid standard 3-lines for now to minimize instant matches)
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== null && board[r][c].isMoney) {
                // Instantiate the money ball
                board[r][c] = createBlock(r, c, null, true, initialMoneyValue);
                continue;
            }
            
            let color = getRandomColor(r, c);
            // Simple heuristic to avoid large clusters initially
            while (
                (c >= 2 && board[r][c-1]?.color === color && board[r][c-2]?.color === color) ||
                (r >= 2 && board[r-1][c]?.color === color && board[r-2][c]?.color === color) ||
                (r >= 1 && c >= 1 && board[r-1][c]?.color === color && board[r][c-1]?.color === color)
            ) {
                color = getRandomColor(r, c);
            }
            board[r][c] = createBlock(r, c, color, false);
        }
    }
}

// 開始遊戲
async function startGame() {
    const bet = parseInt(DOM.betInput.value);
    if (credit < bet) {
        alert("餘額不足！");
        return;
    }

    credit -= bet;
    updateCreditDisplay();
    
    isPlaying = true;
    totalWin = 0;
    ballCount = 0;
    isRainbowActive = false;
    historyTracker = { red: 0, pink: 0, blue: 0, green: 0, yellow: 0, white: 0, rainbow: 0 };
    updateWinDisplay();
    updateLadderActive(0);
    updateHistoryUI();
    
    DOM.btnStart.disabled = true;
    DOM.betMinus.disabled = true;
    DOM.betPlus.disabled = true;
    DOM.ballHistory.innerHTML = '';
    DOM.safeIndicator.textContent = '前 3 球安全保障！';
    DOM.safeIndicator.className = 'safe-indicator';
    
    initBoard();
    
    DOM.drawStatus.textContent = '準備開始...';
    await sleep(1000);
    scheduleNextDraw();
}

function updateLadderActive(combo) {
    document.querySelectorAll('.ladder-step').forEach(step => {
        step.classList.remove('active');
        if (parseInt(step.dataset.chain) === combo) {
            step.classList.add('active');
        }
    });
}

function scheduleNextDraw() {
    if (!isPlaying) return;
    
    // 隨機 1~3 秒
    const delay = Math.floor(Math.random() * 2000) + 1000;
    DOM.drawStatus.textContent = `下一球將在 ${(delay/1000).toFixed(1)} 秒後抽出...`;
    
    drawTimeout = setTimeout(drawBall, delay);
}

// 小轉盤雙色組合邏輯
function getSmallRoulettePair() {
    // 5種顏色各2個，打亂
    let pool = [...COLORS, ...COLORS];
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // 找前兩個不重複的顏色
    let color1 = pool[0];
    let color2 = null;
    for (let i = 1; i < pool.length; i++) {
        if (pool[i] !== color1) {
            color2 = pool[i];
            break;
        }
    }
    return [color1, color2];
}

// 抽球邏輯
async function drawBall() {
    if (!isPlaying) return;
    
    let drawsCount = isRainbowActive ? 3 : 1;
    isRainbowActive = false; // reset flag
    currentCombo = 0;
    updateLadderActive(0);
    
    let isGameOver = false;
    let targetColorsToEliminate = new Set();
    
    for (let d = 0; d < drawsCount; d++) {
        ballCount++;
        
        // 前 3 球安全 (白球不結束)
        let isSafeMode = (ballCount <= 3) || (drawsCount === 3); // drawsCount === 3 implies these are rainbow extra balls, which user said are safe.
        
        if (!isSafeMode) {
            DOM.safeIndicator.textContent = '危險區：抽中白球即結束！';
            DOM.safeIndicator.className = 'safe-indicator danger';
        }
        
        let drawResult = ALL_DRAW_OPTIONS[Math.floor(Math.random() * ALL_DRAW_OPTIONS.length)];
        
        const ballEl = document.createElement('div');
        ballEl.className = 'ball';
        
        if (drawResult === 'white') {
            historyTracker.white++;
            ballEl.classList.add('white-ball');
            ballEl.textContent = 'W';
            DOM.ballHistory.appendChild(ballEl);
            
            if (!isSafeMode) {
                isGameOver = true;
                break; // stop drawing more if game over
            } else {
                DOM.drawStatus.textContent = `安全期！抽中白球不結束。`;
            }
        } else if (drawResult === 'roulette') {
            // 小轉盤模式
            let r = Math.random();
            if (r < 1/6) {
                // 彩色球
                historyTracker.rainbow++;
                isRainbowActive = true;
                ballEl.classList.add('rainbow-ball');
                ballEl.textContent = '🌈';
                DOM.drawStatus.textContent = `抽中彩色球！下次發射 3 顆！`;
            } else {
                // 雙色
                let pair = getSmallRoulettePair();
                historyTracker[pair[0]]++;
                historyTracker[pair[1]]++;
                targetColorsToEliminate.add(pair[0]);
                targetColorsToEliminate.add(pair[1]);
                
                // Show a combined ball or just text
                ballEl.style.background = `linear-gradient(45deg, var(--color-${pair[0]}) 50%, var(--color-${pair[1]}) 50%)`;
                ballEl.textContent = 'SP';
                DOM.drawStatus.textContent = `小轉盤：同步消除 ${pair[0]} & ${pair[1]}！`;
            }
            DOM.ballHistory.appendChild(ballEl);
        } else {
            // 一般顏色
            let color = drawResult;
            historyTracker[color]++;
            targetColorsToEliminate.add(color);
            ballEl.classList.add(`color-${color}`);
            DOM.ballHistory.appendChild(ballEl);
            DOM.drawStatus.textContent = `抽中 ${color}！`;
        }
        
        updateHistoryUI();
        if (d < drawsCount - 1) await sleep(500); // delay between multiple balls visually
    }
    
    if (isGameOver) {
        DOM.drawStatus.textContent = '抽中白球 (OUT)！遊戲結束。';
        endGame();
        return;
    }
    
    if (targetColorsToEliminate.size > 0) {
        DOM.drawStatus.textContent = `消除底層目標色...`;
        await processElimination(Array.from(targetColorsToEliminate));
        await refillBoard();
    } else {
        // Did not target any colors (e.g. drew safe white, or rainbow flag set but no colors targeted)
        await sleep(1000);
    }
    
    if (isPlaying) {
        scheduleNextDraw();
    }
}

// 底層消除 -> 掉落 -> 連鎖 (支援多色同時)
async function processElimination(colors) {
    let eliminatedAny = false;
    
    for (let color of colors) {
        // Find the lowest standard block of that color in each column
        for (let c = 0; c < COLS; c++) {
            for (let r = ROWS - 1; r >= 0; r--) {
                let block = board[r][c];
                if (block !== null) {
                    if (!block.isMoney && block.color === color) {
                        block.el.classList.add('eliminating');
                        setTimeout((el) => el.remove(), 300, block.el);
                        board[r][c] = null;
                        eliminatedAny = true;
                    }
                    break; // only look at the lowest block exposed in this column
                }
            }
        }
    }
    
    if (!eliminatedAny) {
        await sleep(1000);
        return;
    }
    
    await sleep(1000); // Wait for eliminate animation
    await applyGravity();
    await checkMatchesAndChain();
}

// 物理掉落 & 金錢球觸底判定
async function applyGravity() {
    let moved = false;
    for (let c = 0; c < COLS; c++) {
        let emptySpots = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] === null) {
                emptySpots++;
            } else if (emptySpots > 0) {
                const block = board[r][c];
                board[r + emptySpots][c] = block;
                board[r][c] = null;
                
                block.r = r + emptySpots;
                block.el.style.top = `${block.r * (BLOCK_SIZE + GAP)}px`;
                moved = true;
            }
        }
    }
    
    if (moved) {
        await sleep(800); // Wait for drop animation
    }

    // 金錢球觸底得分判定 (Drop Zone = Row 7)
    let collectedMoney = false;
    for (let c = 0; c < COLS; c++) {
        let block = board[ROWS - 1][c];
        if (block && block.isMoney) {
            // Collect it
            totalWin += block.moneyValue;
            updateWinDisplay();
            
            // Effect
            block.el.style.transform = 'scale(1.5)';
            block.el.style.opacity = '0';
            setTimeout((el) => el.remove(), 300, block.el);
            board[ROWS - 1][c] = null;
            collectedMoney = true;
            
            DOM.drawStatus.textContent = `獲得獎金 +${block.moneyValue}！`;
        }
    }
    
    if (collectedMoney) {
        await sleep(1000);
        await applyGravity(); // Recursive gravity in case things fell above the collected money
    }
}

// 洪水填充 (Flood-fill) 找連通塊
function findConnectedComponents() {
    let visited = new Array(ROWS).fill(0).map(() => new Array(COLS).fill(false));
    let components = [];
    
    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let block = board[r][c];
            if (block !== null && !block.isMoney && !visited[r][c]) {
                let color = block.color;
                let currentComponent = [];
                let queue = [{r, c}];
                visited[r][c] = true;
                
                while(queue.length > 0) {
                    let curr = queue.shift();
                    currentComponent.push(board[curr.r][curr.c]);
                    
                    for (let i = 0; i < 4; i++) {
                        let nr = curr.r + dr[i];
                        let nc = curr.c + dc[i];
                        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                            let nextBlock = board[nr][nc];
                            if (nextBlock !== null && !nextBlock.isMoney && !visited[nr][nc] && nextBlock.color === color) {
                                visited[nr][nc] = true;
                                queue.push({r: nr, c: nc});
                            }
                        }
                    }
                }
                
                if (currentComponent.length >= 3) {
                    components.push(currentComponent);
                }
            }
        }
    }
    
    return components;
}

// 檢查連通塊連線 (包含發光球邏輯)
async function checkMatchesAndChain() {
    let hasMatches = true;
    
    while (hasMatches && isPlaying) {
        let components = findConnectedComponents();
        
        if (components.length > 0) {
            currentCombo++;
            updateLadderActive(currentCombo >= 10 ? 10 : currentCombo);
            DOM.drawStatus.textContent = `${currentCombo} 連鎖！`;
            showComboOverlay(currentCombo);
            
            let blocksToEliminate = new Set();
            let flashColorsTriggered = new Set();
            
            // Collect blocks to eliminate
            for (let comp of components) {
                for (let block of comp) {
                    blocksToEliminate.add(block);
                    if (block.isFlash) {
                        flashColorsTriggered.add(block.color);
                    }
                }
            }
            
            // If flash ball triggered, add ALL balls of that color to elimination set
            if (flashColorsTriggered.size > 0) {
                DOM.drawStatus.textContent = `⚡ 發光球引爆全盤同色！ ⚡`;
                for (let r = 0; r < ROWS; r++) {
                    for (let c = 0; c < COLS; c++) {
                        let block = board[r][c];
                        if (block !== null && !block.isMoney && flashColorsTriggered.has(block.color)) {
                            blocksToEliminate.add(block);
                        }
                    }
                }
            }
            
            // Eliminate
            for (let block of blocksToEliminate) {
                block.el.classList.add('eliminating');
                setTimeout((el) => el.remove(), 500, block.el);
                board[block.r][block.c] = null;
            }
            
            await sleep(1000);
            await applyGravity();
        } else {
            hasMatches = false;
        }
    }
}

// 回合結束後補滿盤面 (包含 1% 發光球生成機率)
async function refillBoard() {
    let hasEmpty = false;
    let bet = parseInt(DOM.betInput.value);
    
    // Check if we need to spawn a reward money ball for the previous combo chain
    let spawnRewardValue = 0;
    if (currentCombo >= 4) {
        let lookupChain = currentCombo >= 10 ? 10 : currentCombo;
        let mult = COMBO_MULTIPLIERS[lookupChain];
        spawnRewardValue = Math.floor(bet * mult);
    }

    // Determine target spots
    let emptySpots = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === null) {
                emptySpots.push({r, c});
                hasEmpty = true;
            }
        }
    }
    
    if (!hasEmpty) return;
    
    if (spawnRewardValue > 0) {
        DOM.drawStatus.textContent = `⭐ 生成 ${currentCombo} 連鎖獎金球！`;
        await sleep(1500);
    } else {
        DOM.drawStatus.textContent = `補滿盤面...`;
    }

    // Choose one random spot in upper half (r: 0~3) for the money ball if needed
    let rewardSpotIndex = -1;
    if (spawnRewardValue > 0) {
        let upperSpots = emptySpots.filter(spot => spot.r >= 0 && spot.r <= 3);
        if (upperSpots.length > 0) {
            let choice = upperSpots[Math.floor(Math.random() * upperSpots.length)];
            rewardSpotIndex = emptySpots.findIndex(s => s.r === choice.r && s.c === choice.c);
        } else {
            rewardSpotIndex = Math.floor(Math.random() * emptySpots.length);
        }
    }

    // 決定這次補球是否帶有發光球 (1% 機率出現 1~3 顆)
    let flashBallsCount = 0;
    if (Math.random() < 0.01) {
        flashBallsCount = Math.floor(Math.random() * 3) + 1; // 1 to 3
    }
    
    // Create new blocks above the board and drop them in
    for (let i = 0; i < emptySpots.length; i++) {
        let {r, c} = emptySpots[i];
        
        let block;
        if (i === rewardSpotIndex) {
            block = createBlock(-1, c, null, true, spawnRewardValue);
        } else {
            let color = getRandomColor(r, c); // use r,c for neighbor matching
            let isFlash = false;
            if (flashBallsCount > 0) {
                isFlash = true;
                flashBallsCount--;
            }
            block = createBlock(-1, c, color, false, 0, isFlash);
        }
        
        block.r = r;
        setTimeout(() => {
            block.el.style.top = `${r * (BLOCK_SIZE + GAP)}px`;
        }, 50);
        
        board[r][c] = block;
    }
    
    await sleep(1000); // wait for refill drop
    
    // After refill, check if new matches formed (bonus matching, resets combo counter to 0)
    currentCombo = 0; // These don't count towards combo ladder for money balls!
    await checkMatchesAndChain();
}

function showComboOverlay(combo) {
    if (combo < 3) return; // 只顯示 3 以上
    DOM.comboOverlay.textContent = `${combo} COMBO!`;
    DOM.comboOverlay.classList.remove('show');
    void DOM.comboOverlay.offsetWidth; // trigger reflow
    DOM.comboOverlay.classList.add('show');
    
    setTimeout(() => {
        DOM.comboOverlay.classList.remove('show');
    }, 1000);
}

function endGame() {
    isPlaying = false;
    credit += totalWin;
    updateCreditDisplay();
    
    DOM.btnStart.disabled = false;
    DOM.betMinus.disabled = false;
    DOM.betPlus.disabled = false;
    
    setTimeout(() => {
        alert(`遊戲結束！本次贏得 ${totalWin} 分。`);
    }, 500);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
