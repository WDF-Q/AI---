const COLS = 6;
const ROWS = 8;
const BLOCK_SIZE = 60; // 60px
const GAP = 4; // 4px

const COLORS = ['red', 'pink', 'blue', 'green', 'yellow'];
const SYMBOLS = ['★', '●', '▲', '◆', '♥'];

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

function getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function getSymbolForColor(color) {
    const idx = COLORS.indexOf(color);
    return SYMBOLS[idx];
}

// 建立方塊 DOM
function createBlock(r, c, color, isMoney = false, moneyValue = 0) {
    const el = document.createElement('div');
    el.className = `block`;
    
    if (isMoney) {
        el.classList.add('money-ball');
        el.textContent = moneyValue;
    } else {
        el.classList.add(`color-${color}`);
        // el.textContent = getSymbolForColor(color); // Optional: if we want cute faces instead of symbols, we can leave textContent empty
    }
    
    // Position using absolute coordinates based on row and col
    el.style.left = `${c * (BLOCK_SIZE + GAP)}px`;
    el.style.top = `${r * (BLOCK_SIZE + GAP)}px`;
    
    DOM.board.appendChild(el);
    return { r, c, color, isMoney, moneyValue, el };
}

function getRandomEmptyPosition(excludeBottom = false) {
    let emptySpots = [];
    let maxR = excludeBottom ? ROWS - 2 : ROWS - 1; // don't spawn at absolute bottom if excluded
    for(let r=0; r<=maxR; r++) {
        for(let c=0; c<COLS; c++) {
            if (!board[r] || board[r][c] === null || board[r][c] === undefined) {
                emptySpots.push({r, c});
            }
        }
    }
    if (emptySpots.length === 0) return null;
    return emptySpots[Math.floor(Math.random() * emptySpots.length)];
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

    // Place 4 initial money balls randomly
    let placedMoney = 0;
    while (placedMoney < 4) {
        // Place anywhere from row 0 to row 6 (don't place immediately on row 7 so they don't drop out immediately)
        let r = Math.floor(Math.random() * (ROWS - 1));
        let c = Math.floor(Math.random() * COLS);
        if (board[r][c] === null) {
            board[r][c] = { isMoney: true, moneyValue: initialMoneyValue, r, c }; // temp object
            placedMoney++;
        }
    }

    // Fill the rest with colors, avoiding 3-matches
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== null && board[r][c].isMoney) {
                // Instantiate the money ball
                board[r][c] = createBlock(r, c, null, true, initialMoneyValue);
                continue;
            }
            
            let color = getRandomColor();
            // Avoid initial matches
            while (
                (c >= 2 && board[r][c-1]?.color === color && board[r][c-2]?.color === color && !board[r][c-1]?.isMoney && !board[r][c-2]?.isMoney) ||
                (r >= 2 && board[r-1][c]?.color === color && board[r-2][c]?.color === color && !board[r-1][c]?.isMoney && !board[r-2][c]?.isMoney)
            ) {
                color = getRandomColor();
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
    updateWinDisplay();
    updateLadderActive(0);
    
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

// 抽球邏輯
async function drawBall() {
    if (!isPlaying) return;
    ballCount++;
    currentCombo = 0;
    updateLadderActive(0);
    
    let isOut = false;
    let drawnColor = '';
    
    if (ballCount > 3) {
        DOM.safeIndicator.textContent = '危險區：隨時可能 OUT！';
        DOM.safeIndicator.className = 'safe-indicator danger';
        if (Math.random() < 0.15) {
            isOut = true;
        }
    }
    
    const ballEl = document.createElement('div');
    ballEl.className = 'ball';
    
    if (isOut) {
        ballEl.classList.add('out-ball');
        ballEl.textContent = 'OUT';
        DOM.ballHistory.appendChild(ballEl);
        DOM.drawStatus.textContent = '抽中 OUT！遊戲結束。';
        endGame();
        return;
    }
    
    drawnColor = getRandomColor();
    ballEl.classList.add(`color-${drawnColor}`);
    DOM.ballHistory.appendChild(ballEl);
    
    DOM.drawStatus.textContent = `抽中顏色！消除底層...`;
    
    // 處理消除與連鎖
    await processElimination(drawnColor);
    
    // 回合結束後，進行補球機制
    await refillBoard();
    
    if (isPlaying) {
        scheduleNextDraw();
    }
}

// 底層消除 -> 掉落 -> 連鎖
async function processElimination(color) {
    let eliminatedAny = false;
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
    
    if (!eliminatedAny) {
        await sleep(500);
        return;
    }
    
    await sleep(400); // Wait for eliminate animation
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
        await sleep(300); // Wait for drop animation
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
        await sleep(400);
        await applyGravity(); // Recursive gravity in case things fell above the collected money
    }
}

// 檢查 3 連線 (上下左右)
async function checkMatchesAndChain() {
    let hasMatches = true;
    
    while (hasMatches && isPlaying) {
        let matchedBlocks = new Set();
        
        // Horizontal
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 2; c++) {
                let b1 = board[r][c];
                if (!b1 || b1.isMoney) continue; // Money balls don't match
                let color = b1.color;
                
                let b2 = board[r][c+1];
                let b3 = board[r][c+2];
                if (b2 && !b2.isMoney && b2.color === color && b3 && !b3.isMoney && b3.color === color) {
                    matchedBlocks.add(b1);
                    matchedBlocks.add(b2);
                    matchedBlocks.add(b3);
                }
            }
        }
        
        // Vertical
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS - 2; r++) {
                let b1 = board[r][c];
                if (!b1 || b1.isMoney) continue;
                let color = b1.color;
                
                let b2 = board[r+1][c];
                let b3 = board[r+2][c];
                if (b2 && !b2.isMoney && b2.color === color && b3 && !b3.isMoney && b3.color === color) {
                    matchedBlocks.add(b1);
                    matchedBlocks.add(b2);
                    matchedBlocks.add(b3);
                }
            }
        }
        
        if (matchedBlocks.size > 0) {
            currentCombo++;
            updateLadderActive(currentCombo >= 10 ? 10 : currentCombo);
            DOM.drawStatus.textContent = `${currentCombo} 連鎖！`;
            showComboOverlay(currentCombo);
            
            for (let block of matchedBlocks) {
                block.el.classList.add('eliminating');
                setTimeout((el) => el.remove(), 300, block.el);
                board[block.r][block.c] = null;
            }
            
            await sleep(400);
            await applyGravity();
        } else {
            hasMatches = false;
        }
    }
}

// 回合結束後補滿盤面
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
    
    DOM.drawStatus.textContent = `補滿盤面...`;

    // Choose one random spot in upper half (r: 0~3) for the money ball if needed
    let rewardSpotIndex = -1;
    if (spawnRewardValue > 0) {
        let upperSpots = emptySpots.filter(spot => spot.r >= 0 && spot.r <= 3);
        if (upperSpots.length > 0) {
            let choice = upperSpots[Math.floor(Math.random() * upperSpots.length)];
            rewardSpotIndex = emptySpots.findIndex(s => s.r === choice.r && s.c === choice.c);
        } else {
            // fallback if upper is full, just pick any empty spot
            rewardSpotIndex = Math.floor(Math.random() * emptySpots.length);
        }
    }

    // Create new blocks above the board and drop them in
    for (let i = 0; i < emptySpots.length; i++) {
        let {r, c} = emptySpots[i];
        
        let block;
        if (i === rewardSpotIndex) {
            block = createBlock(-1, c, null, true, spawnRewardValue);
        } else {
            let color = getRandomColor();
            block = createBlock(-1, c, color, false);
        }
        
        // Animate from top (-1) to target r
        block.r = r;
        setTimeout(() => {
            block.el.style.top = `${r * (BLOCK_SIZE + GAP)}px`;
        }, 50);
        
        board[r][c] = block;
    }
    
    await sleep(400); // wait for refill drop
    
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
