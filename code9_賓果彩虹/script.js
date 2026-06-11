const COLS = 6;
const ROWS = 8;
const BLOCK_SIZE = 60; 
const GAP = 4; 

const COLORS = ['red', 'pink', 'blue', 'green', 'yellow'];
// 6 base options * 3 = 18 slots, plus 3 SP slots = 21 slots.
const OUTER_WHEEL_SLOTS = [
    'red', 'pink', 'blue', 'green', 'yellow', 'white', 'sp',
    'red', 'pink', 'blue', 'green', 'yellow', 'white', 'sp',
    'red', 'pink', 'blue', 'green', 'yellow', 'white', 'sp'
];

const CSS_VAR_MAP = {
    'red': 'var(--color-red)',
    'pink': 'var(--color-pink)',
    'blue': 'var(--color-blue)',
    'green': 'var(--color-green)',
    'yellow': 'var(--color-yellow)',
    'white': '#ffffff',
    'sp': 'var(--color-sp)' // Inner track hole (dark)
};

const COMBO_MULTIPLIERS = {
    4: 0.4, 5: 0.8, 6: 1.2, 7: 1.6, 8: 2.0, 9: 5.0, 10: 10.0
};

let board = [];
let isPlaying = false;
let currentCombo = 0;
let totalWin = 0;
let ballCount = 0;
let credit = 10000;
let currentBet = 600;

let historyTracker = {
    red: 0, pink: 0, blue: 0, green: 0, yellow: 0, white: 0, rainbow: 0
};

// ** Decoupled Engine States **
let leftEngineActive = false;
let boardState = 'IDLE'; // 'IDLE' or 'BUSY'
let pendingColorsQueue = []; 
let isGameOverTriggered = false; 
let pendingInitialBatch = 0; 
let pendingDrawsQueue = 0;

// Roulette animation tracking
let outerWheelRotation = 0;
let innerWheelRotation = 0;

const DOM = {
    board: document.getElementById('game-board'),
    credit: document.getElementById('credit-display'),
    betInput: document.getElementById('bet-input'),
    win: document.getElementById('win-display'),
    safeIndicator: document.getElementById('safe-indicator'),
    drawStatus: document.getElementById('draw-status'),
    btnStart: document.getElementById('btn-start'),
    comboOverlay: document.getElementById('combo-overlay'),
    outOverlay: document.getElementById('out-overlay'),
    
    // Roulette Elements
    rouletteOuter: document.getElementById('roulette-wheel-outer'),
    rouletteInner: document.getElementById('roulette-wheel-inner'),
    rouletteBallOrbit: document.getElementById('roulette-ball-orbit'),
    rouletteBall: document.getElementById('roulette-ball'),
    rouletteResultText: document.getElementById('roulette-result-text'),
    
    fireBox: document.getElementById('fire-box'),
    ballHistory: document.getElementById('ball-history')
};

// Initialize Outer Wheel Gradient
function initRouletteVisuals() {
    let gradientStops = [];
    let anglePerSlot = 360 / 21;
    for (let i = 0; i < 21; i++) {
        let color = CSS_VAR_MAP[OUTER_WHEEL_SLOTS[i]];
        let startAngle = i * anglePerSlot;
        let endAngle = (i + 1) * anglePerSlot;
        gradientStops.push(`${color} ${startAngle}deg ${endAngle}deg`);
    }
    DOM.rouletteOuter.style.background = `conic-gradient(${gradientStops.join(', ')})`;
    
    // Start continuous slow rotations via JS `requestAnimationFrame` for accurate tracking
    startWheelRotations();
}

function startWheelRotations() {
    function animate() {
        outerWheelRotation = (outerWheelRotation + 0.5) % 360; // slow outer
        innerWheelRotation = (innerWheelRotation + 1.5) % 360; // fast inner
        DOM.rouletteOuter.style.transform = `rotate(${outerWheelRotation}deg)`;
        DOM.rouletteInner.style.transform = `rotate(${innerWheelRotation}deg)`;
        requestAnimationFrame(animate);
    }
    animate();
}

initRouletteVisuals();

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
        if (el) el.textContent = Math.floor(bet * COMBO_MULTIPLIERS[chain]);
    }
}

function updateCreditDisplay() { DOM.credit.textContent = credit; }
function updateWinDisplay() { DOM.win.textContent = totalWin; }

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
        if (neighbors.length > 0) return neighbors[Math.floor(Math.random() * neighbors.length)];
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
        if (isFlash) el.classList.add('flash-ball');
    }
    el.style.left = `${c * (BLOCK_SIZE + GAP)}px`;
    el.style.top = `${r * (BLOCK_SIZE + GAP)}px`;
    DOM.board.appendChild(el);
    return { r, c, color, isMoney, moneyValue, isFlash, el };
}

function initBoard() {
    DOM.board.innerHTML = '';
    board = [];
    for (let r = 0; r < ROWS; r++) board.push(new Array(COLS).fill(null));
    
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
    isGameOverTriggered = false;
    pendingColorsQueue = [];
    boardState = 'IDLE';
    
    historyTracker = { red: 0, pink: 0, blue: 0, green: 0, yellow: 0, white: 0, rainbow: 0 };
    updateWinDisplay();
    updateLadderActive(0);
    updateHistoryUI();
    
    DOM.btnStart.disabled = true;
    document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = true);
    DOM.ballHistory.innerHTML = '';
    DOM.outOverlay.classList.remove('show');
    
    DOM.safeIndicator.textContent = '前 3 球安全保障！';
    DOM.safeIndicator.className = 'safe-indicator';
    
    initBoard();
    
    pendingDrawsQueue = 3;
    pendingInitialBatch = 3;
    
    DOM.drawStatus.textContent = '遊戲開始！';
    await sleep(1000);
    
    startLeftEngine();
    startRightEngine();
}

function updateLadderActive(combo) {
    document.querySelectorAll('.ladder-step').forEach(step => {
        step.classList.remove('active');
        if (parseInt(step.dataset.chain) === combo) step.classList.add('active');
    });
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
        if (pool[i] !== color1) { color2 = pool[i]; break; }
    }
    return [color1, color2];
}

function addBallToHistoryUI(typeText, colorClass, gradient = null) {
    const ballEl = document.createElement('div');
    ballEl.className = 'ball';
    ballEl.textContent = typeText;
    
    if (gradient) {
        ballEl.style.background = gradient;
    } else if (colorClass === 'white') {
        ballEl.classList.add('white-ball');
    } else if (colorClass === 'rainbow') {
        ballEl.classList.add('rainbow-ball');
    } else {
        ballEl.classList.add(`color-${colorClass}`);
    }
    
    DOM.ballHistory.appendChild(ballEl);
    DOM.ballHistory.scrollLeft = DOM.ballHistory.scrollWidth;
}

function updateResultText(resultText, colorClass) {
    DOM.rouletteResultText.textContent = resultText;
    if (colorClass === 'red') DOM.rouletteResultText.style.color = '#ef4444';
    else if (colorClass === 'pink') DOM.rouletteResultText.style.color = '#ec4899';
    else if (colorClass === 'blue') DOM.rouletteResultText.style.color = '#3b82f6';
    else if (colorClass === 'green') DOM.rouletteResultText.style.color = '#22c55e';
    else if (colorClass === 'yellow') DOM.rouletteResultText.style.color = '#eab308';
    else if (colorClass === 'white') DOM.rouletteResultText.style.color = '#fff';
    else DOM.rouletteResultText.style.color = '#a855f7'; // SP
}

// 物理感落球動畫 (Concentric Roulette)
async function spinVegasRoulette(targetMain, isInner = false, innerTargetText = null, innerTargetColor = null) {
    DOM.fireBox.classList.add('active');
    DOM.fireBox.textContent = '發球！';
    DOM.rouletteResultText.textContent = '???';
    DOM.rouletteResultText.style.color = '#fff';
    
    // Reset ball orbit
    DOM.rouletteBallOrbit.style.transition = 'none';
    DOM.rouletteBallOrbit.style.transform = `rotate(0deg)`;
    DOM.rouletteBall.classList.remove('dive-inner');
    void DOM.rouletteBallOrbit.offsetWidth; // force reflow
    
    DOM.rouletteBall.classList.add('visible');
    
    // Spin randomly for a bit (Fast counter-clockwise)
    let orbitStartRotation = 0;
    let baseSpins = 3 * 360; 
    
    // Find target slot angle on outer wheel
    let possibleIndices = [];
    for (let i = 0; i < OUTER_WHEEL_SLOTS.length; i++) {
        if (OUTER_WHEEL_SLOTS[i] === targetMain) possibleIndices.push(i);
    }
    let targetIndex = possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
    let anglePerSlot = 360 / 21;
    // The exact angle on the wheel where the slot is
    let slotCenterWheelAngle = (targetIndex * anglePerSlot) + (anglePerSlot / 2);
    
    // Animation Phase 1: Spin
    DOM.rouletteBallOrbit.style.transition = 'transform 2s cubic-bezier(0.25, 1, 0.5, 1)'; // decelerate
    // To land in the slot, the ball's absolute angle must match the outer wheel's absolute angle at the time of landing.
    // Since the wheel is constantly rotating, we predict its angle 2 seconds from now.
    let predictedWheelRotation = (outerWheelRotation + (0.5 * 120)) % 360; // 60fps * 2s = 120 frames
    let finalBallAngle = predictedWheelRotation + slotCenterWheelAngle - 90; // offset top
    
    DOM.rouletteBallOrbit.style.transform = `rotate(-${baseSpins - finalBallAngle}deg)`;
    await sleep(2000);
    
    if (!isInner) {
        // Normal land
        DOM.fireBox.classList.remove('active');
        DOM.fireBox.textContent = 'WAIT';
        DOM.rouletteBall.classList.remove('visible');
        updateResultText(targetMain.toUpperCase(), targetMain);
        await sleep(500);
    } else {
        // DIVE INTO INNER WHEEL!
        DOM.rouletteResultText.textContent = '進入內圈小轉盤！';
        DOM.rouletteResultText.style.color = '#a855f7';
        DOM.rouletteBall.classList.add('dive-inner');
        
        await sleep(800); // Wait for dive animation
        
        DOM.fireBox.classList.remove('active');
        DOM.fireBox.textContent = 'WAIT';
        DOM.rouletteBall.classList.remove('visible'); // Ball disappears into the center
        updateResultText(innerTargetText, innerTargetColor);
        await sleep(800);
    }
}

/* ========================================================
   LEFT ENGINE: Roulette & Firing
======================================================== */
async function startLeftEngine() {
    leftEngineActive = true;
    
    while (leftEngineActive && !isGameOverTriggered) {
        if (pendingDrawsQueue === 0) pendingDrawsQueue = 1;
        
        while (pendingDrawsQueue > 0 && !isGameOverTriggered) {
            let randomInterval = Math.floor(Math.random() * 1000) + 500; 
            await sleep(randomInterval);
            
            ballCount++;
            let isSafeMode = (ballCount <= 3) || (pendingInitialBatch > 0 && pendingDrawsQueue > 0); 
            
            if (!isSafeMode) {
                DOM.safeIndicator.textContent = '危險區：抽中白球即結束！';
                DOM.safeIndicator.className = 'safe-indicator danger';
            }
            
            let baseDraw = ALL_DRAW_OPTIONS[Math.floor(Math.random() * ALL_DRAW_OPTIONS.length)];
            
            if (baseDraw === 'white') {
                await spinVegasRoulette('white', false);
                historyTracker.white++;
                addBallToHistoryUI('W', 'white');
                
                if (!isSafeMode) {
                    isGameOverTriggered = true;
                    pendingColorsQueue.push('OUT');
                    DOM.drawStatus.textContent = '抽中 OUT！等待盤面結算...';
                    break; 
                } else {
                    DOM.drawStatus.textContent = `安全期！抽中白球不結束。`;
                }
            } else if (baseDraw === 'roulette') {
                // SP Logic
                let r = Math.random();
                if (r < 1/6) {
                    await spinVegasRoulette('sp', true, '🌈 彩色球', 'sp');
                    historyTracker.rainbow++;
                    addBallToHistoryUI('🌈', 'rainbow');
                    pendingDrawsQueue += 3;
                    pendingInitialBatch = 3; 
                    DOM.drawStatus.textContent = `彩色球！獲得 3 連發！`;
                } else {
                    let pair = getSmallRoulettePair();
                    await spinVegasRoulette('sp', true, `SP ${pair[0]}+${pair[1]}`, 'sp');
                    historyTracker[pair[0]]++;
                    historyTracker[pair[1]]++;
                    let gradient = `linear-gradient(45deg, var(--color-${pair[0]}) 50%, var(--color-${pair[1]}) 50%)`;
                    addBallToHistoryUI('SP', null, gradient);
                    
                    pendingColorsQueue.push(pair);
                    DOM.drawStatus.textContent = `小轉盤：同步消除雙色！`;
                }
            } else {
                let color = baseDraw;
                await spinVegasRoulette(color, false);
                historyTracker[color]++;
                addBallToHistoryUI(color.toUpperCase(), color);
                
                pendingColorsQueue.push(color);
                DOM.drawStatus.textContent = `抽中 ${color}！`;
            }
            
            updateHistoryUI();
            pendingDrawsQueue--;
            if (pendingInitialBatch > 0) pendingInitialBatch--;
        }
    }
    leftEngineActive = false;
}

/* ========================================================
   RIGHT ENGINE: Match-3 & Gravity
======================================================== */
async function startRightEngine() {
    while (isPlaying) {
        if (boardState === 'IDLE' && pendingInitialBatch === 0 && pendingColorsQueue.length > 0) {
            boardState = 'BUSY';
            
            let itemsToProcess = [...pendingColorsQueue];
            pendingColorsQueue = [];
            
            if (itemsToProcess.includes('OUT')) {
                await finishGameOverSequence();
                break;
            } else {
                let colorsToEliminate = new Set();
                for (let item of itemsToProcess) {
                    if (Array.isArray(item)) {
                        colorsToEliminate.add(item[0]);
                        colorsToEliminate.add(item[1]);
                    } else if (item !== 'OUT') {
                        colorsToEliminate.add(item);
                    }
                }
                
                if (colorsToEliminate.size > 0) {
                    currentCombo = 0;
                    updateLadderActive(0);
                    await processElimination(Array.from(colorsToEliminate));
                    await refillBoard();
                }
            }
            boardState = 'IDLE';
        }
        await sleep(100);
    }
}

async function processElimination(colors) {
    let eliminatedAny = false;
    for (let color of colors) {
        for (let c = 0; c < COLS; c++) {
            for (let r = ROWS - 1; r >= 0; r--) {
                let block = board[r][c];
                if (block !== null && !block.isMoney && block.color === color) {
                    block.el.classList.add('eliminating');
                    setTimeout((el) => el.remove(), 400, block.el);
                    board[r][c] = null;
                    eliminatedAny = true;
                    break; // Only bottom-most valid block of this color per column
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
    if (moved) await sleep(400);

    let moneyCollectedCount = 0;
    for (let c = 0; c < COLS; c++) {
        let block = board[ROWS - 1][c];
        if (block && block.isMoney) {
            totalWin += block.moneyValue;
            updateWinDisplay();
            block.el.style.transform = 'scale(1.5)';
            block.el.style.opacity = '0';
            setTimeout((el) => el.remove(), 300, block.el);
            board[ROWS - 1][c] = null;
            moneyCollectedCount++;
            DOM.drawStatus.textContent = `獲得獎金 +${block.moneyValue}！`;
        }
    }
    
    if (moneyCollectedCount > 0) {
        await sleep(500);
        // User Request: 金錢球如果在最下方被消除，也必須被列入一次的消，累計計算！
        for (let i = 0; i < moneyCollectedCount; i++) {
            currentCombo++;
        }
        updateLadderActive(currentCombo >= 10 ? 10 : currentCombo);
        DOM.drawStatus.textContent = `${currentCombo} 連鎖！(收集金錢球)`;
        showComboOverlay(currentCombo);
        
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
                    if (block.isFlash) flashColorsTriggered.add(block.color);
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

// 產生隨機面額金錢球 (1%~5% 機率機制)
function getRandomMoneyBallValue() {
    let r = Math.random() * 100; // 0~100
    // 機率表: 1/5 (30%), 4連(30%), 5連(20%), 6連(10%), 7連(4%), 8連(3%), 9連(2%), 10連(1%)
    if (r < 30) return Math.floor(currentBet / 5);
    if (r < 60) return Math.floor(currentBet * COMBO_MULTIPLIERS[4]);
    if (r < 80) return Math.floor(currentBet * COMBO_MULTIPLIERS[5]);
    if (r < 90) return Math.floor(currentBet * COMBO_MULTIPLIERS[6]);
    if (r < 94) return Math.floor(currentBet * COMBO_MULTIPLIERS[7]);
    if (r < 97) return Math.floor(currentBet * COMBO_MULTIPLIERS[8]);
    if (r < 99) return Math.floor(currentBet * COMBO_MULTIPLIERS[9]);
    return Math.floor(currentBet * COMBO_MULTIPLIERS[10]);
}

async function refillBoard() {
    let hasEmpty = false;
    let guaranteedRewardValue = 0;
    
    // 1. Guaranteed Combo Reward (4+)
    if (currentCombo >= 4) {
        let lookupChain = currentCombo >= 10 ? 10 : currentCombo;
        let mult = COMBO_MULTIPLIERS[lookupChain];
        guaranteedRewardValue = Math.floor(currentBet * mult);
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

    let rewardSpotIndex = -1;
    if (guaranteedRewardValue > 0) {
        let upperSpots = emptySpots.filter(spot => spot.r >= 0 && spot.r <= 3);
        if (upperSpots.length > 0) {
            let choice = upperSpots[Math.floor(Math.random() * upperSpots.length)];
            rewardSpotIndex = emptySpots.findIndex(s => s.r === choice.r && s.c === choice.c);
        } else {
            rewardSpotIndex = Math.floor(Math.random() * emptySpots.length);
        }
        DOM.drawStatus.textContent = `⭐ 生成 ${currentCombo} 連鎖獎金球！`;
        await sleep(500);
    }

    // 2. Random 1%~5% Money Ball Spawn Mechanism
    // Determine random chance between 0.01 and 0.05
    let randomSpawnChance = (Math.random() * 0.04) + 0.01;
    let randomMoneySpotIndex = -1;
    
    // Only spawn random money ball if it doesn't conflict with guaranteed reward spot
    if (emptySpots.length > (guaranteedRewardValue > 0 ? 1 : 0) && Math.random() < randomSpawnChance) {
        let availableIndices = [];
        for (let i = 0; i < emptySpots.length; i++) {
            if (i !== rewardSpotIndex) availableIndices.push(i);
        }
        if (availableIndices.length > 0) {
            randomMoneySpotIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
            DOM.drawStatus.textContent = `✨ 天降隨機金錢球！ ✨`;
            await sleep(500);
        }
    }

    let flashBallsCount = 0;
    if (Math.random() < 0.01) flashBallsCount = Math.floor(Math.random() * 3) + 1; 
    
    for (let i = 0; i < emptySpots.length; i++) {
        let {r, c} = emptySpots[i];
        let block;
        
        if (i === rewardSpotIndex) {
            block = createBlock(-1, c, null, true, guaranteedRewardValue);
        } else if (i === randomMoneySpotIndex) {
            let randomValue = getRandomMoneyBallValue();
            block = createBlock(-1, c, null, true, randomValue);
        } else {
            let color = getRandomColor(r, c);
            let isFlash = false;
            if (flashBallsCount > 0) { isFlash = true; flashBallsCount--; }
            block = createBlock(-1, c, color, false, 0, isFlash);
        }
        
        block.r = r;
        setTimeout(() => { block.el.style.top = `${r * (BLOCK_SIZE + GAP)}px`; }, 50);
        board[r][c] = block;
    }
    
    await sleep(500);
    currentCombo = 0; 
    await checkMatchesAndChain();
}

function showComboOverlay(combo) {
    if (combo < 3 && combo !== 1) return; // if it's 1 (from collecting money ball alone) maybe don't show huge text, or show it. Let's just show.
    DOM.comboOverlay.textContent = `${combo} COMBO!`;
    DOM.comboOverlay.classList.remove('show');
    void DOM.comboOverlay.offsetWidth;
    DOM.comboOverlay.classList.add('show');
    setTimeout(() => { DOM.comboOverlay.classList.remove('show'); }, 1000);
}

async function finishGameOverSequence() {
    isPlaying = false;
    DOM.drawStatus.textContent = '遊戲結束結算中...';
    DOM.outOverlay.classList.add('show');
    await sleep(2000);
    
    credit += totalWin;
    updateCreditDisplay();
    DOM.btnStart.disabled = false;
    document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = false);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
