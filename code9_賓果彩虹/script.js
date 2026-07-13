const COLS = 6;
const ROWS = 8;
const BLOCK_SIZE = 54; 
const GAP = 4;  
const OFFSET = 4;

const COLORS = ['red', 'pink', 'blue', 'green', 'yellow'];
const COLOR_ZH = {
    'red': '紅色',
    'pink': '粉色',
    'blue': '藍色',
    'green': '綠色',
    'yellow': '黃色',
    'white': '白色',
    'rainbow': '彩色'
};
// 6 base options * 3 = 18 slots, plus 3 SP slots = 21 slots.
const OUTER_WHEEL_SLOTS = [
    'red', 'pink', 'blue', 'green', 'yellow', 'white', 'sp',
    'red', 'pink', 'blue', 'green', 'yellow', 'white', 'sp',
    'red', 'pink', 'blue', 'green', 'yellow', 'white', 'sp'
];

const INNER_WHEEL_PAIRS = [
    ['rainbow', 'rainbow'], // 1
    ['red', 'pink'],        // 2
    ['pink', 'blue'],       // 3
    ['blue', 'green'],      // 4
    ['green', 'yellow'],    // 5
    ['yellow', 'red']       // 6
];

const ALL_DRAW_OPTIONS = ['red', 'pink', 'blue', 'green', 'yellow', 'white', 'roulette'];

const CSS_VAR_MAP = {
    'red': 'var(--color-red)',
    'pink': 'var(--color-pink)',
    'blue': 'var(--color-blue)',
    'green': 'var(--color-green)',
    'yellow': 'var(--color-yellow)',
    'white': '#ffffff',
    'sp': 'transparent' // SP Hole transparent to show flashing background!
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
let currentBet = 0;
let previousBet = 0;
let allClearBonusCount = 0;

let historyTracker = {
    red: 0, pink: 0, blue: 0, green: 0, yellow: 0, white: 0, rainbow: 0
};


let appleCount = 0;
const MAX_APPLES = 7;
let appleBonusRoundsLeft = 0;
let miniGameSteps = 0;
const MAX_MG_STEPS = 140;
let currentStepMapping = {};
const MG_STATIONS = [0, 20, 50, 90, 140];
let passedStations = [];
let nextBonusRoundsQueued = false;
let queuedJPPackages = [];
let currentAppleScores = [];
let activeJPAmount = 0;
let currentAppleColors = [];
let totalCollectedApples = 0;

// ** Decoupled Engine States **
let leftEngineActive = false;
let boardState = 'IDLE'; 
let pendingEventsQueue = []; 
let isGameOverTriggered = false; 
let pendingInitialBatch = 0; 
let pendingDrawsQueue = 0;

// Roulette animation tracking
let outerWheelRotation = 0;
let innerWheelRotation = 0;
let activeBalls = [];

const DOM = {
    board: document.getElementById('game-board'),
    credit: document.getElementById('credit-display'),
    betInput: document.getElementById('bet-input'),
    win: document.getElementById('win-display'),
    safeIndicator: document.getElementById('safe-indicator'),
    ballCountText: document.getElementById('ball-count-text'),
    appleIcons: document.querySelectorAll('.apple-icon'),
    btnDebugApple: document.getElementById('btn-debug-apple'),
    miniGamePanel: document.getElementById('mini-game-panel'),
    mgRoundsLeft: document.getElementById('mg-rounds-left'),
    mgColorRules: document.getElementById('mg-color-rules'),
    mgProgressFill: document.getElementById('mg-progress-fill'),
    mgDogContainer: document.getElementById('mg-dog-container'),
    mgDogCounter: document.getElementById('mg-dog-counter'),
    mgDog: document.getElementById('mg-dog'),
    mgStationEls: document.querySelectorAll('.mg-station'),
    birdMouthSlots: document.querySelectorAll('.bird-mouth-slot'),
    birdMouth: document.getElementById('bird-mouth'),
    drawStatus: document.getElementById('draw-status'),
    btnStart: document.getElementById('btn-start'),
    comboOverlay: document.getElementById('combo-overlay'),
    outOverlay: document.getElementById('out-overlay'),
    
    rouletteOuter: document.getElementById('roulette-wheel-outer'),
    rouletteInner: document.getElementById('roulette-wheel-inner'),
    rouletteBallOrbit: document.getElementById('roulette-ball-orbit'),
    rouletteBall: document.getElementById('roulette-ball'),
    rouletteResultText: document.getElementById('roulette-result-text'),
    
    fireBox: document.getElementById('fire-box'),
    ballHistory: document.getElementById('ball-history')
};

function startWheelRotations() {
    function animate() {
        outerWheelRotation = (outerWheelRotation + 0.5) % 360; 
        innerWheelRotation = (innerWheelRotation + 1.5) % 360; 
        
        DOM.rouletteOuter.style.transform = `rotate(${outerWheelRotation}deg)`;
        DOM.rouletteInner.style.transform = `translate(-50%, -50%) rotate(${innerWheelRotation}deg)`;
        
        for (let ball of activeBalls) {
            if (ball.state === 'landed_outer') {
                ball.orbitEl.style.transform = `rotate(${outerWheelRotation + ball.offsetAngle}deg)`;
            } else if (ball.state === 'landed_inner') {
                ball.orbitEl.style.transform = `rotate(${innerWheelRotation + ball.offsetAngle}deg)`;
            }
        }
        
        requestAnimationFrame(animate);
    }
    animate();
}

function initRouletteVisuals() {
    // Outer Wheel
    let gradientStopsOuter = [];
    let anglePerSlotOuter = 360 / 21;
    for (let i = 0; i < 21; i++) {
        let color = CSS_VAR_MAP[OUTER_WHEEL_SLOTS[i]];
        let startAngle = i * anglePerSlotOuter;
        let endAngle = (i + 1) * anglePerSlotOuter;
        gradientStopsOuter.push(`${color} ${startAngle}deg ${endAngle}deg`);
    }
    DOM.rouletteOuter.style.background = `conic-gradient(${gradientStopsOuter.join(', ')})`;
    
    // Inner Wheel
    let gradientStopsInner = [];
    let anglePerSlotInner = 360 / 6; 
    for (let i = 0; i < 6; i++) {
        let pair = INNER_WHEEL_PAIRS[i];
        let startAngle = i * anglePerSlotInner;
        let midAngle = startAngle + (anglePerSlotInner / 2);
        let endAngle = (i + 1) * anglePerSlotInner;
        
        if (pair[0] === 'rainbow') {
            let c0 = CSS_VAR_MAP['red'], c1 = CSS_VAR_MAP['pink'], c2 = CSS_VAR_MAP['blue'], c3 = CSS_VAR_MAP['green'], c4 = CSS_VAR_MAP['yellow'];
            let step = 60 / 5;
            gradientStopsInner.push(`${c0} ${startAngle}deg ${startAngle+step}deg`);
            gradientStopsInner.push(`${c1} ${startAngle+step}deg ${startAngle+step*2}deg`);
            gradientStopsInner.push(`${c2} ${startAngle+step*2}deg ${startAngle+step*3}deg`);
            gradientStopsInner.push(`${c3} ${startAngle+step*3}deg ${startAngle+step*4}deg`);
            gradientStopsInner.push(`${c4} ${startAngle+step*4}deg ${endAngle}deg`);
        } else {
            let color1 = CSS_VAR_MAP[pair[0]];
            let color2 = CSS_VAR_MAP[pair[1]];
            gradientStopsInner.push(`${color1} ${startAngle}deg ${midAngle}deg`);
            gradientStopsInner.push(`${color2} ${midAngle}deg ${endAngle}deg`);
        }
    }
    // Set background to the pseudo element or the div itself
    DOM.rouletteInner.style.background = `conic-gradient(${gradientStopsInner.join(', ')})`;
    
    startWheelRotations();
}
initRouletteVisuals();

const BET_INCREMENTS = [1, 5, 10, 20, 50, 100, 500];
let currentIncrementIndex = 0;

document.getElementById('btn-cycle-bet').addEventListener('click', () => {
    if (isPlaying) return;
    currentIncrementIndex = (currentIncrementIndex + 1) % BET_INCREMENTS.length;
    let inc = BET_INCREMENTS[currentIncrementIndex];
    document.getElementById('btn-cycle-bet').textContent = `切換加分 (+${inc})`;
});

document.getElementById('btn-add-bet').addEventListener('click', () => {
    if (isPlaying) return;
    if (currentBet === 0) {
        currentBet = 600;
    } else {
        let inc = BET_INCREMENTS[currentIncrementIndex];
        currentBet += inc;
        if (currentBet > 3000) currentBet = 3000;
    }
    DOM.betInput.textContent = currentBet;
    updateLadderRewards(currentBet);
});

document.getElementById('btn-repeat-bet').addEventListener('click', () => {
    if (isPlaying) return;
    if (previousBet > 0) {
        currentBet = previousBet;
        DOM.betInput.textContent = currentBet;
        updateLadderRewards(currentBet);
    } else {
        alert("沒有上一局的押分紀錄");
    }
});

DOM.btnStart.addEventListener('click', startGame);
updateLadderRewards(currentBet);

// --- Apple & Mini Game Logic ---
DOM.btnDebugApple.addEventListener('click', () => {
    if (currentBet === 0) {
        alert('請先點擊下方押注按鈕設定押分！(測試按鈕需要知道押分才能計算蘋果價值)');
        return;
    }
    collectApple(getAppleType());
});

document.querySelectorAll('.clickable-station').forEach(el => {
    el.addEventListener('click', (e) => {
        let station = parseInt(el.getAttribute('data-station'));
        let jpRef = activeJPAmount > 0 ? activeJPAmount : currentAppleScores.reduce((a, b) => a + b, 0);
        
        let ratio = 0;
        if (station === 90) ratio = 0.20;
        else if (station === 50) ratio = 0.10;
        else if (station === 20) ratio = 0.05;
        
        let amount = Math.floor(jpRef * ratio);
        let tooltip = document.getElementById('station-tooltip');
        
        // 如果 tooltip 已經是顯示狀態，代表這是 3 秒內的第二次點擊，則直接收回
        if (tooltip.style.opacity === '1') {
            tooltip.style.opacity = '0';
            if (window._stationTooltipTimeout) clearTimeout(window._stationTooltipTimeout);
            return;
        }

        tooltip.textContent = `${station}島獎金: ${amount}`;
        tooltip.style.left = el.style.left;
        tooltip.style.opacity = '1';
        
        if (window._stationTooltipTimeout) clearTimeout(window._stationTooltipTimeout);
        window._stationTooltipTimeout = setTimeout(() => {
            tooltip.style.opacity = '0';
        }, 3000);
    });
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.clickable-station')) {
        let tooltip = document.getElementById('station-tooltip');
        if (tooltip && tooltip.style.opacity === '1') {
            tooltip.style.opacity = '0';
            if (window._stationTooltipTimeout) clearTimeout(window._stationTooltipTimeout);
        }
    }
});

function updateAppleUI() {
    DOM.appleIcons.forEach((icon, index) => {
        if (index < currentAppleColors.length) {
            icon.classList.remove('dim');
            icon.className = 'apple-icon';
            icon.classList.add(`apple-${currentAppleColors[index]}`);
        } else {
            icon.className = 'apple-icon dim';
        }
    });
}

function updateMiniGameUI() {
    if (appleBonusRoundsLeft <= 0) {
        DOM.miniGamePanel.classList.add('hidden');
        return;
    }
    DOM.miniGamePanel.classList.remove('hidden');
    DOM.mgRoundsLeft.textContent = appleBonusRoundsLeft;
    
    let amountEl = document.getElementById('mg-jp-amount');
    if (amountEl) amountEl.textContent = activeJPAmount;
    
    let progressPercent = Math.min(100, (miniGameSteps / MAX_MG_STEPS) * 100);
    DOM.mgProgressFill.style.width = progressPercent + '%';
    
    DOM.mgDogCounter.textContent = miniGameSteps;
    DOM.mgDogContainer.style.left = progressPercent + '%';
    
    // Jump animation for the dog
    DOM.mgDog.classList.remove('mg-dog-walk');
    void DOM.mgDog.offsetWidth; // trigger reflow
    DOM.mgDog.classList.add('mg-dog-walk');
    
    DOM.mgStationEls.forEach(el => {
        let st = parseInt(el.textContent);
        if (miniGameSteps >= st) {
            el.classList.add('passed');
        } else {
            el.classList.remove('passed');
        }
    });
}


async function jumpToNextIsland() {
    let oldSteps = miniGameSteps;
    let nextStation = 140;
    for (let st of MG_STATIONS) {
        if (st > miniGameSteps) {
            nextStation = st;
            break;
        }
    }
    miniGameSteps = nextStation;
    updateMiniGameUI();
    
    if (oldSteps < 140 && miniGameSteps === 140) {
        DOM.drawStatus.textContent = `🎯 抵達終點 140 島！等待結算 🎯`;
        await sleep(2000);
    }
    
    await sleep(500);
}

async function applyMiniGameSteps(steps) {
    if (steps <= 0) return;
    
    let oldSteps = miniGameSteps;
    miniGameSteps = Math.min(140, miniGameSteps + steps);
    updateMiniGameUI();
    
    if (oldSteps < 140 && miniGameSteps === 140) {
        DOM.drawStatus.textContent = `🎯 抵達終點 140 島！等待結算 🎯`;
        await sleep(2000);
    } else if ([20, 50, 90].includes(miniGameSteps)) {
        DOM.drawStatus.textContent = `精準抵達 ${miniGameSteps} 島！直達下一島嶼！`;
        await sleep(1000);
        await jumpToNextIsland();
    }
    
    await sleep(200);
}

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
    el.style.left = `${OFFSET + c * (BLOCK_SIZE + GAP)}px`;
    el.style.top = `${r * (BLOCK_SIZE + GAP)}px`;
    DOM.board.appendChild(el);
    return { r, c, color, isMoney, moneyValue, isFlash, el };
}

function initBoard() {
    let blocks = DOM.board.querySelectorAll('.block');
    blocks.forEach(b => b.remove());
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
            let color = getSafeColorForRefill(r, c);
            board[r][c] = createBlock(r, c, color, false);
        }
    }
}

function getAppleType() {
    let r = Math.random();
    if (r < 0.40) return 'gold';
    if (r < 0.60) return 'silver';
    if (r < 0.80) return 'bronze';
    if (r < 0.90) return 'red';
    return 'green';
}

let topApplesState = new Array(COLS).fill(null);

function spawnApples() {
    DOM.birdMouthSlots.forEach(slot => {
        slot.innerHTML = '';
    });
    topApplesState.fill(null);
    
    let slotsArray = Array.from(DOM.birdMouthSlots);
    if(slotsArray.length === 0) return;
    
    let beakIndex = Math.floor(Math.random() * slotsArray.length);
    
    let beakEl = document.createElement('div');
    beakEl.className = 'bird-mouth';
    beakEl.id = 'bird-mouth';
    beakEl.textContent = 'SP光束';
    slotsArray[beakIndex].appendChild(beakEl);
    
    DOM.birdMouth = beakEl;
    
    let appleCount = Math.random() < 0.1 ? 2 : 3;
    let availableSlots = [];
    for (let i = 0; i < slotsArray.length; i++) {
        if (i !== beakIndex) availableSlots.push(slotsArray[i]);
    }
    availableSlots.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < appleCount && i < availableSlots.length; i++) {
        let appleType = getAppleType();
        let appleEl = document.createElement('div');
        appleEl.className = `apple-item apple-${appleType}`;
        let num = Math.floor(Math.random() * 10) + 6; // 6 to 15
        appleEl.innerHTML = `🍎<span class="apple-num">${num}</span>`;
        availableSlots[i].appendChild(appleEl);
        
        let colIndex = slotsArray.indexOf(availableSlots[i]);
        topApplesState[colIndex] = {
            type: appleType,
            hp: num,
            el: appleEl,
            numEl: appleEl.querySelector('.apple-num'),
            readyToDrop: false
        };
    }
}

function updateApplesHP(colCounts) {
    for (let c = 0; c < COLS; c++) {
        if (colCounts[c] > 0 && topApplesState[c] !== null && !topApplesState[c].readyToDrop) {
            topApplesState[c].hp -= colCounts[c];
            if (topApplesState[c].hp <= 0) {
                topApplesState[c].hp = 0;
                topApplesState[c].readyToDrop = true;
            }
            topApplesState[c].numEl.textContent = topApplesState[c].hp;
        }
    }
}

async function startGame() {
    if (leftEngineActive || boardState !== 'IDLE') return;
    
    if (queuedJPPackages.length > 0 && appleBonusRoundsLeft === 0) {
        appleBonusRoundsLeft = 3;
        activeJPAmount = queuedJPPackages.shift();
        
        if (currentAppleColors.length === 7) {
            currentAppleColors = [];
            currentAppleScores = [];
            updateAppleUI();
        }
        
        miniGameSteps = 0;
        passedStations = [];
        
        // 鎖定本次 JP 遊戲三局的顏色與步數
        const colors = ['red', 'pink', 'blue', 'green', 'yellow'];
        colors.sort(() => Math.random() - 0.5);
        const selected = colors.slice(0, 3);
        const steps = [1, 3, 5];
        steps.sort(() => Math.random() - 0.5);
        
        currentStepMapping = {};
        DOM.mgColorRules.innerHTML = '';
        for (let i=0; i<3; i++) {
            currentStepMapping[selected[i]] = steps[i];
            DOM.mgColorRules.innerHTML += `
                <div class="track-square" style="background: var(--color-${selected[i]}); margin: 0 10px; font-size: 1.1rem; color: #fff; font-weight: bold; width: 25px; height: 25px; border-radius: 4px; display: flex; align-items: center; justify-content: center;">${steps[i]}</div>
            `;
        }
    }
    
    if (appleBonusRoundsLeft > 0) {
        updateMiniGameUI();
    }
    
    if (currentBet === 0) {
        alert("請先押分！");
        return;
    }
    if (credit < currentBet) {
        alert("餘額不足！");
        return;
    }
    previousBet = currentBet;
    credit -= currentBet;
    updateCreditDisplay();
    
    isPlaying = true;
    totalWin = 0;
    ballCount = 0;
    currentCombo = 0;
    allClearBonusCount = 0;
    batchEliminatedAny = false;
    DOM.ballCountText.textContent = ballCount;
    isGameOverTriggered = false;
    pendingEventsQueue = [];
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
    spawnApples();
    
    pendingDrawsQueue = 3;
    pendingInitialBatch = 3;
    
    DOM.drawStatus.textContent = '遊戲開始！';
    await sleep(1000);
    
    leftEngineActive = true;
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
    // Exclude rainbow (index 0), randomly pick from 1 to 5
    return INNER_WHEEL_PAIRS[Math.floor(Math.random() * 5) + 1];
}

function addBallToHistoryUI(typeText, colorClass, gradient = null) {
    const ballEl = document.createElement('div');
    ballEl.className = 'ball';
    
    
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
    while (DOM.ballHistory.children.length > 10) {
        DOM.ballHistory.removeChild(DOM.ballHistory.firstChild);
    }
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

async function spawnAndSpinBall(targetMain, isInner = false, innerTargetText = null, innerTargetColor = null, innerTargetPair = null) {
    let orbitEl = document.createElement('div');
    orbitEl.className = 'roulette-ball-orbit';
    let ballEl = document.createElement('div');
    ballEl.className = 'roulette-ball visible';
    orbitEl.appendChild(ballEl);
    
    document.querySelector('.roulette-wheel-wrapper').appendChild(orbitEl);
    
    let ballObj = { orbitEl, ballEl, state: 'spinning_outer', offsetAngle: 0 };
    activeBalls.push(ballObj);
    
    DOM.fireBox.classList.add('active');
    DOM.fireBox.textContent = '發球！';
    
    orbitEl.style.transition = 'none';
    orbitEl.style.transform = `rotate(0deg)`;
    void orbitEl.offsetWidth; 
    
    let baseSpins = 3 * 360; 
    
    let possibleIndices = [];
    for (let i = 0; i < OUTER_WHEEL_SLOTS.length; i++) {
        if (OUTER_WHEEL_SLOTS[i] === targetMain) possibleIndices.push(i);
    }
    let targetIndexOuter = possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
    let anglePerSlotOuter = 360 / 21;
    let slotCenterOuter = (targetIndexOuter * anglePerSlotOuter) + (anglePerSlotOuter / 2);
    
    let predictedOuterRotation = (outerWheelRotation + (0.5 * 120)) % 360; 
    let targetWorldAngle = predictedOuterRotation + slotCenterOuter; 
    
    let targetModOuter = ((targetWorldAngle % 360) + 360) % 360;
    let orbitTargetRot = -(baseSpins + (360 - targetModOuter) % 360);
    
    orbitEl.style.transition = 'transform 2s cubic-bezier(0.25, 1, 0.5, 1)'; 
    orbitEl.style.transform = `rotate(${orbitTargetRot}deg)`;
    await sleep(2000);
    
    ballObj.state = 'landed_outer';
    ballObj.offsetAngle = orbitTargetRot - outerWheelRotation;
    orbitEl.style.transition = 'none';
    
    if (!isInner) {
        DOM.fireBox.classList.remove('active');
        DOM.fireBox.textContent = 'WAIT';
        ballEl.classList.remove('visible');
        updateResultText(targetMain.toUpperCase(), targetMain);
        await sleep(500);
    } else {
        await sleep(500);
        
        DOM.rouletteResultText.textContent = '進入內圈小轉盤！';
        DOM.rouletteResultText.style.color = '#a855f7';
        ballEl.classList.add('dive-inner');
        
        await sleep(500); 
        
        ballObj.state = 'spinning_inner';
        let innerSpins = 2 * 360; 
        
        let targetIndexInner = 0;
        if (innerTargetPair) {
            targetIndexInner = INNER_WHEEL_PAIRS.findIndex(p => p[0] === innerTargetPair[0] && p[1] === innerTargetPair[1]);
            if (targetIndexInner === -1) targetIndexInner = 0;
        }
        let anglePerSlotInner = 360 / 6;
        let slotCenterInner = (targetIndexInner * anglePerSlotInner) + (anglePerSlotInner / 2);
        
        let predictedInnerRotation = (innerWheelRotation + (1.5 * 60)) % 360;
        let innerTargetWorldAngle = predictedInnerRotation + slotCenterInner;
        
        let currentBallWorldAngle = outerWheelRotation + ballObj.offsetAngle;
        
        let currentMod = ((currentBallWorldAngle % 360) + 360) % 360;
        let targetModInner = ((innerTargetWorldAngle % 360) + 360) % 360;
        let deltaInner = targetModInner - currentMod;
        if (deltaInner < 0) deltaInner += 360; 
        
        let nextOrbitTargetRot = currentBallWorldAngle + innerSpins + deltaInner;
        
        orbitEl.style.transition = 'transform 1s cubic-bezier(0.25, 1, 0.5, 1)';
        orbitEl.style.transform = `rotate(${nextOrbitTargetRot}deg)`;
        
        await sleep(1000);
        
        ballObj.state = 'landed_inner';
        ballObj.offsetAngle = nextOrbitTargetRot - innerWheelRotation;
        orbitEl.style.transition = 'none';
        
        await sleep(500);
        
        DOM.fireBox.classList.remove('active');
        DOM.fireBox.textContent = 'WAIT';
        ballEl.classList.remove('visible'); 
        updateResultText(innerTargetText, innerTargetColor);
        await sleep(800);
    }
    
    orbitEl.remove();
    activeBalls = activeBalls.filter(b => b !== ballObj);
}

async function shootBallAsync(isSafeMode) {
    let baseDraw = ALL_DRAW_OPTIONS[Math.floor(Math.random() * ALL_DRAW_OPTIONS.length)];
    
    if (baseDraw === 'white') {
        await spawnAndSpinBall('white', false);
        historyTracker.white++;
        addBallToHistoryUI('白色', 'white');
        
        if (!isSafeMode) {
            isGameOverTriggered = true;
            pendingEventsQueue.push({ type: 'game_over' });
            DOM.drawStatus.textContent = '抽中 OUT！等待盤面結算...';
            return 'game_over';
        } else {
            DOM.drawStatus.textContent = '安全期！抽中白球不結束。';
            return 'safe_white';
        }
    } else if (baseDraw === 'roulette') {
        let r = Math.random();
        if (r < 1/6) {
            await spawnAndSpinBall('sp', true, '🌈 彩色球', 'sp', ['rainbow', 'rainbow']);
            historyTracker.rainbow++;
            addBallToHistoryUI('彩色', 'rainbow');
            
            pendingEventsQueue.push({ type: 'laser_strike' });
            DOM.drawStatus.textContent = '彩色球！獲得雷射！';
            return 'rainbow';
        } else {
            let pair = getSmallRoulettePair();
            await spawnAndSpinBall('sp', true, `SP ${pair[0]}+${pair[1]}`, 'sp', pair);
            historyTracker[pair[0]]++;
            historyTracker[pair[1]]++;
            let gradient = `linear-gradient(45deg, var(--color-${pair[0]}) 50%, var(--color-${pair[1]}) 50%)`;
            addBallToHistoryUI('雙色', null, gradient);
            
            if (appleBonusRoundsLeft > 0) {
                let s1 = currentStepMapping[pair[0]] || 0;
                if (s1) await applyMiniGameSteps(s1);
                let s2 = currentStepMapping[pair[1]] || 0;
                if (s2) await applyMiniGameSteps(s2);
            }
            
            pendingEventsQueue.push({ type: 'layer8_hit', colors: pair });
            DOM.drawStatus.textContent = '小轉盤：同步消除雙色！';
            return 'sp';
        }
    } else {
        let color = baseDraw;
        await spawnAndSpinBall(color, false);
        historyTracker[color]++;
        addBallToHistoryUI(COLOR_ZH[color], color);
        
        if (appleBonusRoundsLeft > 0 && currentStepMapping[color]) {
            await applyMiniGameSteps(currentStepMapping[color]);
        }
        
        pendingEventsQueue.push({ type: 'layer8_hit', colors: [color] });
        DOM.drawStatus.textContent = `抽中 ${COLOR_ZH[color]}！`;
        return 'color';
    }
}

async function startLeftEngine() {
    while (leftEngineActive && !isGameOverTriggered) {
        if (pendingDrawsQueue === 0) pendingDrawsQueue = 1;
        
        while (pendingDrawsQueue > 0 && !isGameOverTriggered) {
            try {
                if (pendingInitialBatch > 0) {
                    let batchCount = pendingInitialBatch;
                    pendingInitialBatch = 0;
                    pendingDrawsQueue -= batchCount;
                    
                    let promises = [];
                    let rainbowTriggeredCount = 0;
                    
                    for (let i = 0; i < batchCount; i++) {
                        if (isGameOverTriggered) break;
                        ballCount++;
                        let currentShotNumber = ballCount;
                        DOM.ballCountText.textContent = ballCount;
                        let isSafeMode = true; 
                        
                        let p = shootBallAsync(isSafeMode).then(res => {
                            if (res === 'rainbow') {
                                let expectedTotal = currentShotNumber + (batchCount - 1 - i) + (rainbowTriggeredCount * 3);
                                if (expectedTotal <= 40) {
                                    rainbowTriggeredCount++;
                                }
                            }
                            updateHistoryUI();
                        }).catch(e => console.error("Left engine batch error:", e));
                        promises.push(p);
                        
                        if (i < batchCount - 1) {
                            await sleep(800);
                        }
                    }
                    
                    await Promise.all(promises);
                    
                    if (rainbowTriggeredCount > 0) {
                        pendingDrawsQueue += (rainbowTriggeredCount * 3);
                        pendingInitialBatch += (rainbowTriggeredCount * 3);
                    } else {
                        pendingEventsQueue.push({ type: 'trigger_chains' });
                    }
                    
                    if (pendingInitialBatch === 0 && ballCount >= 40) {
                        isGameOverTriggered = true;
                        pendingEventsQueue.push({ type: 'game_over' });
                        DOM.drawStatus.textContent = '已達 40 球上限！等待盤面結算...';
                    }
                    
                } else {
                    let randomInterval = Math.floor(Math.random() * 1000) + 500; 
                    await sleep(randomInterval);
                    
                    ballCount++;
                    DOM.ballCountText.textContent = ballCount;
                    let isSafeMode = (ballCount <= 3); 
                    
                    if (!isSafeMode) {
                        DOM.safeIndicator.textContent = '危險區：抽中白球即結束！';
                        DOM.safeIndicator.className = 'safe-indicator danger';
                    }
                    
                    let res = await shootBallAsync(isSafeMode);
                    updateHistoryUI();
                    
                    pendingDrawsQueue--;
                    if (res === 'rainbow') {
                        if (ballCount <= 40) {
                            pendingDrawsQueue += 3;
                            pendingInitialBatch += 3;
                        } else {
                            pendingEventsQueue.push({ type: 'trigger_chains' });
                        }
                    } else {
                        pendingEventsQueue.push({ type: 'trigger_chains' });
                    }
                    
                    if (pendingInitialBatch === 0 && ballCount >= 40) {
                        isGameOverTriggered = true;
                        pendingEventsQueue.push({ type: 'game_over' });
                        DOM.drawStatus.textContent = '已達 40 球上限！等待盤面結算...';
                        break;
                    }
                }
            } catch (err) {
                console.error("Left engine error:", err);
            }
        }
    }
    leftEngineActive = false;
}

let batchEliminatedAny = false;

async function startRightEngine() {
    while (isPlaying) {
        if (boardState === 'IDLE' && pendingEventsQueue.length > 0) {
            boardState = 'BUSY';
            
            try {
                let event = pendingEventsQueue.shift();
            
                if (event.type === 'layer8_hit') {
                    let eliminatedAny = false;
                    let flashColorsTriggered = new Set();
                    let colElims = new Array(COLS).fill(0);
                    
                    for (let color of event.colors) {
                        for (let c = 0; c < COLS; c++) {
                            let block = board[ROWS - 1][c];
                            if (block !== null && !block.isMoney && block.color === color) {
                                if (block.isFlash) flashColorsTriggered.add(block.color);
                                if (block.attachedApple) collectApple(block.attachedApple);
                                colElims[c]++;
                                block.el.classList.add('eliminating');
                                setTimeout((el) => el.remove(), 1000, block.el);
                                board[ROWS - 1][c] = null;
                                eliminatedAny = true;
                            }
                        }
                    }
                    updateApplesHP(colElims);
                    
                    if (flashColorsTriggered.size > 0) {
                        DOM.drawStatus.textContent = `⚡ 發光球引爆！ ⚡`;
                        let flashColElims = new Array(COLS).fill(0);
                        for (let r = 0; r < ROWS; r++) {
                            for (let c = 0; c < COLS; c++) {
                                let block = board[r][c];
                                if (block !== null && !block.isMoney && flashColorsTriggered.has(block.color)) {
                                    if (block.attachedApple) collectApple(block.attachedApple);
                                    flashColElims[c]++;
                                    block.el.classList.add('eliminating');
                                    setTimeout((el) => el.remove(), 1000, block.el);
                                    board[r][c] = null;
                                    eliminatedAny = true;
                                }
                            }
                        }
                        updateApplesHP(flashColElims);
                    }
                    
                    if (eliminatedAny) {
                        currentCombo = 1;
                        updateLadderActive(currentCombo);
                        DOM.drawStatus.textContent = `${currentCombo} 連鎖！(底部引爆)`;
                        showComboOverlay(currentCombo);
                        await engineSleep(1000);
                        batchEliminatedAny = true;
                    }
                } else if (event.type === 'trigger_chains') {
                    if (batchEliminatedAny) {
                        await applyGravity();
                        await checkMatchesAndChain();
                        
                        let finalCombo = currentCombo;
                        currentCombo = 0;
                        updateLadderActive(0);
                        
                        await refillBoard(finalCombo);
                        batchEliminatedAny = false;
                        currentCombo = 0;
                        updateLadderActive(0);
                    }
                } else if (event.type === 'laser_strike') {
                    let birdMouth = document.getElementById('bird-mouth');
                    if (birdMouth) birdMouth.classList.add('bird-charging');
                    
                    await engineSleep(500); // 讓鳥嘴集氣膨脹
                    
                    let targetCol = 0;
                    if (birdMouth && birdMouth.parentElement) {
                        let slots = Array.from(document.querySelectorAll('.bird-mouth-slot'));
                        targetCol = slots.indexOf(birdMouth.parentElement);
                        if (targetCol === -1) targetCol = 0;
                    }
                    
                    let laserBeam = document.getElementById('laser-beam');
                    if (laserBeam) {
                        laserBeam.style.left = `${OFFSET + targetCol * (BLOCK_SIZE + GAP)}px`;
                        laserBeam.classList.remove('hidden');
                        laserBeam.style.animation = 'none';
                        void laserBeam.offsetWidth;
                        laserBeam.style.animation = 'laser-flash 0.6s ease-out forwards';
                    }
                    
                    DOM.drawStatus.textContent = `⚡ 鳥嘴雷射發射！ ⚡`;
                    await engineSleep(400); // 等待雷射特效到達最大
                    if (birdMouth) birdMouth.classList.remove('bird-charging');
                    
                    let moneyCollected = 0;
                    let flashColorsTriggered = new Set();
                    let laserColElims = new Array(COLS).fill(0);
                    
                    for (let r = 0; r < ROWS; r++) {
                        let block = board[r][targetCol];
                        if (block !== null) {
                            if (block.isMoney) {
                                moneyCollected += block.moneyValue;
                                totalWin += block.moneyValue;
                                DOM.drawStatus.textContent = `雷射命中！獲得獎金 +${block.moneyValue}！`;
                            } else {
                                if (block.isFlash) flashColorsTriggered.add(block.color);
                                if (block.attachedApple) collectApple(block.attachedApple);
                                laserColElims[targetCol]++;
                            }
                            block.el.classList.add('eliminating');
                            setTimeout((el) => el.remove(), 500, block.el);
                            board[r][targetCol] = null;
                        }
                    }
                    updateApplesHP(laserColElims);
                    
                    if (flashColorsTriggered.size > 0) {
                        DOM.drawStatus.textContent = `⚡ 發光球引爆！ ⚡`;
                        let flashColElims = new Array(COLS).fill(0);
                        for (let r = 0; r < ROWS; r++) {
                            for (let c = 0; c < COLS; c++) {
                                let block = board[r][c];
                                if (block !== null && !block.isMoney && flashColorsTriggered.has(block.color)) {
                                    if (block.attachedApple) collectApple(block.attachedApple);
                                    flashColElims[c]++;
                                    block.el.classList.add('eliminating');
                                    setTimeout((el) => el.remove(), 500, block.el);
                                    board[r][c] = null;
                                }
                            }
                        }
                        updateApplesHP(flashColElims);
                    }
                    
                    if (moneyCollected > 0) {
                        updateWinDisplay();
                    }
                    
                    await engineSleep(500);
                    
                    laserBeam.classList.add('hidden');
                    
                    if (appleBonusRoundsLeft > 0) {
                        await jumpToNextIsland();
                    }
                    
                    await applyGravity();
                    await checkMatchesAndChain();
                    
                    let finalCombo = currentCombo;
                    currentCombo = 0;
                    updateLadderActive(0);
                    
                    await refillBoard(finalCombo);
                    
                    currentCombo = 0;
                    updateLadderActive(0);
                    
                } else if (event.type === 'game_over') {
                    boardState = 'SETTLING';
                    await checkMatchesAndChain(); // 結算最後盤面
                    await finishGameOverSequence();
                    boardState = 'IDLE';
                    continue;
                }
            } catch (err) {
                console.error("Right engine error:", err);
            }
            
            boardState = 'IDLE';
        } else {
            await sleep(100);
        }
    }
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
    if (moved) await engineSleep(400);
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
        let moneyBlocksToEliminate = [];
        for (let c = 0; c < COLS; c++) {
            let block = board[ROWS - 1][c];
            if (block && block.isMoney) {
                moneyBlocksToEliminate.push(block);
            }
        }
        
        let components = findConnectedComponents();
        
        if (components.length > 0 || moneyBlocksToEliminate.length > 0) {
            currentCombo++;
            updateLadderActive(currentCombo >= 10 ? 10 : currentCombo);
            
            let statusText = `${currentCombo} 連鎖！`;
            if (components.length > 0 && moneyBlocksToEliminate.length > 0) {
                statusText += ` (金錢+消除)`;
            } else if (moneyBlocksToEliminate.length > 0) {
                statusText += ` (收集金錢球)`;
            } else {
                statusText += ` (消除)`;
            }
            DOM.drawStatus.textContent = statusText;
            showComboOverlay(currentCombo);
            
            // 處理金錢球
            for (let block of moneyBlocksToEliminate) {
                totalWin += block.moneyValue;
                block.el.style.transform = 'scale(1.5)';
                block.el.style.opacity = '0';
                setTimeout((el) => el.remove(), 1000, block.el);
                board[block.r][block.c] = null;
            }
            if (moneyBlocksToEliminate.length > 0) {
                updateWinDisplay();
            }
            
            // 處理色塊消除
            if (components.length > 0) {
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
                
                let colElims = new Array(COLS).fill(0);
                for (let block of blocksToEliminate) {
                    if (block.attachedApple) {
                        collectApple(block.attachedApple);
                    }
                    colElims[block.c]++;
                    block.el.classList.add('eliminating');
                    setTimeout((el) => el.remove(), 1000, block.el);
                    board[block.r][block.c] = null;
                }
                updateApplesHP(colElims);
            }
            
            await engineSleep(1000);
            await applyGravity();
            
            let isAllClear = true;
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (board[r][c] !== null) {
                        isAllClear = false;
                        break;
                    }
                }
                if (!isAllClear) break;
            }
            if (isAllClear && allClearBonusCount < 2) {
                allClearBonusCount++;
                let bonus = currentBet * 30;
                totalWin += bonus;
                updateWinDisplay();
                DOM.drawStatus.textContent = `🎊 全盤清除！額外獲得 ${bonus} 🎊`;
                await engineSleep(2000);
            }
        } else {
            hasMatches = false;
        }
    }
}

function getRandomMoneyBallValue() {
    let r = Math.random() * 100; 
    if (r < 50) return Math.floor(currentBet * (1/5));
    if (r < 75) return Math.floor(currentBet * (2/5));
    if (r < 85) return Math.floor(currentBet * (4/5));
    if (r < 90) return Math.floor(currentBet * (6/5));
    if (r < 94) return Math.floor(currentBet * (8/5));
    if (r < 97) return Math.floor(currentBet * (10/5));
    if (r < 99) return Math.floor(currentBet * (25/5));
    return Math.floor(currentBet * (50/5));
}

function getSafeColorForRefill(r, c) {
    let availableColors = [...COLORS];
    for (let i = availableColors.length - 1; i >= 0; i--) {
        let color = availableColors[i];
        
        // 暫時擺放該顏色以進行洪水填充模擬
        board[r][c] = { color: color, isMoney: false };
        
        let visited = new Array(ROWS).fill(0).map(() => new Array(COLS).fill(false));
        let count = 0;
        let queue = [{r, c}];
        visited[r][c] = true;
        const dr = [-1, 1, 0, 0];
        const dc = [0, 0, -1, 1];
        
        while(queue.length > 0) {
            let curr = queue.shift();
            count++;
            for (let d = 0; d < 4; d++) {
                let nr = curr.r + dr[d];
                let nc = curr.c + dc[d];
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                    let nextBlock = board[nr][nc];
                    if (nextBlock && !nextBlock.isMoney && !visited[nr][nc] && nextBlock.color === color) {
                        visited[nr][nc] = true;
                        queue.push({r: nr, c: nc});
                    }
                }
            }
        }
        
        // 移除暫時擺放的色塊
        board[r][c] = null;
        
        // 如果有任何形狀達到 3 個或以上相連，就絕對禁止這個顏色！
        if (count >= 3) {
            availableColors.splice(i, 1);
        }
    }
    
    if (availableColors.length === 0) return COLORS[Math.floor(Math.random() * COLORS.length)];
    
    // Attempt 10% grouping logic if neighbors have safe colors
    if (r !== undefined && c !== undefined && Math.random() < 0.10) {
        let neighbors = [];
        if (r > 0 && board[r-1][c] && !board[r-1][c].isMoney) neighbors.push(board[r-1][c].color);
        if (r < ROWS-1 && board[r+1][c] && !board[r+1][c].isMoney) neighbors.push(board[r+1][c].color);
        if (c > 0 && board[r][c-1] && !board[r][c-1].isMoney) neighbors.push(board[r][c-1].color);
        if (c < COLS-1 && board[r][c+1] && !board[r][c+1].isMoney) neighbors.push(board[r][c+1].color);
        
        // Filter neighbors to only include SAFE colors
        let safeNeighbors = neighbors.filter(col => availableColors.includes(col));
        if (safeNeighbors.length > 0) {
            return safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
        }
    }
    
    return availableColors[Math.floor(Math.random() * availableColors.length)];
}

async function refillBoard(finalCombo = 0) {
    let hasEmpty = false;
    let guaranteedRewardValue = 0;
    
    if (finalCombo >= 4) {
        let lookupChain = finalCombo >= 10 ? 10 : finalCombo;
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

    // 嚴格排序空缺：從最底層開始填，同一層由左到右
    // 這樣在 getSafeColorForRefill 時，下方與左方的方塊都已經是確定的顏色，才能完美避開 3 連線
    emptySpots.sort((a, b) => {
        if (b.r !== a.r) return b.r - a.r;
        return a.c - b.c;
    });

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
        await engineSleep(500);
    }
    
    let randomMoneySpots = new Set();
    let spawnMoneyBallsChance = Math.random() * 100;
    if (spawnMoneyBallsChance < 10 && emptySpots.length > 0) {
        let count = Math.floor(Math.random() * 3) + 1; // 1 to 3 balls
        count = Math.min(count, emptySpots.length - (rewardSpotIndex !== -1 ? 1 : 0)); // Ensure enough empty spots
        
        // Pick available indices avoiding the reward spot
        let availableIndices = [];
        for (let i = 0; i < emptySpots.length; i++) {
            if (i !== rewardSpotIndex) availableIndices.push(i);
        }
        availableIndices.sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < count && i < availableIndices.length; i++) {
            randomMoneySpots.add(availableIndices[i]);
        }
        
        if (randomMoneySpots.size > 0) {
            DOM.drawStatus.textContent = `✨ 天降隨機金錢球！ ✨`;
            await engineSleep(500);
        }
    }

    let flashBallsCount = 0;
    if (Math.random() < 0.50) flashBallsCount = Math.floor(Math.random() * 3) + 1; 
    
    // 預先在盤面上塞入佔位符，這樣 getSafeColorForRefill 才能判斷到剛生成的新球
    for (let i = 0; i < emptySpots.length; i++) {
        let {r, c} = emptySpots[i];
        if (i === rewardSpotIndex || randomMoneySpots.has(i)) {
            board[r][c] = { isMoney: true }; // 佔位
        }
    }
    
    for (let i = 0; i < emptySpots.length; i++) {
        let {r, c} = emptySpots[i];
        let block;
        
        if (i === rewardSpotIndex) {
            block = createBlock(-1, c, null, true, guaranteedRewardValue);
        } else if (randomMoneySpots.has(i)) {
            let randomValue = getRandomMoneyBallValue();
            block = createBlock(-1, c, null, true, randomValue);
        } else {
            let color = getSafeColorForRefill(r, c);
            let isFlash = false;
            if (flashBallsCount > 0) { isFlash = true; flashBallsCount--; }
            block = createBlock(-1, c, color, false, 0, isFlash);
        }
        
        block.r = r;
        setTimeout(() => { block.el.style.top = `${r * (BLOCK_SIZE + GAP)}px`; }, 50);
        board[r][c] = block; // 正式寫入完整 block，後續生成會參考到這個正確的 block
    }
    
    // 處理蘋果掉落附著
    for (let c = 0; c < COLS; c++) {
        if (topApplesState[c] !== null && topApplesState[c].readyToDrop) {
            let newColorBlocksInCol = emptySpots.filter(spot => 
                spot.c === c && board[spot.r][spot.c] && !board[spot.r][spot.c].isMoney
            );
            if (newColorBlocksInCol.length > 0) {
                let randomSpot = newColorBlocksInCol[Math.floor(Math.random() * newColorBlocksInCol.length)];
                let block = board[randomSpot.r][randomSpot.c];
                block.attachedApple = topApplesState[c].type;
                
                let smallApple = document.createElement('div');
                smallApple.className = `apple-item apple-${topApplesState[c].type}`;
                smallApple.innerHTML = '🍎';
                smallApple.style.fontSize = '1.5rem';
                smallApple.style.position = 'absolute';
                smallApple.style.bottom = '-8px';
                smallApple.style.right = '-8px';
                smallApple.style.zIndex = '10';
                smallApple.style.filter = 'drop-shadow(0 0 5px rgba(255,255,255,1))';
                
                // 清除附著蘋果本身的動畫，避免一直跳動
                smallApple.style.animation = 'none';
                
                block.el.appendChild(smallApple);
                
                topApplesState[c].el.remove();
                topApplesState[c] = null;
            }
        }
    }
    
    await engineSleep(500);
    // 恢復 checkMatchesAndChain 作為安全網，雖然演算法已保證不連鎖，
    // 若機率極低發生顏色庫耗盡而 fallback 的情況，也能正確清除避免盤面卡死
    await checkMatchesAndChain(); 
}

function showComboOverlay(combo) {
    DOM.comboOverlay.textContent = `${combo} COMBO!`;
    DOM.comboOverlay.classList.remove('show');
    void DOM.comboOverlay.offsetWidth;
    DOM.comboOverlay.classList.add('show');
    setTimeout(() => { DOM.comboOverlay.classList.remove('show'); }, 500);
}

async function finishGameOverSequence() {
    isPlaying = false;
    DOM.drawStatus.textContent = '結算中...';
    DOM.outOverlay.classList.add('show');
    await sleep(2000);
    
    if (appleBonusRoundsLeft > 0) {
        appleBonusRoundsLeft--;
        updateMiniGameUI();
        
        if (appleBonusRoundsLeft === 0) {
            let ratio = 0;
            if (miniGameSteps >= 140) ratio = 1;
            else if (miniGameSteps >= 90) ratio = 0.20;
            else if (miniGameSteps >= 50) ratio = 0.10;
            else if (miniGameSteps >= 20) ratio = 0.05;
            else ratio = 0;
            
            let reward = Math.floor(activeJPAmount * ratio);
            if (reward > 0) {
                totalWin += reward;
                updateWinDisplay();
                DOM.drawStatus.textContent = `🎯 JP結算！抵達 ${miniGameSteps} 島，獲得獎金 ${reward} 🎯`;
                await sleep(3000);
            } else {
                DOM.drawStatus.textContent = `🎯 JP結算！未達 20 島，無獎金 🎯`;
                await sleep(2000);
            }
        }
    }
    
    credit += totalWin;
    updateCreditDisplay();
    DOM.btnStart.disabled = false;
    document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = false);
    
    currentBet = 0;
    DOM.betInput.textContent = "0";
    updateLadderRewards(0);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getEngineSpeedMultiplier() {
    let pendingBalls = pendingEventsQueue.filter(e => e.type === 'layer8_hit' || e.type === 'laser_strike').length;
    if (pendingBalls >= 6) return 4;
    if (pendingBalls >= 4) return 3;
    if (pendingBalls >= 2) return 2;
    return 1;
}

async function engineSleep(ms) {
    let speed = getEngineSpeedMultiplier();
    await sleep(ms / speed);
}


function collectApple(type) {
    if (currentAppleColors.length === 7) {
        currentAppleColors = []; 
        currentAppleScores = [];
    }
    
    currentAppleColors.push(type);
    
    let score = 0;
    switch (type) {
        case 'gold': score = currentBet * 2.5; break;
        case 'silver': score = currentBet * 1.5; break;
        case 'bronze': score = currentBet * 1.0; break;
        case 'red': score = currentBet * 0.5; break;
        case 'green': score = currentBet * 0.25; break;
    }
    currentAppleScores.push(score);
    
    totalCollectedApples++;
    
    updateAppleUI();
    DOM.drawStatus.textContent = `🍎 收集到蘋果！`;
    
    if (currentAppleColors.length === 7) {
        let jpScore = currentAppleScores.reduce((a, b) => a + b, 0);
        queuedJPPackages.push(jpScore);
        
        let div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.top = '20%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.background = 'rgba(0,0,0,0.8)';
        div.style.color = '#4ade80';
        div.style.padding = '20px 40px';
        div.style.borderRadius = '20px';
        div.style.fontSize = '2rem';
        div.style.zIndex = '9999';
        div.style.border = '2px solid #4ade80';
        div.style.boxShadow = '0 0 20px #4ade80';
        div.textContent = `🍎 集滿 7 顆！獲得 3 局 JP (獎金 ${jpScore})`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    }
}
