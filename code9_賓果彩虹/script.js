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
let game1Bet = 0;
let game2Bet = 0;
let game3Bet = 0;
let previousGame1Bet = 0;
let previousGame2Bet = 0;
let previousGame3Bet = 0;

let allClearBonusCount = 0;

let historyTracker = {
    red: 0, pink: 0, blue: 0, green: 0, yellow: 0, white: 0, rainbow: 0
};


let appleCount = 0;
const MAX_APPLES = 7;
let appleBonusRoundsLeft = 0;
let miniGameSteps = 0;
let mgPhase = 1; // 1: 0-140, 2: 140-290
const MG_STATIONS_PHASE1 = [0, 20, 50, 90, 140];
const MG_STATIONS_PHASE2 = [140, 170, 200, 230, 260, 290];
function getCurrentStations() {
    return mgPhase === 1 ? MG_STATIONS_PHASE1 : MG_STATIONS_PHASE2;
}
let currentStepMapping = {};
let passedStations = [];
let nextBonusRoundsQueued = false;
let queuedJPPackages = [];
let currentAppleScores = [];
let activeJPAmount = 0;
let currentAppleColors = [];
let totalCollectedApples = 0;

// ** Game 3 (夾夾樂) 狀態 **
let game3TargetColor = 'red'; 
let game3MultiplierArray = []; 
let game3Combo = 0;
let game3MaxMultiplier = 0;
let game3TotalWin = 0;
let game3TotalTargetBalls = 0;
let game3SlotStyles = [];
let game3MaxComboReached = 0;
let game1Win = 0;
let game2Win = 0;

function switchActiveGame(gameId) {
    const games = ['game1', 'game2', 'game3'];
    let miniCount = 0;
    games.forEach(id => {
        const el = document.getElementById(id + '-container');
        if (el) {
            if (id === gameId) {
                el.className = 'game-module active';
                el.style.left = '0px';
                el.style.top = '0px';
            } else {
                el.className = 'game-module mini';
                el.style.left = '103%';
                el.style.top = (miniCount * 210) + 'px';
                miniCount++;
            }
        }
    });
}

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
    btnCycleBet: document.getElementById('btn-cycle-bet'),
    btnStart: document.getElementById('btn-start'),
    betInputs: document.querySelectorAll('.bet-value'),
    betAppleSlots: document.querySelectorAll('.bet-apple-slots'),
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

DOM.btnCycleBet.addEventListener('click', () => {
    if (isPlaying) return;
    currentIncrementIndex = (currentIncrementIndex + 1) % BET_INCREMENTS.length;
    let inc = BET_INCREMENTS[currentIncrementIndex];
    DOM.btnCycleBet.textContent = `切換加分 (+${inc})`;
});

document.querySelectorAll('.btn-add-bet').forEach(btn => {
    btn.addEventListener('click', (e) => {
        let gameId = parseInt(e.currentTarget.getAttribute('data-game'));
        handleAddBet(gameId);
    });
});

function handleAddBet(gameId) {
    if (isPlaying) return;
    let inc = BET_INCREMENTS[currentIncrementIndex];
    if (gameId === 1) {
        if (game1Bet === 0) game1Bet = 600;
        else { game1Bet += inc; if(game1Bet > 3000) game1Bet = 3000; }
        document.querySelectorAll('.bet-value[data-game="1"]').forEach(el => el.textContent = game1Bet);
        updateLadderRewards(game1Bet);
        generateBetApples(1);
    } else if (gameId === 2) {
        if (game2Bet === 0) game2Bet = 600;
        else { game2Bet += inc; if(game2Bet > 3000) game2Bet = 3000; }
        document.querySelectorAll('.bet-value[data-game="2"]').forEach(el => el.textContent = game2Bet);
        generateBetApples(2);
    } else if (gameId === 3) {
        if (game3Bet === 0) game3Bet = 600;
        else { game3Bet += inc; if(game3Bet > 3000) game3Bet = 3000; }
        document.querySelectorAll('.bet-value[data-game="3"]').forEach(el => el.textContent = game3Bet);
        generateBetApples(3);
    }
}

document.getElementById('btn-repeat-bet').addEventListener('click', () => {
    if (isPlaying) return;
    if (previousGame1Bet > 0 || previousGame2Bet > 0 || previousGame3Bet > 0) {
        if (previousGame1Bet > 0) {
            game1Bet = previousGame1Bet;
            document.querySelectorAll('.bet-value[data-game="1"]').forEach(el => el.textContent = game1Bet);
            updateLadderRewards(game1Bet);
            generateBetApples(1);
        }
        if (previousGame2Bet > 0) {
            game2Bet = previousGame2Bet;
            document.querySelectorAll('.bet-value[data-game="2"]').forEach(el => el.textContent = game2Bet);
            generateBetApples(2);
        }
        if (previousGame3Bet > 0) {
            game3Bet = previousGame3Bet;
            document.querySelectorAll('.bet-value[data-game="3"]').forEach(el => el.textContent = game3Bet);
            generateBetApples(3);
        }
    } else {
        alert("沒有上一局的押分紀錄");
    }
});

// ** Game 3 Target Color Selection **
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (isPlaying) return; // Cannot change during game
        document.querySelectorAll('.color-btn').forEach(b => {
            b.classList.remove('active');
            b.style.border = '2px solid transparent';
            b.style.boxShadow = 'none';
        });
        btn.classList.add('active');
        
        // The color maps to the border/shadow color
        const color = btn.dataset.color;
        let borderColor = CSS_VAR_MAP[color] || '#fff';
        
        btn.style.border = `2px solid ${borderColor}`;
        btn.style.boxShadow = `0 0 10px ${borderColor}`;
        
        game3TargetColor = color;
        document.getElementById('g3-target-color-name').textContent = COLOR_ZH[color] || color;
        
        // Change text color in display
        document.getElementById('g3-target-color-name').style.color = (color === 'white') ? '#fff' : borderColor;
        
        // Change Game 3 UI border and shadow
        let game3Inner = document.getElementById('game3-inner');
        if (game3Inner) {
            game3Inner.style.borderColor = borderColor;
            game3Inner.style.boxShadow = `0 0 15px ${borderColor}`;
            game3Inner.style.setProperty('--g3-target-color', borderColor);
        }

        // Change HIT TABLE header background
        let hitTableHeader = document.getElementById('g3-hit-table-header');
        if (hitTableHeader) {
            hitTableHeader.style.background = borderColor;
            hitTableHeader.style.color = (color === 'white' || color === 'yellow') ? '#000' : '#fff';
        }
    });
});

DOM.btnStart.addEventListener('click', startGame);
updateLadderRewards(game1Bet);

// --- Apple & Mini Game Logic ---
DOM.btnDebugApple.addEventListener('click', () => {
    if (game1Bet === 0 && game3Bet === 0) {
        alert('請先點擊下方押注按鈕設定押分！(測試按鈕需要知道押分才能計算蘋果價值)');
        return;
    }
    let appleType = getAppleType();
    if (typeof game1PreApples !== 'undefined' && game1PreApples.length > 0) {
        appleType = game1PreApples[0].type;
    }
    collectApple(appleType);
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
    
    let progressPercent = 0;
    if (mgPhase === 1) {
        progressPercent = Math.min(100, (miniGameSteps / 140) * 100);
    } else {
        let cappedSteps = Math.min(290, miniGameSteps);
        progressPercent = Math.min(100, ((cappedSteps - 140) / 150) * 100);
    }
    
    DOM.mgProgressFill.style.width = progressPercent + '%';
    
    DOM.mgDogCounter.textContent = miniGameSteps;
    DOM.mgDogContainer.style.left = progressPercent + '%';
    
    DOM.mgDog.classList.remove('mg-dog-walk');
    void DOM.mgDog.offsetWidth;
    DOM.mgDog.classList.add('mg-dog-walk');
    
    let stations = getCurrentStations();
    for (let i = 0; i < stations.length; i++) {
        let el = document.getElementById('mg-label-' + i);
        if (el) {
            let st = parseInt(el.textContent.replace('島', ''));
            if (miniGameSteps >= st) el.classList.add('passed');
            else el.classList.remove('passed');
        }
    }
}

async function playDogJumpBackAnimation() {
    DOM.mgDog.style.transform = 'scaleX(1)'; // turn left
    
    let steps = 10;
    for (let i = 0; i <= steps; i++) {
        let pct = 100 - (100 / steps) * i;
        DOM.mgDogContainer.style.left = pct + '%';
        DOM.mgProgressFill.style.width = pct + '%';
        
        DOM.mgDog.style.animation = 'dog-jump-back 0.15s linear';
        await sleep(150);
        DOM.mgDog.style.animation = 'none';
    }
    
    mgPhase = 2;
    document.getElementById('mg-label-0').textContent = '140島';
    
    document.getElementById('mg-label-1').textContent = '170島';
    document.getElementById('mg-label-1').setAttribute('data-station', '170');
    document.getElementById('mg-label-1').style.left = '20%';
    document.getElementById('mg-marker-1').setAttribute('data-station', '170');
    document.getElementById('mg-marker-1').style.left = '20%';
    
    document.getElementById('mg-label-2').textContent = '200島';
    document.getElementById('mg-label-2').setAttribute('data-station', '200');
    document.getElementById('mg-label-2').style.left = '40%';
    document.getElementById('mg-marker-2').setAttribute('data-station', '200');
    document.getElementById('mg-marker-2').style.left = '40%';
    
    document.getElementById('mg-label-3').textContent = '230島';
    document.getElementById('mg-label-3').setAttribute('data-station', '230');
    document.getElementById('mg-label-3').style.left = '60%';
    document.getElementById('mg-marker-3').setAttribute('data-station', '230');
    document.getElementById('mg-marker-3').style.left = '60%';
    
    let extraLabel = document.getElementById('mg-label-extra');
    if (extraLabel) {
        extraLabel.classList.remove('hidden');
        extraLabel.textContent = '260島';
        extraLabel.style.left = '80%';
    }
    let extraMarker = document.getElementById('mg-marker-extra');
    if (extraMarker) {
        extraMarker.classList.remove('hidden');
        extraMarker.style.left = '80%';
    }
    
    document.getElementById('mg-label-4').textContent = '290島';
    
    await sleep(200);
    DOM.mgDog.style.transform = 'scaleX(-1)'; // turn right
    updateMiniGameUI();
}

function resetMiniGamePhase1UI() {
    mgPhase = 1;
    document.getElementById('mg-label-0').textContent = '0島';
    
    document.getElementById('mg-label-1').textContent = '20島';
    document.getElementById('mg-label-1').setAttribute('data-station', '20');
    document.getElementById('mg-label-1').style.left = '14.28%';
    document.getElementById('mg-marker-1').setAttribute('data-station', '20');
    document.getElementById('mg-marker-1').style.left = '14.28%';
    
    document.getElementById('mg-label-2').textContent = '50島';
    document.getElementById('mg-label-2').setAttribute('data-station', '50');
    document.getElementById('mg-label-2').style.left = '35.71%';
    document.getElementById('mg-marker-2').setAttribute('data-station', '50');
    document.getElementById('mg-marker-2').style.left = '35.71%';
    
    document.getElementById('mg-label-3').textContent = '90島';
    document.getElementById('mg-label-3').setAttribute('data-station', '90');
    document.getElementById('mg-label-3').style.left = '64.28%';
    document.getElementById('mg-marker-3').setAttribute('data-station', '90');
    document.getElementById('mg-marker-3').style.left = '64.28%';
    
    document.getElementById('mg-label-4').textContent = '140島';
    
    let extraLabel = document.getElementById('mg-label-extra');
    if (extraLabel) extraLabel.classList.add('hidden');
    let extraMarker = document.getElementById('mg-marker-extra');
    if (extraMarker) extraMarker.classList.add('hidden');
}


async function jumpToNextIsland() {
    let oldSteps = miniGameSteps;
    let stations = getCurrentStations();
    let nextStation = stations[stations.length - 1];
    
    for (let st of stations) {
        if (st > miniGameSteps) {
            nextStation = st;
            break;
        }
    }
    miniGameSteps = nextStation;
    updateMiniGameUI();
    
    if (mgPhase === 1 && oldSteps < 140 && miniGameSteps === 140) {
        DOM.drawStatus.textContent = '🎉 恭喜達成 JP 遊戲 🎉';
        await sleep(1000);
        DOM.outOverlay.classList.remove('show');
        await playDogJumpBackAnimation();
    } else if (mgPhase === 2 && oldSteps < 290 && miniGameSteps === 290) {
        DOM.drawStatus.textContent = '🏆 抵達終極 290 島！ 🏆';
        await sleep(1000);
    }
    
    await sleep(500);
}

async function applyMiniGameSteps(steps) {
    if (steps <= 0) return;
    
    let oldSteps = miniGameSteps;
    let targetSteps = miniGameSteps + steps;
    
    if (mgPhase === 1 && oldSteps < 140 && targetSteps > 140) {
        targetSteps = 140; // clamp at 140
    }
    
    miniGameSteps = targetSteps;
    updateMiniGameUI();
    
    if (mgPhase === 1 && oldSteps < 140 && miniGameSteps === 140) {
        DOM.drawStatus.textContent = '🎉 恭喜達成 JP 遊戲 🎉';
        await sleep(1000);
        await playDogJumpBackAnimation();
    } else {
        let currentExactStations = getCurrentStations();
        if (currentExactStations.includes(miniGameSteps) && miniGameSteps !== 0 && miniGameSteps !== 140 && miniGameSteps !== 290) {
            DOM.drawStatus.textContent = `精準抵達 ${miniGameSteps} 島！直達下一島嶼！`;
            await sleep(1000);
            await jumpToNextIsland();
        } else if (miniGameSteps === 290 && oldSteps < 290) {
            DOM.drawStatus.textContent = '🏆 抵達終極 290 島！ 🏆';
            await sleep(1000);
        }
    }
    
    await sleep(200);
}

function updateLadderRewards(bet) {
    for (let chain = 4; chain <= 10; chain++) {
        let el = document.getElementById(`reward-${chain}`);
        if (el) {
            el.textContent = Math.floor(bet * COMBO_MULTIPLIERS[chain]);
        }
    }
    let acEl = document.getElementById('all-clear-reward');
    if (acEl) {
        acEl.textContent = Math.floor(bet * 30);
    }
}

let bonusWin = 0;

function updateCreditDisplay() { DOM.credit.textContent = credit; }
function updateWinDisplay() { DOM.win.textContent = totalWin; }

function recalculateTotalWin() {
    let g1 = game1Bet > 0 ? game1Win : 0;
    let g2 = game2Bet > 0 ? game2Win : 0;
    let g3 = game3Bet > 0 ? game3TotalWin : 0;
    totalWin = g1 + g2 + g3 + bonusWin;
    updateWinDisplay();
}

function triggerClawDropAnimation() {
    const clawAssy = document.getElementById('g3-claw-assembly');
    const rope = document.getElementById('g3-rope');
    if (clawAssy && rope) {
        clawAssy.classList.remove('claw-grabbing');
        rope.classList.remove('rope-stretching');
        
        void clawAssy.offsetWidth; // Force reflow
        
        clawAssy.classList.add('claw-grabbing');
        rope.classList.add('rope-stretching');
        
        setTimeout(() => {
            clawAssy.classList.remove('claw-grabbing');
            rope.classList.remove('rope-stretching');
        }, 1300);
    }
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

function updateGame1WinDisplay() {
    const badge = document.getElementById('game1-win-badge');
    const text = document.getElementById('game1-win-text');
    if (badge && text) {
        if (game1Bet > 0 && isPlaying) {
            badge.classList.remove('hidden');
            text.textContent = game1Win;
        } else {
            badge.classList.add('hidden');
        }
    }
}

function updateGame3WinDisplay() {
    const badge = document.getElementById('game3-win-badge');
    const text = document.getElementById('game3-win-text');
    if (badge && text) {
        if (game3Bet > 0 && isPlaying) {
            badge.classList.remove('hidden');
            text.textContent = game3TotalWin;
        } else {
            badge.classList.add('hidden');
        }
    }
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
    
    const initialMoneyValue = Math.floor((game1Bet === 0 ? 600 : game1Bet) / 5);
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
let game1PreApples = [];
let game3PreApples = [];

function getUpgradeProb(bet) {
    if (bet <= 650) return 0.10;
    if (bet <= 700) return 0.20;
    if (bet <= 750) return 0.30;
    if (bet <= 800) return 0.40;
    if (bet <= 850) return 0.50;
    if (bet <= 900) return 0.60;
    if (bet <= 950) return 0.70;
    if (bet <= 1000) return 0.80;
    if (bet <= 1050) return 0.90;
    if (bet <= 1100) return 0.95;
    return 1.0;
}

function upgradeApple(type) {
    switch (type) {
        case 'green': return 'red';
        case 'red': return 'bronze';
        case 'bronze': return 'silver';
        case 'silver': return 'gold';
        case 'gold': return 'gold';
        default: return type;
    }
}

function generateBetApples(gameId) {
    let container = document.querySelector(`.bet-apple-slots[data-game="${gameId}"]`);
    if (!container) return;
    
    let currentBet = gameId === 1 ? game1Bet : game3Bet;
    let preGenerated = gameId === 1 ? game1PreApples : game3PreApples;

    if (currentBet === 0) {
        if (gameId === 1) game1PreApples = [];
        else game3PreApples = [];
        
        let slots = container.querySelectorAll('.apple-slot');
        slots.forEach(slot => {
            slot.innerHTML = `<span style="filter: grayscale(1) opacity(0.5); font-size: 1.8rem; line-height: 1;">🍎</span>`;
        });
        return;
    }

    let prob3Apples = 0.90;
    if (currentBet > 900) {
        prob3Apples += Math.floor((currentBet - 900) / 10) * 0.005;
    }
    if (currentBet >= 1100) prob3Apples = 1.0;
    
    let targetCount = Math.random() < prob3Apples ? 3 : 2;
    
    if (preGenerated.length === 0) {
        for (let i = 0; i < targetCount; i++) {
            let type = getAppleType();
            let hp = Math.floor(Math.random() * 10) + 6;
            preGenerated.push({ type, hp });
        }
    } else {
        let upgradeProb = getUpgradeProb(currentBet);
        for (let i = 0; i < preGenerated.length; i++) {
            if (Math.random() < upgradeProb) {
                preGenerated[i].type = upgradeApple(preGenerated[i].type);
            }
        }
        
        if (preGenerated.length === 2 && targetCount === 3) {
            let type = getAppleType();
            let hp = Math.floor(Math.random() * 10) + 6;
            preGenerated.push({ type, hp });
        }
    }
    
    let slots = container.querySelectorAll('.apple-slot');
    slots.forEach((slot, index) => {
        slot.innerHTML = '';
        if (index < preGenerated.length) {
            let a = preGenerated[index];
            let appleEl = document.createElement('div');
            appleEl.className = `apple-item apple-${a.type}`;
            appleEl.innerHTML = `🍎<span class="apple-num" style="display:none;">${a.hp}</span>`;
            appleEl.style.fontSize = '1.8rem';
            appleEl.style.margin = '0';
            slot.appendChild(appleEl);
        } else {
            slot.innerHTML = `<span style="filter: grayscale(1) opacity(0.5); font-size: 1.8rem; line-height: 1;">🍎</span>`;
        }
    });
}

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
    
    let availableSlots = [];
    for (let i = 0; i < slotsArray.length; i++) {
        if (i !== beakIndex) availableSlots.push(slotsArray[i]);
    }
    availableSlots.sort(() => Math.random() - 0.5);
    
    let applesToSpawn = game1PreApples.length > 0 ? game1PreApples : [];
    if (applesToSpawn.length === 0) {
        let count = Math.random() < 0.1 ? 2 : 3;
        for (let i = 0; i < count; i++) {
            applesToSpawn.push({ type: getAppleType(), hp: Math.floor(Math.random() * 10) + 6 });
        }
    }
    
    for (let i = 0; i < applesToSpawn.length && i < availableSlots.length; i++) {
        let appleData = applesToSpawn[i];
        let appleEl = document.createElement('div');
        appleEl.className = `apple-item apple-${appleData.type}`;
        appleEl.innerHTML = `🍎<span class="apple-num">${appleData.hp}</span>`;
        availableSlots[i].appendChild(appleEl);
        
        let colIndex = slotsArray.indexOf(availableSlots[i]);
        topApplesState[colIndex] = {
            type: appleData.type,
            hp: appleData.hp,
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

function calculateGame2TotalPayout(bet, totalLines) {
    if (bet <= 0 || totalLines <= 0) return 0;
    let baseLineValue = bet * 0.2; // 壓分 * 1/5
    let totalWin = 0;
    for (let i = 1; i <= totalLines; i++) {
        let tierMultiplier = Math.floor((i - 1) / 10) + 1; // 1~10條: 1倍, 11~20條: 2倍, 21~30條: 3倍...
        totalWin += baseLineValue * tierMultiplier;
    }
    return Math.floor(totalWin);
}

function updateGame2WinDisplay() {
    const badge = document.getElementById('game2-win-badge');
    const txt = document.getElementById('game2-win-text');
    if (badge && txt) {
        if (game2Win > 0 && game2Bet > 0) {
            badge.classList.remove('hidden');
            txt.textContent = game2Win;
        } else {
            badge.classList.add('hidden');
        }
    }
}

// LV1 ~ LV8 & LV MAX (LV9) 模板數據
const G2_TEMPLATES = {
    1: [
        ['SP', 'c1', 'c2', 'SP', 'SP', 'c3', 'c4', 'c5', 'FREE'],
        ['SP', 'c1', 'c1', 'c4', 'SP', 'c2', 'c4', 'c3', 'FREE']
    ],
    2: [
        ['c4', 'c3', 'c1', 'c2', 'SP', 'c2', 'c5', 'c1', 'FREE'],
        ['c2', 'c3', 'c4', 'c1', 'SP', 'c2', 'c5', 'c1', 'FREE'],
        ['c1', 'c2', 'c3', 'FREE', 'SP', 'c4', 'c5', 'SP', 'FREE']
    ],
    3: [
        ['c1', 'FREE', 'c2', 'FREE', 'SP', 'FREE', 'c4', 'FREE', 'c3'],
        ['c4', 'c3', 'c3', 'c1', 'c1', 'c2', 'c5', 'c2', 'c4']
    ],
    4: [
        ['c1', 'c2', 'c3', 'c5', 'c1', 'c4', 'c4', 'c3', 'c2'],
        ['c1', 'c2', 'c2', 'c2', 'c3', 'c4', 'c1', 'c2', 'c3']
    ],
    5: [
        ['c2', 'FREE', 'c1', 'FREE', 'SP', 'FREE', 'c1', 'FREE', 'c3'],
        ['c3', 'c1', 'c1', 'c2', 'c1', 'c2', 'c5', 'c2', 'c4']
    ],
    6: [
        ['FREE', 'c1', 'c2', 'FREE', 'SP', 'FREE', 'c4', 'c3', 'FREE'],
        ['c3', 'c2', 'c2', 'c2', 'c1', 'c1', 'c3', 'c2', 'c1']
    ],
    7: [
        ['FREE', 'c2', 'FREE', 'c1', 'FREE', 'c1', 'SP', 'c4', 'c3']
    ],
    8: [
        ['c1', 'c1', 'c1', 'c1', 'SP', 'c1', 'c1', 'c1', 'c1'],
        ['c2', 'c1', 'c2', 'c1', 'c2', 'c1', 'c2', 'c1', 'c2']
    ],
    9: [ // LV MAX
        ['c1', 'c1', 'c1', 'c1', 'c1', 'c1', 'c1', 'c1', 'c1']
    ]
};

// 遊戲 2 權重機率抽卡（第2張備用盤起算）
function getRandomGame2Level() {
    let r = Math.random() * 100;
    if (r < 20) return 1;       // LV1: 20%
    else if (r < 40) return 2;  // LV2: 20%
    else if (r < 55) return 3;  // LV3: 15%
    else if (r < 70) return 4;  // LV4: 15%
    else if (r < 80) return 5;  // LV5: 10%
    else if (r < 90) return 6;  // LV6: 10%
    else if (r < 95) return 7;  // LV7: 5%
    else if (r < 98) return 8;  // LV8: 3%
    else return 9;              // LV MAX (LV9): 2%
}

const Game2Manager = {
    gridData: [],
    nextGridData: [],
    nextGridDataFull: [],
    nextLevel: 2,

    init() {
        game2Level = 1;
        game2CardNum = 1;
        game2Win = 0;
        game2LineCount = 0;
        this.generateCard(1); // 初始主體固定為 LV1 模板
        let firstNextLvl = Math.floor(Math.random() * 3) + 1; // 第一張備用棋盤固定在 LV1~LV3 隨機
        this.generateNextCard(firstNextLvl);
        this.renderUI();
        updateGame2WinDisplay();
    },

    generateCard(level) {
        let lvlKey = level >= 9 ? 9 : Math.max(1, level);
        let tList = G2_TEMPLATES[lvlKey] || G2_TEMPLATES[1];
        let tLayout = tList[Math.floor(Math.random() * tList.length)];

        // 顏色1~5 隨機分配不重複 (從 黃、藍、紅、綠、粉 5 種色球中抽出，不包含白)
        let allColors = ['yellow', 'blue', 'red', 'green', 'pink'];
        allColors.sort(() => Math.random() - 0.5);
        let colorMap = {
            'c1': allColors[0],
            'c2': allColors[1],
            'c3': allColors[2],
            'c4': allColors[3],
            'c5': allColors[4]
        };

        this.gridData = [];
        for (let i = 0; i < 9; i++) {
            let key = tLayout[i];
            if (key === 'FREE') {
                this.gridData.push({
                    id: i,
                    type: 'free',
                    color: 'purple',
                    spText: 'FREE',
                    hit: true // FREE 預設即獲得
                });
            } else if (key === 'SP') {
                this.gridData.push({
                    id: i,
                    type: 'sp',
                    color: 'sp',
                    spText: 'SP',
                    hit: false
                });
            } else {
                let assignedColor = colorMap[key];
                this.gridData.push({
                    id: i,
                    type: 'color',
                    color: assignedColor,
                    spText: key,
                    hit: false
                });
            }
        }
    },

    generateNextCard(level) {
        this.nextLevel = level >= 9 ? 9 : Math.max(1, level);
        let lvlKey = this.nextLevel;
        let tList = G2_TEMPLATES[lvlKey] || G2_TEMPLATES[1];
        let tLayout = tList[Math.floor(Math.random() * tList.length)];
        let allColors = ['yellow', 'blue', 'red', 'green', 'pink'];
        allColors.sort(() => Math.random() - 0.5);
        let colorMap = {
            'c1': allColors[0], 'c2': allColors[1], 'c3': allColors[2], 'c4': allColors[3], 'c5': allColors[4]
        };

        this.nextGridData = [];
        this.nextGridDataFull = [];

        for (let i = 0; i < 9; i++) {
            let key = tLayout[i];
            if (key === 'FREE') {
                this.nextGridData.push({ color: 'purple' });
                this.nextGridDataFull.push({
                    id: i, type: 'free', color: 'purple', spText: 'FREE', hit: true
                });
            } else if (key === 'SP') {
                this.nextGridData.push({ color: 'sp' });
                this.nextGridDataFull.push({
                    id: i, type: 'sp', color: 'sp', spText: 'SP', hit: false
                });
            } else {
                let assignedColor = colorMap[key];
                this.nextGridData.push({ color: assignedColor });
                this.nextGridDataFull.push({
                    id: i, type: 'color', color: assignedColor, spText: key, hit: false
                });
            }
        }
        const nextLvlEl = document.getElementById('g2-next-level');
        if (nextLvlEl) nextLvlEl.textContent = (this.nextLevel >= 9 ? 'MAX' : this.nextLevel);
        this.renderNextGrid();
    },

    renderNextGrid() {
        const container = document.getElementById('g2-next-grid');
        if (!container) return;
        container.innerHTML = '';
        this.nextGridData.forEach(t => {
            const d = document.createElement('div');
            d.className = `g2-mini-tile ${t.color}`;
            container.appendChild(d);
        });
    },

    renderUI() {
        const gridEl = document.getElementById('game2-grid');
        if (!gridEl) return;
        gridEl.innerHTML = '';

        const mainLvlEl = document.getElementById('g2-main-level');
        const cardNumEl = document.getElementById('g2-card-num-text');
        const lineCountEl = document.getElementById('g2-line-count');
        const lineScoreEl = document.getElementById('g2-line-score');

        if (mainLvlEl) mainLvlEl.textContent = (game2Level >= 9 ? 'MAX' : game2Level);
        if (cardNumEl) cardNumEl.textContent = `第 ${game2CardNum} 張`;
        if (lineCountEl) lineCountEl.textContent = game2LineCount;
        if (lineScoreEl) lineScoreEl.textContent = game2Win;

        this.gridData.forEach(tile => {
            const div = document.createElement('div');
            let isRainbowBorder = (tile.type === 'free' || tile.type === 'sp' || tile.color === 'sp' || tile.color === 'purple');

            if (tile.hit) {
                div.className = `g2-tile hit ${isRainbowBorder ? 'rainbow-border' : tile.color}`;
                if (!isRainbowBorder) {
                    div.style.borderColor = `var(--color-${tile.color}, #facc15)`;
                } else {
                    div.style.borderColor = 'transparent';
                }
                div.innerHTML = `<span class="g2-hit-text" style="font-size: 1.6rem; font-weight: 900; color: #facc15; text-shadow: 0 0 8px #facc15, 2px 2px 0 #000;">HIT</span>`;
            } else {
                div.className = `g2-tile ${tile.color}`;
                if (tile.type === 'sp') {
                    div.innerHTML = `<div class="g2-sp-badge">SP</div>`;
                } else if (tile.type === 'free') {
                    div.innerHTML = `<span class="g2-free-text">FREE</span>`;
                } else {
                    div.innerHTML = `<div class="g2-paw-icon">🐾</div>`;
                }
            }
            gridEl.appendChild(div);
        });
    },

    processBall(logicalColor, isBatchMode = false) {
        if (!this.gridData || this.gridData.length === 0) return;

        let hitMade = false;
        this.gridData.forEach(tile => {
            if (!tile.hit) {
                if (logicalColor === 'rainbow') {
                    // 彩色洞：觸發 SP / JP 格子 hit!
                    if (tile.type === 'sp' || tile.color === 'sp') {
                        tile.hit = true;
                        hitMade = true;
                    }
                } else if (tile.color === logicalColor) {
                    // 對應顏色進洞：觸發該顏色的格子 hit!
                    tile.hit = true;
                    hitMade = true;
                }
            }
        });

        if (hitMade) {
            this.renderUI();
        }

        // 如果不是 3球批次模式，單球進洞時直接進行連線與銷毀檢定
        if (!isBatchMode) {
            this.evaluateLineCheck();
        }
    },

    evaluateLineCheck() {
        const linePatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        let completedLines = 0;
        linePatterns.forEach(pattern => {
            if (pattern.every(idx => this.gridData[idx] && this.gridData[idx].hit)) {
                completedLines++;
            }
        });

        if (completedLines > 0) {
            // 在一局內，連線數累加
            game2LineCount += completedLines;

            if (game2Bet > 0) {
                game2Win = calculateGame2TotalPayout(game2Bet, game2LineCount);
                updateGame2WinDisplay();
                recalculateTotalWin();
            }

            if (game2LineCount >= 3 && game2Bet > 0) {
                collectApple(game2LineCount >= 4 ? 'red' : 'green', game2Bet);
            }

            // 觸發主體銷毀與備用棋盤補充
            this.triggerCardDestructionAndNextDrop();
        }
    },

    triggerCardDestructionAndNextDrop() {
        const frameEl = document.querySelector('.g2-card-frame');
        if (frameEl) {
            frameEl.classList.add('g2-card-destroying');
        }

        setTimeout(() => {
            if (frameEl) frameEl.classList.remove('g2-card-destroying');

            // 備用棋盤下降補充成為主體棋盤
            game2CardNum++;
            game2Level = this.nextLevel;
            this.gridData = this.nextGridDataFull;

            // 第二張開始的備用棋盤，依據設定的權重機率抽 LV1 ~ LV MAX
            let newNextLevel = getRandomGame2Level();
            this.generateNextCard(newNextLevel);

            // 重新渲染UI (保留本局累加連線數與獎金)
            this.renderUI();
        }, 500);
    }
};

const Game3Manager = {
    initNewGame() {
        game3Combo = 0;
        game3MaxMultiplier = 0;
        game3TotalWin = 0;
        updateGame3WinDisplay();
        game3TotalTargetBalls = 0;
        game3MaxComboReached = 0;
        game3ApplesInPlay = [];
        let applesToSpawn = game3PreApples.map(a => a.type);
        if (applesToSpawn.length > 0 && game3Bet > 0) {
            let startHitMin = game3TargetColor === 'white' ? 2 : 3;
            let startHitMax = game3TargetColor === 'white' ? 5 : 7;
            
            let offsets = [0];
            if (applesToSpawn.length >= 2) {
                offsets.push(offsets[0] + (Math.random() < 0.20 ? 2 : 1));
            }
            if (applesToSpawn.length >= 3) {
                offsets.push(offsets[1] + (Math.random() < 0.20 ? 2 : 1));
            }
            
            let maxOffset = offsets[offsets.length - 1];
            let maxX = 7 - maxOffset;
            if (maxX > startHitMax) maxX = startHitMax;
            if (maxX < startHitMin) maxX = startHitMin;
            
            let x = Math.floor(Math.random() * (maxX - startHitMin + 1)) + startHitMin;
            
            for (let i = 0; i < applesToSpawn.length; i++) {
                game3ApplesInPlay.push({ hit: x + offsets[i], type: applesToSpawn[i] });
            }
        }
        game3CurrentComboColor = null;
        game3TrailingRainbows = 0;
        game3SlotStyles = [];
        game3MultiplierArray = new Array(9).fill(null);
        
        let startSlot = 0;
        let startMultiplier = 0;
        
        if (game3TargetColor === 'white') {
            startSlot = Math.floor(Math.random() * 5) + 1; // 1~5 (第2~6格)
            startMultiplier = 2.0;
        } else {
            startSlot = Math.floor(Math.random() * 4) + 2; // 2~5 (第3~6格)
            startMultiplier = Math.random() < 0.2 ? 1.5 : 2.0;
        }
        
        game3MultiplierArray[8] = 50.0;
        
        let currentM = startMultiplier;
        for (let i = startSlot; i < 8; i++) {
            game3MultiplierArray[i] = currentM;
            currentM += 1.0;
            if (currentM > 2.0) {
                currentM = Math.floor(currentM); // drop decimals after 2
            }
        }
        
        this.updateUI();
        this.updateHitTable();
    },
    
    processBall(color, isRainbow = false, dualPair = null) {
        let logicalColor = color;
        let matchFound = false;

        if (isRainbow) {
            matchFound = true;
            logicalColor = Array.isArray(game3CurrentComboColor) ? game3CurrentComboColor[0] : (game3CurrentComboColor || (game3Bet === 0 ? 'red' : game3TargetColor));
        } else if (dualPair) {
            if (game3CurrentComboColor) {
                if (Array.isArray(game3CurrentComboColor)) {
                    let common = dualPair.filter(c => game3CurrentComboColor.includes(c));
                    if (common.length > 0) {
                        matchFound = true;
                        logicalColor = common[0];
                    }
                } else {
                    if (dualPair.includes(game3CurrentComboColor)) {
                        matchFound = true;
                        logicalColor = game3CurrentComboColor;
                    }
                }
            }
        } else {
            if (game3CurrentComboColor) {
                if (Array.isArray(game3CurrentComboColor)) {
                    if (game3CurrentComboColor.includes(color)) {
                        matchFound = true;
                        logicalColor = color;
                    }
                } else {
                    if (color === game3CurrentComboColor) {
                        matchFound = true;
                        logicalColor = color;
                    }
                }
            }
        }

        if (matchFound || game3CurrentComboColor === null) {
            if (game3CurrentComboColor === null) {
                if (isRainbow) {
                    game3CurrentComboColor = (game3Bet === 0 ? 'red' : game3TargetColor);
                } else if (dualPair) {
                    game3CurrentComboColor = dualPair;
                } else {
                    game3CurrentComboColor = color;
                }
            } else {
                game3CurrentComboColor = logicalColor;
            }
            game3Combo++;
        } else {
            let previousTrailing = game3TrailingRainbows;
            
            if (dualPair) {
                game3CurrentComboColor = dualPair;
                logicalColor = dualPair[0];
            } else {
                game3CurrentComboColor = color;
                logicalColor = color;
            }
            game3Combo = previousTrailing + 1;
            
            for (let i = 0; i < previousTrailing; i++) {
                game3SlotStyles[i] = {
                    bg: 'linear-gradient(45deg, red, orange, yellow, #22c55e, #3b82f6, #a855f7)',
                    shadow: '#fff'
                };
            }
        }
        
        if (isRainbow) {
            game3TrailingRainbows++;
        } else {
            game3TrailingRainbows = 0;
        }

        let styleObj = { bg: '', shadow: '' };
        if (isRainbow) {
            styleObj.bg = 'linear-gradient(45deg, red, orange, yellow, #22c55e, #3b82f6, #a855f7)';
            styleObj.shadow = '#fff';
        } else if (dualPair) {
            styleObj.bg = `linear-gradient(45deg, var(--color-${dualPair[0]}) 50%, var(--color-${dualPair[1]}) 50%)`;
            styleObj.shadow = `var(--color-${logicalColor})`;
        } else {
            styleObj.bg = `var(--color-${logicalColor})`;
            styleObj.shadow = `var(--color-${logicalColor})`;
        }
        game3SlotStyles[game3Combo - 1] = styleObj;

        if (game3Combo > game3MaxComboReached) {
            game3MaxComboReached = game3Combo;
        }

        let currentM = 1.0;
        if (game3Combo > 9) {
            currentM = 50.0;
        } else {
            let slotVal = game3MultiplierArray[game3Combo - 1];
            if (slotVal !== null) {
                currentM = slotVal;
            }
        }

        if (currentM > game3MaxMultiplier) {
            game3MaxMultiplier = currentM;
        }

        if (!isRainbow && (logicalColor === (game3Bet === 0 ? 'red' : game3TargetColor) || (dualPair && dualPair.includes(game3Bet === 0 ? 'red' : game3TargetColor)))) {
            game3TotalTargetBalls++;
            triggerClawDropAnimation();
            
            let collectedIndex = game3ApplesInPlay.findIndex(a => a.hit === game3TotalTargetBalls);
            if (collectedIndex !== -1 && game3Bet > 0) {
                let collectedApple = game3ApplesInPlay.splice(collectedIndex, 1)[0];
                collectApple(collectedApple.type, game3Bet);
                DOM.drawStatus.textContent = `🎯 夾中蘋果！已存入蘋果進度表！ 🎯`;
                this.updateHitTable();
            }
        }

        let effTarget = game3Bet === 0 ? 'red' : game3TargetColor;
        let effBet = game3Bet === 0 ? 600 : game3Bet;
        let baseRate = (effTarget === 'white') ? 1.0 : 0.5;
        let maxM = game3MaxMultiplier > 0 ? game3MaxMultiplier : 1.0;
        game3TotalWin = Math.floor((effBet * baseRate) * maxM) * Math.max(0, game3TotalTargetBalls - 1);
        updateGame3WinDisplay();
        recalculateTotalWin();

        this.updateUI();
        this.updateHitTable();
    },
    
    updateUI() {
        const slots = document.querySelectorAll('#game3-top-track .g3-slot');
        slots.forEach((el, index) => {
            el.classList.remove('active', 'achieved');
            el.style.removeProperty('--slot-bg');
            el.style.removeProperty('--slot-shadow');
            
            if (index < 8) {
                let val = game3MultiplierArray[index];
                el.textContent = val !== null ? `x${val}` : '';
            } else if (index === 8) {
                el.textContent = 'x50';
            }
            
            // Permanently clear text for any slot that has been reached
            if (index < game3MaxComboReached) {
                el.textContent = '';
            }
            
            if (index < game3Combo - 1) {
                el.classList.add('achieved');
                if (game3SlotStyles[index] && game3SlotStyles[index].bg) {
                    el.style.setProperty('--slot-bg', game3SlotStyles[index].bg);
                    el.style.setProperty('--slot-shadow', game3SlotStyles[index].shadow);
                }
            } else if (index === game3Combo - 1 && game3Combo > 0) {
                el.classList.add('active');
                if (game3SlotStyles[index] && game3SlotStyles[index].bg) {
                    el.style.setProperty('--slot-bg', game3SlotStyles[index].bg);
                    el.style.setProperty('--slot-shadow', game3SlotStyles[index].shadow);
                }
            }
        });
    },
    
    updateHitTable() {
        let startHit = Math.max(1, game3TotalTargetBalls);
        let effTarget = game3Bet === 0 ? 'red' : game3TargetColor;
        let effBet = game3Bet === 0 ? 600 : game3Bet;
        let baseRate = (effTarget === 'white') ? 1.0 : 0.5;
        let maxM = game3MaxMultiplier > 0 ? game3MaxMultiplier : 1.0;
        
        for (let i = 1; i <= 8; i++) {
            let row = document.getElementById(`g3-hit-${i}`);
            if (!row) continue;
            
            let currentBalls = startHit + (i - 1);
            let lbl = row.querySelector('.hit-lbl');
            if (lbl) lbl.textContent = currentBalls;
            
            let valEl = row.querySelector('.hit-val');
            
            let appleSlot = document.getElementById(`g3-apple-slot-${i}`);
            if (appleSlot) {
                let appleData = game3ApplesInPlay.find(a => a.hit === currentBalls);
                if (appleData) {
                    appleSlot.innerHTML = `<span class="apple-item apple-${appleData.type}" style="font-size: 1.5rem; display: block; animation: float 2s infinite ease-in-out;">🍎</span>`;
                } else {
                    appleSlot.innerHTML = '';
                }
            }
            
            if (valEl) {
                if (currentBalls === 1) {
                    valEl.textContent = 'OPEN';
                } else {
                    let score = Math.floor((effBet * baseRate) * maxM) * (currentBalls - 1);
                    valEl.textContent = score;
                }
            }
            
            if (i === 1 && game3TotalTargetBalls > 0) {
                row.classList.add('active');
            } else {
                row.classList.remove('active');
            }
        }
    }
};

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
        resetMiniGamePhase1UI();
        
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
    
    if (game1Bet === 0 && game2Bet === 0 && game3Bet === 0) {
        alert("請先押分！");
        return;
    }
    if (credit < (game1Bet + game2Bet + game3Bet)) {
        alert("餘額不足！");
        return;
    }
    previousGame1Bet = game1Bet;
    previousGame2Bet = game2Bet;
    previousGame3Bet = game3Bet;
    credit -= (game1Bet + game2Bet + game3Bet);
    updateCreditDisplay();
    
    isPlaying = true;
    game1Win = 0;
    game2Win = 0;
    bonusWin = 0;
    ballCount = 0;
    currentCombo = 0;
    allClearBonusCount = 0;
    batchEliminatedAny = false;
    DOM.ballCountText.textContent = ballCount;
    isGameOverTriggered = false;
    pendingEventsQueue = [];
    boardState = 'IDLE';
    
    // 初始化 Game 2 (連連樂) 與 Game 3 (夾夾樂)
    Game2Manager.init();
    Game3Manager.initNewGame();
    
    historyTracker = { red: 0, pink: 0, blue: 0, green: 0, yellow: 0, white: 0, rainbow: 0 };
    recalculateTotalWin();
    updateGame1WinDisplay();
    updateGame2WinDisplay();
    updateGame3WinDisplay();
    updateLadderRewards(game1Bet === 0 ? 600 : game1Bet);
    updateLadderActive(0);
    updateHistoryUI();
    
    DOM.btnStart.disabled = true;
    document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = true);
    document.querySelectorAll('.color-btn').forEach(btn => btn.style.pointerEvents = 'none'); // 禁用選色
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

async function shootBallAsync(isSafeMode, isBatchMode = false) {
    let baseDraw = ALL_DRAW_OPTIONS[Math.floor(Math.random() * ALL_DRAW_OPTIONS.length)];
    
    if (baseDraw === 'white') {
        await spawnAndSpinBall('white', false);
        historyTracker.white++;
        addBallToHistoryUI('白色', 'white');
        Game2Manager.processBall('white', isBatchMode); // Game 2
        Game3Manager.processBall('white'); // Game 3
        
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
            
            Game2Manager.processBall('rainbow', isBatchMode); // Game 2
            Game3Manager.processBall(game3TargetColor, true, null); // Game 3 rainbow wildcard
            
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
            
            // Game 2 and Game 3 processing for dual colors
            Game2Manager.processBall(pair[0], isBatchMode);
            Game2Manager.processBall(pair[1], isBatchMode);
            Game3Manager.processBall(null, false, pair);
            
            pendingEventsQueue.push({ type: 'layer8_hit', colors: pair });
            DOM.drawStatus.textContent = '小轉盤：同步消除雙色！';
            return 'sp';
        }
    } else {
        let color = baseDraw;
        await spawnAndSpinBall(color, false);
        historyTracker[color]++;
        addBallToHistoryUI(COLOR_ZH[color], color);
        Game2Manager.processBall(color, isBatchMode); // Game 2
        Game3Manager.processBall(color); // Game 3
        
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
                        
                        let p = shootBallAsync(isSafeMode, true).then(res => {
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

                    // 批次發球 (初始 3球 / JP 3球) 全部進洞後，統一對 Game 2 進行連線、銷毀與補充檢定！
                    Game2Manager.evaluateLineCheck();
                    
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
                                if (game1Bet > 0) {
                                    game1Win += block.moneyValue;
                                    updateGame1WinDisplay();
                                    recalculateTotalWin();
                                }
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
                if (game1Bet > 0) {
                    game1Win += block.moneyValue;
                    updateGame1WinDisplay();
                    recalculateTotalWin();
                }
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
                let bonus = (game1Bet === 0 ? 600 : game1Bet) * 30;
                if (game1Bet > 0) {
                    game1Win += bonus;
                    updateGame1WinDisplay();
                    recalculateTotalWin();
                }
                DOM.drawStatus.textContent = `🎊 全盤清除！額外獲得 ${bonus} 🎊`;
                
                let gameBoardEl = document.getElementById('game-board');
                gameBoardEl.classList.add('all-clear-shake');
                
                let acOverlay = document.createElement('div');
                acOverlay.className = 'all-clear-overlay';
                acOverlay.textContent = '恭喜獲得全消';
                gameBoardEl.appendChild(acOverlay);
                
                await engineSleep(3000);
                
                gameBoardEl.classList.remove('all-clear-shake');
                if (acOverlay.parentNode) {
                    acOverlay.remove();
                }
            }
        } else {
            hasMatches = false;
        }
    }
}

function getRandomMoneyBallValue() {
    let r = Math.random() * 100; 
    if (r < 50) return Math.floor((game1Bet === 0 ? 600 : game1Bet) * (1/5));
    if (r < 75) return Math.floor((game1Bet === 0 ? 600 : game1Bet) * (2/5));
    if (r < 85) return Math.floor((game1Bet === 0 ? 600 : game1Bet) * (4/5));
    if (r < 90) return Math.floor((game1Bet === 0 ? 600 : game1Bet) * (6/5));
    if (r < 94) return Math.floor((game1Bet === 0 ? 600 : game1Bet) * (8/5));
    if (r < 97) return Math.floor((game1Bet === 0 ? 600 : game1Bet) * (10/5));
    if (r < 99) return Math.floor((game1Bet === 0 ? 600 : game1Bet) * (25/5));
    return Math.floor((game1Bet === 0 ? 600 : game1Bet) * (50/5));
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
        guaranteedRewardValue = Math.floor((game1Bet === 0 ? 600 : game1Bet) * mult);
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
    
    if (ballCount >= 40) {
        DOM.outOverlay.textContent = '恭喜玩家成功通關 40球';
        DOM.outOverlay.style.fontSize = '2.5rem';
        DOM.outOverlay.style.textShadow = '0 5px 20px rgba(0,0,0,0.8), 0 0 30px #facc15';
        DOM.outOverlay.style.color = '#facc15';
        DOM.outOverlay.classList.add('show');
        await sleep(5000);
        
        // Reset for next games
        DOM.outOverlay.style.fontSize = '';
        DOM.outOverlay.style.textShadow = '';
        DOM.outOverlay.style.color = '';
    } else {
        DOM.outOverlay.textContent = 'OUT';
        DOM.outOverlay.classList.add('show');
        await sleep(2000);
    }
    
    if (appleBonusRoundsLeft > 0) {
        appleBonusRoundsLeft--;
        updateMiniGameUI();
        
        if (appleBonusRoundsLeft === 0) {
            if (miniGameSteps >= 140) {
                let notice = document.getElementById('jp-roulette-notice');
                if (notice) {
                    notice.classList.remove('hidden');
                }
                DOM.drawStatus.textContent = `🎯 準備進入 JP 轉盤遊戲... 🎯`;
                await sleep(4000);
                if (notice) notice.classList.add('hidden');
                await sleep(1000);
                
                // 開始 JP 轉盤
                await runJPRouletteGame();
                
            } else {
                let ratio = 0;
                if (miniGameSteps >= 90) ratio = 0.20;
                else if (miniGameSteps >= 50) ratio = 0.10;
                else if (miniGameSteps >= 20) ratio = 0.05;
                else ratio = 0;
                
                let reward = Math.floor(activeJPAmount * ratio);
                if ((game1Bet > 0 || game2Bet > 0 || game3Bet > 0) && reward > 0) {
                    bonusWin += reward;
                    recalculateTotalWin();
                    DOM.drawStatus.textContent = `🎯 JP結算！抵達 ${miniGameSteps} 島，獲得獎金 ${reward} 🎯`;
                    await sleep(3000);
                } else {
                    DOM.drawStatus.textContent = `🎯 JP結算！未達 20 島，無獎金 🎯`;
                    await sleep(2000);
                }
            }
        }
    }
    
    if (game2Bet > 0 && game2Win > 0) {
        DOM.drawStatus.textContent = `連連樂結算！獲得 ${game2Win}`;
        await sleep(1500);
    }

    if (game3Bet > 0 && game3TotalWin > 0) {
        DOM.drawStatus.textContent = `夾夾樂結算！獲得 ${game3TotalWin}`;
        await sleep(1500);
    }

    recalculateTotalWin();
    credit += totalWin;
    updateCreditDisplay();
    isPlaying = false;
    updateGame1WinDisplay();
    updateGame2WinDisplay();
    updateGame3WinDisplay();
    DOM.btnStart.disabled = false;
    document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = false);
    document.querySelectorAll('.color-btn').forEach(btn => btn.style.pointerEvents = 'auto');
    DOM.drawStatus.textContent = `請押分，並按開始`;
    DOM.betInputs.forEach(el => el.textContent = "0");
    game1Bet = 0;
    game2Bet = 0;
    game3Bet = 0;
    game3TotalTargetBalls = 0;
    game3MaxMultiplier = 0;
    game3TrailingRainbows = 0;
    Game3Manager.updateHitTable();
    updateLadderRewards(0);
    generateBetApples(1);
    generateBetApples(3);
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


function collectApple(type, customBet = null) {
    let activeBet = customBet || (game1Bet > 0 ? game1Bet : 600);
    if (game1Bet === 0 && !customBet) return;

    if (currentAppleColors.length === 7) {
        currentAppleColors = []; 
        currentAppleScores = [];
    }
    
    currentAppleColors.push(type);
    
    let score = 0;
    switch (type) {
        case 'gold': score = activeBet * 2.5; break;
        case 'silver': score = activeBet * 1.5; break;
        case 'bronze': score = activeBet * 1.0; break;
        case 'red': score = activeBet * 0.5; break;
        case 'green': score = activeBet * 0.25; break;
    }
    currentAppleScores.push(Math.floor(score));
    
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
        setTimeout(() => {
            div.remove();
        }, 2000);
    }
}

async function runJPRouletteGame() {
    DOM.drawStatus.textContent = `🎰 JP轉盤遊戲開始！ 🎰`;
    
    // Assign tiers
    let colors = ['red', 'pink', 'yellow', 'green', 'blue'];
    colors.sort(() => Math.random() - 0.5);
    let tier1 = [colors[0], colors[1]]; // 1%
    let tier2 = [colors[2], colors[3]]; // 2%
    let tier3 = [colors[4]];            // 3%
    
    let currentJPWin = 0;
    let possibleColors = ['white', 'red', 'pink', 'yellow', 'green', 'blue', 'rainbow'];
    
    let maxBalls = 10;
    if (miniGameSteps > 140) {
        maxBalls = 10 + Math.floor((miniGameSteps - 140) / 30);
        if (maxBalls > 15) maxBalls = 15;
    }
    
    let waves = [2, 3];
    let remainingBalls = maxBalls - 5;
    if (remainingBalls > 0) waves.push(remainingBalls);

    let hitRainbow = false;

    for (let w = 0; w < waves.length; w++) {
        let waveCount = waves[w];
        DOM.drawStatus.textContent = `JP轉盤 第 ${w + 1} 波發射！ (${waveCount} 顆球) 目前累積: ${currentJPWin}`;
        
        let wavePromises = [];
        let waveColors = [];
        
        for (let i = 0; i < waveCount; i++) {
            let targetColor = possibleColors[Math.floor(Math.random() * possibleColors.length)];
            waveColors.push(targetColor);
            
            let delay = i * 400; // stagger shots
            let p = sleep(delay).then(async () => {
                if (targetColor === 'rainbow') {
                    await spawnAndSpinBall('sp', true, '🌈 彩色球', 'sp', ['rainbow', 'rainbow']);
                } else if (targetColor === 'white') {
                    await spawnAndSpinBall('white', false);
                } else {
                    await spawnAndSpinBall(targetColor, false);
                }
            });
            wavePromises.push(p);
        }
        
        await Promise.all(wavePromises);
        await sleep(1500); // Wait for balls to settle
        
        for (let c of waveColors) {
            if (hitRainbow) continue;
            
            if (c === 'rainbow') {
                hitRainbow = true;
                currentJPWin += activeJPAmount; 
                let jackpotEl = document.getElementById('jp-roulette-jackpot');
                if (jackpotEl) jackpotEl.classList.remove('hidden');
                DOM.drawStatus.textContent = `🌟 JACKPOT!!! 獲得全額 JP獎金 ${activeJPAmount} 🌟`;
                await sleep(3000);
                if (jackpotEl) jackpotEl.classList.add('hidden');
            } else if (c === 'white' || tier1.includes(c)) {
                currentJPWin += Math.floor(activeJPAmount * 0.01);
                DOM.drawStatus.textContent = `獲得 JP獎金 1%`;
                await sleep(500);
            } else if (tier2.includes(c)) {
                currentJPWin += Math.floor(activeJPAmount * 0.02);
                DOM.drawStatus.textContent = `獲得 JP獎金 2%`;
                await sleep(500);
            } else if (tier3.includes(c)) {
                currentJPWin += Math.floor(activeJPAmount * 0.03);
                DOM.drawStatus.textContent = `獲得 JP獎金 3%`;
                await sleep(500);
            }
        }
        
        DOM.drawStatus.textContent = `目前累積: ${currentJPWin}`;
        await sleep(1000);
        
        if (hitRainbow) {
            break;
        }
    }
    
    DOM.drawStatus.textContent = `🎯 JP轉盤遊戲結束！總共累積獲得 JP獎金 ${currentJPWin} 🎯`;
    if (game1Bet > 0 || game3Bet > 0) {
        bonusWin += currentJPWin;
        recalculateTotalWin();
    }
    await sleep(4000);
}

// 響應式縮放邏輯
function resizeApp() {
    const wrapper = document.querySelector('.app-wrapper');
    if (!wrapper) return;
    
    // 暫時解除縮放以取得原始尺寸
    wrapper.style.transform = 'none';
    wrapper.style.transformOrigin = 'center center';
    
    const rect = wrapper.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 預留一點邊距
    const scaleX = (windowWidth - 20) / rect.width;
    const scaleY = (windowHeight - 20) / rect.height;
    
    // 取較小值等比例縮放，且不放大超過 100%
    let scale = Math.min(scaleX, scaleY);
    if (scale > 1) scale = 1;
    
    wrapper.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', resizeApp);
window.addEventListener('DOMContentLoaded', () => {
    switchActiveGame('game1');
    Game2Manager.init();
    setTimeout(resizeApp, 100);
    setTimeout(resizeApp, 500);
});
