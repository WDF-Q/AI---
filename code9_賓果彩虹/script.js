const COLS = 6;
const ROWS = 8;
const BLOCK_SIZE = 60; // 60px
const GAP = 4; // 4px

const COLORS = ['red', 'pink', 'blue', 'green', 'yellow'];
// Optional symbols for blocks just for visuals
const SYMBOLS = ['★', '●', '▲', '◆', '♥'];

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

function adjustBet(amount) {
    if (isPlaying) return;
    let currentBet = parseInt(DOM.betInput.value);
    currentBet += amount;
    if (currentBet < 10) currentBet = 10;
    if (currentBet > credit) currentBet = credit;
    DOM.betInput.value = currentBet;
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
function createBlock(r, c, color) {
    const el = document.createElement('div');
    el.className = `block color-${color}`;
    el.textContent = getSymbolForColor(color);
    // Position using absolute coordinates based on row and col
    el.style.left = `${c * (BLOCK_SIZE + GAP)}px`;
    el.style.top = `${r * (BLOCK_SIZE + GAP)}px`;
    
    DOM.board.appendChild(el);
    return { r, c, color, el };
}

// 初始化 8x6 盤面
function initBoard() {
    DOM.board.innerHTML = '';
    board = [];
    for (let r = 0; r < ROWS; r++) {
        let row = [];
        for (let c = 0; c < COLS; c++) {
            let color = getRandomColor();
            // 避免一開始就有 3 連線 (簡單檢查左邊跟上面)
            while (
                (c >= 2 && row[c-1].color === color && row[c-2].color === color) ||
                (r >= 2 && board[r-1][c].color === color && board[r-2][c].color === color)
            ) {
                color = getRandomColor();
            }
            row.push(createBlock(r, c, color));
        }
        board.push(row);
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
    currentCombo = 0;
    updateWinDisplay();
    
    DOM.btnStart.disabled = true;
    DOM.betMinus.disabled = true;
    DOM.betPlus.disabled = true;
    DOM.ballHistory.innerHTML = '';
    DOM.safeIndicator.textContent = '前 3 球安全保障！';
    DOM.safeIndicator.className = 'safe-indicator';
    
    initBoard();
    
    // 延遲一下後開始自動抽球
    DOM.drawStatus.textContent = '準備開始...';
    await sleep(1000);
    scheduleNextDraw();
}

function scheduleNextDraw() {
    if (!isPlaying) return;
    
    // 隨機 1~3 秒
    const delay = Math.floor(Math.random() * 2000) + 1000;
    DOM.drawStatus.textContent = `下一球將在 ${delay/1000} 秒後抽出...`;
    
    drawTimeout = setTimeout(drawBall, delay);
}

// 抽球邏輯
async function drawBall() {
    if (!isPlaying) return;
    ballCount++;
    
    let isOut = false;
    let drawnColor = '';
    
    // 前 3 球絕對安全。第 4 球開始有 15% 機率是 OUT
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
    
    // 安全球，隨機顏色
    drawnColor = getRandomColor();
    ballEl.classList.add(`color-${drawnColor}`);
    ballEl.textContent = getSymbolForColor(drawnColor);
    DOM.ballHistory.appendChild(ballEl);
    
    DOM.drawStatus.textContent = `抽中 ${drawnColor}！消除底層...`;
    
    // 處理消除與連鎖
    await processElimination(drawnColor);
    
    if (isPlaying) {
        scheduleNextDraw();
    }
}

// 核心邏輯：底部消除 -> 掉落 -> 連鎖
async function processElimination(color) {
    currentCombo = 0;
    
    // 1. 找出每一排最底層的該顏色方塊並消除
    let eliminatedAny = false;
    for (let c = 0; c < COLS; c++) {
        // 從最底層(ROWS-1)往上找，找到第一個方塊
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] !== null) {
                if (board[r][c].color === color) {
                    // 消除
                    board[r][c].el.classList.add('eliminating');
                    setTimeout((el) => el.remove(), 300, board[r][c].el);
                    board[r][c] = null;
                    eliminatedAny = true;
                }
                break; // 只看最底層露出來的，看完就換下一行
            }
        }
    }
    
    if (!eliminatedAny) {
        await sleep(500);
        return; // 底層沒這個顏色
    }
    
    await sleep(400); // 等待消除動畫
    await applyGravity();
    await checkMatchesAndChain();
}

// 物理掉落
async function applyGravity() {
    let moved = false;
    for (let c = 0; c < COLS; c++) {
        let emptySpots = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] === null) {
                emptySpots++;
            } else if (emptySpots > 0) {
                // 移動方塊
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
        await sleep(300); // 等待掉落動畫
    }
}

// 檢查 3 連線 (上下左右)
async function checkMatchesAndChain() {
    let hasMatches = true;
    
    while (hasMatches && isPlaying) {
        let matchedBlocks = new Set();
        
        // 橫向檢查
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 2; c++) {
                let b1 = board[r][c];
                if (!b1) continue;
                let color = b1.color;
                if (board[r][c+1]?.color === color && board[r][c+2]?.color === color) {
                    matchedBlocks.add(b1);
                    matchedBlocks.add(board[r][c+1]);
                    matchedBlocks.add(board[r][c+2]);
                }
            }
        }
        
        // 縱向檢查
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS - 2; r++) {
                let b1 = board[r][c];
                if (!b1) continue;
                let color = b1.color;
                if (board[r+1][c]?.color === color && board[r+2][c]?.color === color) {
                    matchedBlocks.add(b1);
                    matchedBlocks.add(board[r+1][c]);
                    matchedBlocks.add(board[r+2][c]);
                }
            }
        }
        
        if (matchedBlocks.size > 0) {
            currentCombo++;
            DOM.drawStatus.textContent = `${currentCombo} 連鎖！`;
            
            showComboOverlay(currentCombo);
            
            // 計算得分 (押分 * 倍率)
            let multiplier = getMultiplier(currentCombo);
            let bet = parseInt(DOM.betInput.value);
            totalWin += bet * multiplier;
            updateWinDisplay();
            
            // 消除
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

function getMultiplier(combo) {
    if (combo === 1 || combo === 2) return 0; // 前兩次連線可能沒倍率，或算小分，這裡依照簡化：3連鎖才算錢
    if (combo === 3) return 2;
    if (combo === 4) return 5;
    if (combo === 5) return 10;
    if (combo >= 6) return 30;
    return 0;
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
