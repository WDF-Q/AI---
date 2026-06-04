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
let currentBet = 600;

let historyTracker = {
    red: 0, pink: 0, blue: 0, green: 0, yellow: 0, white: 0, rainbow: 0
};

let isRainbowActive = false; // Next draw will draw 3 balls

const DOM = {
    board: document.getElementById('game-board'),
    credit: document.getElementById('credit-display'),
    betInput: document.getElementById('bet-input'),
    win: document.getElementById('win-display'),
    safeIndicator: document.getElementById('safe-indicator'),
    drawStatus: document.getElementById('draw-status'),
    btnStart: document.getElementById('btn-start'),
    comboOverlay: document.getElementById('combo-overlay'),
    rouletteBall: document.getElementById('roulette-ball'),
    rouletteResult: document.getElementById('roulette-result'),
    fireBox: document.getElementById('fire-box')
};

// Initialize Betting UI
document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (isPlaying) return;
        if (btn.id === 'btn-clear-bet') {
            currentBet = 600;
        } else {
            let val = parseInt(btn.dataset.val);
            currentBet += val;
            if (currentBet > 3000) currentBet = 3000;
        }
        DOM.betInput.textContent = currentBet;
        updateLadderRewards(currentBet);
    });
});

DOM.btnStart.addEventListener('click', startGame);
updateLadderRewards(currentBet);

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
    
    el.style.left = `${c * (BLOCK_SIZE + GAP)}px`;
    el.style.top = `${r * (BLOCK_SIZE + GAP)}px`;
    
    DOM.board.appendChild(el);
    return { r, c, color, isMoney, moneyValue, isFlash, el };
}

function initBoard() {
    DOM.board.innerHTML = '';
    board = [];
    
    for (let r = 0; r < ROWS; r++) {
        board.push(new Array(COLS).fill(null));
    }
    
    const initialMoneyValue = Math.floor(currentBet / 5);

    let colsPool = [0, 1, 2, 3, 4, 5];
    for (let i = colsPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colsPool[i], colsPool[j]] = [colsPool[j], colsPool[i]];
    }
    
    for (let i = 0; i < 4; i++) {
        let c = colsPool[i];
        let r = Math.floor(Math.random() * 3); 
        board[r][c] = { isMoney: true, moneyValue: initialMoneyValue, r, c };
    }

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== null && board[r][c].isMoney) {
                board[r][c] = createBlock(r, c, null, true, initialMoneyValue);
                continue;
            }
            
            let color = getRandomColor(r, c);
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

async function startGame() {
    if (credit < currentBet) {
        alert("餘額不足！");
        return;
    }

    credit -= currentBet;
    updateCreditDisplay();
    
    isPlaying = true;
    totalWin = 0;
    ballCount = 0;
    isRainbowActive = true; // IMPORTANT: Initial draw is 3 balls! We use this flag.
    historyTracker = { red: 0, pink: 0, blue: 0, green: 0, yellow: 0, white: 0, rainbow: 0 };
    updateWinDisplay();
    updateLadderActive(0);
    updateHistoryUI();
    
    DOM.btnStart.disabled = true;
    document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = true);
    
    DOM.safeIndicator.textContent = '前 3 球安全保障！';
    DOM.safeIndicator.className = 'safe-indicator';
    
    initBoard();
    
    DOM.drawStatus.textContent = '遊戲開始！';
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
    DOM.drawStatus.textContent = `準備發球...`;
    drawTimeout = setTimeout(drawBallSequence, 1000);
}

function getSmallRoulettePair() {
    let pool = [...COLORS, ...COLORS];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
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

async function spinRouletteAnimation(resultText, colorClass) {
    DOM.fireBox.classList.add('active');
    DOM.fireBox.textContent = '發球中！';
    DOM.rouletteBall.className = 'roulette-ball spinning';
    DOM.rouletteResult.textContent = '???';
    DOM.rouletteResult.style.color = '#fff';
    
    // Spin duration 1~3s
    let spinDuration = Math.floor(Math.random() * 2000) + 1000;
    await sleep(spinDuration);
    
    DOM.fireBox.classList.remove('active');
    DOM.fireBox.textContent = 'WAIT';
    DOM.rouletteBall.className = 'roulette-ball'; // stop spinning
    DOM.rouletteResult.textContent = resultText;
    
    // Map text color for visual pop
    if (colorClass === 'red') DOM.rouletteResult.style.color = '#ef4444';
    else if (colorClass === 'pink') DOM.rouletteResult.style.color = '#ec4899';
    else if (colorClass === 'blue') DOM.rouletteResult.style.color = '#3b82f6';
    else if (colorClass === 'green') DOM.rouletteResult.style.color = '#22c55e';
    else if (colorClass === 'yellow') DOM.rouletteResult.style.color = '#eab308';
    else if (colorClass === 'white') DOM.rouletteResult.style.color = '#fff';
    else DOM.rouletteResult.style.color = '#a855f7'; // SP
    
    await sleep(500); // let them read the result
}

// 抽球邏輯
async function drawBallSequence() {
    if (!isPlaying) return;
    
    let drawsCount = isRainbowActive ? 3 : 1;
    isRainbowActive = false; 
    currentCombo = 0;
    updateLadderActive(0);
    
    let isGameOver = false;
    let targetColorsToEliminate = new Set();
    
    for (let d = 0; d < drawsCount; d++) {
        ballCount++;
        
        let isSafeMode = (ballCount <= 3) || (drawsCount === 3);
        
        if (!isSafeMode) {
            DOM.safeIndicator.textContent = '危險區：抽中白球即結束！';
            DOM.safeIndicator.className = 'safe-indicator danger';
        }
        
        let drawResult = ALL_DRAW_OPTIONS[Math.floor(Math.random() * ALL_DRAW_OPTIONS.length)];
        
        if (drawResult === 'white') {
            await spinRouletteAnimation('OUT (W)', 'white');
            historyTracker.white++;
            
            if (!isSafeMode) {
                isGameOver = true;
                break; 
            } else {
                DOM.drawStatus.textContent = `安全期！抽中白球不結束。`;
            }
        } else if (drawResult === 'roulette') {
            let r = Math.random();
            if (r < 1/6) {
                await spinRouletteAnimation('🌈 彩色球', 'sp');
                historyTracker.rainbow++;
                isRainbowActive = true;
                DOM.drawStatus.textContent = `抽中彩色球！下次連發 3 顆！`;
            } else {
                let pair = getSmallRoulettePair();
                await spinRouletteAnimation(`SP (${pair[0]}+${pair[1]})`, 'sp');
                historyTracker[pair[0]]++;
                historyTracker[pair[1]]++;
                targetColorsToEliminate.add(pair[0]);
                targetColorsToEliminate.add(pair[1]);
                DOM.drawStatus.textContent = `小轉盤：同步消除雙色！`;
            }
        } else {
            let color = drawResult;
            await spinRouletteAnimation(color.toUpperCase(), color);
            historyTracker[color]++;
            targetColorsToEliminate.add(color);
            DOM.drawStatus.textContent = `抽中 ${color}！`;
        }
        
        updateHistoryUI();
        // 如果是 3 連發，中間間隔一下
        if (d < drawsCount - 1) await sleep(500);
    }
    
    if (isGameOver) {
        DOM.drawStatus.textContent = '抽中白球 (OUT)！遊戲結束。';
        endGame();
        return;
    }
    
    if (targetColorsToEliminate.size > 0) {
        DOM.drawStatus.textContent = `結算消除...`;
        await processElimination(Array.from(targetColorsToEliminate));
        await refillBoard();
    } else {
        await sleep(1000);
    }
    
    if (isPlaying) {
        scheduleNextDraw();
    }
}

async function processElimination(colors) {
    let eliminatedAny = false;
    
    for (let color of colors) {
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
                    break;
                }
            }
        }
    }
    
    if (!eliminatedAny) {
        await sleep(500);
        return;
    }
    
    await sleep(500); 
    await applyGravity();
    await checkMatchesAndChain();
}

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
        await sleep(400);
    }

    let collectedMoney = false;
    for (let c = 0; c < COLS; c++) {
        let block = board[ROWS - 1][c];
        if (block && block.isMoney) {
            totalWin += block.moneyValue;
            updateWinDisplay();
            
            block.el.style.transform = 'scale(1.5)';
            block.el.style.opacity = '0';
            setTimeout((el) => el.remove(), 300, block.el);
            board[ROWS - 1][c] = null;
            collectedMoney = true;
            
            DOM.drawStatus.textContent = `獲得獎金 +${block.moneyValue}！`;
        }
    }
    
    if (collectedMoney) {
        await sleep(500);
        await applyGravity(); 
    }
}

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
            
            for (let comp of components) {
                for (let block of comp) {
                    blocksToEliminate.add(block);
                    if (block.isFlash) {
                        flashColorsTriggered.add(block.color);
                    }
                }
            }
            
            if (flashColorsTriggered.size > 0) {
                DOM.drawStatus.textContent = `⚡ 發光球引爆！ ⚡`;
                for (let r = 0; r < ROWS; r++) {
                    for (let c = 0; c < COLS; c++) {
                        let block = board[r][c];
                        if (block !== null && !block.isMoney && flashColorsTriggered.has(block.color)) {
                            blocksToEliminate.add(block);
                        }
                    }
                }
            }
            
            for (let block of blocksToEliminate) {
                block.el.classList.add('eliminating');
                setTimeout((el) => el.remove(), 400, block.el);
                board[block.r][block.c] = null;
            }
            
            await sleep(500);
            await applyGravity();
        } else {
            hasMatches = false;
        }
    }
}

async function refillBoard() {
    let hasEmpty = false;
    let spawnRewardValue = 0;
    
    if (currentCombo >= 4) {
        let lookupChain = currentCombo >= 10 ? 10 : currentCombo;
        let mult = COMBO_MULTIPLIERS[lookupChain];
        spawnRewardValue = Math.floor(currentBet * mult);
    }

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
        await sleep(1000);
    } else {
        DOM.drawStatus.textContent = `補滿盤面...`;
    }

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

    let flashBallsCount = 0;
    if (Math.random() < 0.01) {
        flashBallsCount = Math.floor(Math.random() * 3) + 1; 
    }
    
    for (let i = 0; i < emptySpots.length; i++) {
        let {r, c} = emptySpots[i];
        
        let block;
        if (i === rewardSpotIndex) {
            block = createBlock(-1, c, null, true, spawnRewardValue);
        } else {
            let color = getRandomColor(r, c);
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
    
    await sleep(500);
    currentCombo = 0; 
    await checkMatchesAndChain();
}

function showComboOverlay(combo) {
    if (combo < 3) return;
    DOM.comboOverlay.textContent = `${combo} COMBO!`;
    DOM.comboOverlay.classList.remove('show');
    void DOM.comboOverlay.offsetWidth;
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
    document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = false);
    
    setTimeout(() => {
        alert(`遊戲結束！本次贏得 ${totalWin} 分。`);
    }, 500);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
