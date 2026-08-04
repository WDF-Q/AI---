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
let game2LvMaxCombo = 0;
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

// ** 彩虹蘋果 (Rainbow Apple) 全域狀態 **
let isRainbowAppleThisRound = false;
let rainbowAppleTargetGame = 0;
let rainbowAppleDirectJPTriggered = false;
let forceRainbowAppleDebug = false;

// ** Game 3 (夾夾樂) 狀態 **
let game3TargetColor = 'red'; 
let game3MultiplierArray = []; 
let game3Combo = 0;
let game3MaxMultiplier = 0;
let game3TotalWin = 0;
let game3TotalTargetBalls = 0;
let game3SlotStyles = [];
let game3MaxComboReached = 0;
let game3ApplesInPlay = [];
let game3CurrentComboColor = null;
let game3TrailingRainbows = 0;
let game1Win = 0;
let game2Win = 0;

// ** Mode State (模式 1 vs 模式 2) **
let currentGameMode = 'MODE_1'; // 'MODE_1' or 'MODE_2'
let activeGameSet1 = 'game1';   // 'game1', 'game2', 'game3'
let activeGameSet2 = 'game1'; // 'game1', 'game2', 'game3' for Set B

function toggleGameMode() {
    currentGameMode = (currentGameMode === 'MODE_1') ? 'MODE_2' : 'MODE_1';
    updateModeUI();
}

function updateModeUI() {
    const wrapper = document.querySelector('.app-wrapper');
    const modeBtn = document.getElementById('btn-switch-mode');
    
    if (wrapper) {
        wrapper.classList.remove('mode-1', 'mode-2');
        if (currentGameMode === 'MODE_1') {
            wrapper.classList.add('mode-1');
            if (modeBtn) modeBtn.innerHTML = '🎮 模式：單主頁 (1x3)';
        } else {
            wrapper.classList.add('mode-2');
            if (modeBtn) modeBtn.innerHTML = '🎮 模式：雙主頁 (2x3)';
        }
    }
    renderGameModulesLayout();
}

function switchActiveGame(targetId, setNum = 1) {
    let cleanId = targetId.replace('_2', '').replace('_1', '');
    if (currentGameMode === 'MODE_1') {
        activeGameSet1 = cleanId;
    } else {
        if (setNum === 1) {
            activeGameSet1 = cleanId;
        } else {
            activeGameSet2 = cleanId;
        }
    }
    renderGameModulesLayout();
}

function renderGameModulesLayout() {
    const set1Games = ['game1', 'game2', 'game3'];
    const wrapper = document.querySelector('.app-wrapper');
    if (!wrapper) return;

    if (currentGameMode === 'MODE_1') {
        wrapper.className = 'app-wrapper mode-1';
        let miniCount = 0;
        set1Games.forEach(id => {
            const el = document.getElementById(id + '-container');
            if (el) {
                el.style.display = 'block';
                if (id === activeGameSet1) {
                    el.className = 'game-module active';
                    el.style.left = '0px';
                    el.style.top = '0px';
                    el.style.transform = 'scale(1)';
                    el.style.zIndex = '10';
                } else {
                    el.className = 'game-module mini';
                    el.style.left = '103%';
                    el.style.top = (miniCount * 210) + 'px';
                    el.style.transform = 'scale(0.25)';
                    el.style.zIndex = '5';
                    miniCount++;
                }
            }
        });
        
        // Hide set 2 modules in Mode 1
        ['game1', 'game2', 'game3'].forEach(id => {
            const el = document.getElementById(id + '_2-container');
            if (el) el.style.display = 'none';
        });
    } else {
        wrapper.className = 'app-wrapper mode-2';
        
        // Mode 2: Set 1 Active & Mini
        let miniCount1 = 0;
        set1Games.forEach(id => {
            const el = document.getElementById(id + '-container');
            if (el) {
                el.style.display = 'block';
                if (id === activeGameSet1) {
                    el.className = 'game-module active-set1';
                    el.style.left = '0px';
                    el.style.top = '0px';
                    el.style.transform = 'scale(0.82)';
                    el.style.zIndex = '10';
                } else {
                    el.className = 'game-module mini-set1';
                    el.style.left = '840px';
                    el.style.top = (miniCount1 * 150) + 'px';
                    el.style.transform = 'scale(0.22)';
                    el.style.zIndex = '5';
                    miniCount1++;
                }
            }
        });

        // Mode 2: Set 2 Active & Mini
        let miniCount2 = 0;
        ['game1', 'game2', 'game3'].forEach(id => {
            const el = document.getElementById(id + '_2-container');
            if (el) {
                el.style.display = 'block';
                if (id === activeGameSet2) {
                    el.className = 'game-module active-set2';
                    el.style.left = '420px';
                    el.style.top = '0px';
                    el.style.transform = 'scale(0.82)';
                    el.style.zIndex = '10';
                } else {
                    el.className = 'game-module mini-set2';
                    el.style.left = '840px';
                    el.style.top = (300 + miniCount2 * 150) + 'px';
                    el.style.transform = 'scale(0.22)';
                    el.style.zIndex = '5';
                    miniCount2++;
                }
            }
        });
    }
}

// ** Decoupled Engine States **
let leftEngineActive = false;
let boardState = 'IDLE'; 
let pendingEventsQueue = []; 
let isGameOverTriggered = false; 
let pendingInitialBatch = 0; 
let pendingDrawsQueue = 0;
let shopTriggeredForBall = {};
window.game3ExtraClawBallPending = false;
let stagedShopApples = [];

// Roulette animation tracking
let outerWheelRotation = 0;
let innerWheelRotation = 0;
let activeBalls = [];

const DOM = {
    get board() { return document.getElementById('game-board'); },
    get credit() { return document.getElementById('credit-display'); },
    get btnCycleBet() { return document.getElementById('btn-cycle-bet'); },
    get btnStart() { return document.getElementById('btn-start'); },
    get betInputs() { return document.querySelectorAll('.bet-value'); },
    get betAppleSlots() { return document.querySelectorAll('.bet-apple-slots'); },
    get win() { return document.getElementById('win-display'); },
    get safeIndicator() { return document.getElementById('safe-indicator'); },
    get ballCountText() { return document.getElementById('ball-count-text'); },
    get appleIcons() { return document.querySelectorAll('.apple-icon'); },
    get btnDebugApple() { return document.getElementById('btn-debug-apple'); },
    get miniGamePanel() { return document.getElementById('mini-game-panel'); },
    get mgRoundsLeft() { return document.getElementById('mg-rounds-left'); },
    get mgColorRules() { return document.getElementById('mg-color-rules'); },
    get mgProgressFill() { return document.getElementById('mg-progress-fill'); },
    get mgDogContainer() { return document.getElementById('mg-dog-container'); },
    get mgDogCounter() { return document.getElementById('mg-dog-counter'); },
    get mgDog() { return document.getElementById('mg-dog'); },
    get mgStationEls() { return document.querySelectorAll('.mg-station'); },
    get birdMouthSlots() { return document.querySelectorAll('.bird-mouth-slot'); },
    get birdMouth() { return document.getElementById('bird-mouth'); },
    get drawStatus() { return document.getElementById('draw-status'); },
    get comboOverlay() { return document.getElementById('combo-overlay'); },
    get outOverlay() { return document.getElementById('out-overlay'); },
    
    get rouletteOuter() { return document.getElementById('roulette-wheel-outer'); },
    get rouletteInner() { return document.getElementById('roulette-wheel-inner'); },
    get rouletteBallOrbit() { return document.getElementById('roulette-ball-orbit'); },
    get rouletteBall() { return document.getElementById('roulette-ball'); },
    get rouletteResultText() { return document.getElementById('roulette-result-text'); },
    
    get fireBox() { return document.getElementById('fire-box'); },
    get ballHistory() { return document.getElementById('ball-history'); }
};

function startWheelRotations() {
    function animate() {
        outerWheelRotation = (outerWheelRotation + 0.5) % 360; 
        innerWheelRotation = (innerWheelRotation + 1.5) % 360; 
        
        let outerEl = DOM.rouletteOuter;
        let innerEl = DOM.rouletteInner;
        if (outerEl) outerEl.style.transform = `rotate(${outerWheelRotation}deg)`;
        if (innerEl) innerEl.style.transform = `translate(-50%, -50%) rotate(${innerWheelRotation}deg)`;
        
        for (let ball of activeBalls) {
            if (ball.state === 'landed_outer' && ball.orbitEl) {
                ball.orbitEl.style.transform = `rotate(${outerWheelRotation + ball.offsetAngle}deg)`;
            } else if (ball.state === 'landed_inner' && ball.orbitEl) {
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
    checkAndResetWinsBeforeNewBet();
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
        updateGame2OddsPanel();
    } else if (gameId === 3) {
        if (game3Bet === 0) game3Bet = 600;
        else { game3Bet += inc; if(game3Bet > 3000) game3Bet = 3000; }
        document.querySelectorAll('.bet-value[data-game="3"]').forEach(el => el.textContent = game3Bet);
        generateBetApples(3);
    }
}

document.getElementById('btn-repeat-bet').addEventListener('click', () => {
    if (isPlaying) return;
    checkAndResetWinsBeforeNewBet();
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
            updateGame2OddsPanel();
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
        if (game1Win > 0) {
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
        if (game3TotalWin > 0 && game3Bet > 0) {
            badge.classList.remove('hidden');
            text.textContent = game3TotalWin;
        } else {
            badge.classList.add('hidden');
        }
    }
}

function showRoundEndOutOverlays() {
    let b1 = previousGame1Bet > 0 ? previousGame1Bet : game1Bet;
    let b2 = previousGame2Bet > 0 ? previousGame2Bet : game2Bet;
    let b3 = previousGame3Bet > 0 ? previousGame3Bet : game3Bet;

    if (b1 > 0) {
        const out1 = document.getElementById('out-overlay');
        if (out1) {
            out1.textContent = 'OUT';
            out1.classList.add('show');
        }
    }
    if (b2 > 0) {
        const out2 = document.getElementById('g2-out-overlay');
        if (out2) {
            out2.textContent = 'OUT';
            out2.classList.add('show');
        }
    }
    if (b3 > 0) {
        const out3 = document.getElementById('g3-out-overlay');
        if (out3) {
            out3.textContent = 'OUT';
            out3.classList.add('show');
        }
    }
}

function hideAllOutOverlays() {
    const out1 = document.getElementById('out-overlay');
    const out2 = document.getElementById('g2-out-overlay');
    const out3 = document.getElementById('g3-out-overlay');
    if (out1) {
        out1.classList.remove('show');
        out1.style.fontSize = '';
        out1.style.textShadow = '';
        out1.style.color = '';
        out1.textContent = 'OUT';
    }
    if (out2) out2.classList.remove('show');
    if (out3) out3.classList.remove('show');
}

function checkAndResetWinsBeforeNewBet() {
    if (!isPlaying && (game1Win > 0 || game2Win > 0 || game3TotalWin > 0 || totalWin > 0)) {
        game1Win = 0;
        game2Win = 0;
        game3TotalWin = 0;
        totalWin = 0;
        bonusWin = 0;
        updateWinDisplay();
        updateGame1WinDisplay();
        updateGame2WinDisplay();
        updateGame3WinDisplay();
        hideAllOutOverlays();
    }
}



function createBlock(r, c, color, isMoney = false, moneyValue = 0, isFlash = false, isChainReward = false) {
    const el = document.createElement('div');
    el.className = `block`;
    if (isMoney) {
        el.classList.add('money-ball');
        if (isChainReward) {
            el.classList.add('chain-money-ball');
        } else {
            el.classList.add('normal-money-ball');
        }
        el.textContent = moneyValue;
    } else {
        el.classList.add(`color-${color}`);
        if (isFlash) el.classList.add('flash-ball');
    }
    el.style.left = `${OFFSET + c * (BLOCK_SIZE + GAP)}px`;
    el.style.top = `${r * (BLOCK_SIZE + GAP)}px`;
    DOM.board.appendChild(el);
    return { r, c, color, isMoney, moneyValue, isFlash, isChainReward, el };
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
let game2PreApples = [];
let game3PreApples = [];

let game2AppleThresholds = [];

const G2_APPLE_THRESHOLDS_2 = [
    [2, 3],
    [2, 4],
    [3, 5]
];

const G2_APPLE_THRESHOLDS_3 = [
    [2, 3, 4],
    [2, 3, 5],
    [3, 4, 5],
    [3, 4, 6],
    [4, 5, 8]
];

function generateGame2AppleThresholds() {
    if (game2Bet === 0 || !game2PreApples || game2PreApples.length === 0) {
        game2AppleThresholds = [];
        renderGame2AppleHUD();
        return;
    }

    let count = game2PreApples.length; // 2 或 3
    let pool = count === 2 ? G2_APPLE_THRESHOLDS_2 : G2_APPLE_THRESHOLDS_3;
    let chosenCombo = pool[Math.floor(Math.random() * pool.length)];

    let shuffledLines = [...chosenCombo].sort(() => Math.random() - 0.5);
    let apples = [...game2PreApples];

    let items = [];
    for (let i = 0; i < count; i++) {
        items.push({
            lines: shuffledLines[i],
            type: apples[i].type,
            collected: false
        });
    }

    items.sort((a, b) => b.lines - a.lines);
    game2AppleThresholds = items;

    renderGame2AppleHUD();
}

function renderGame2AppleHUD() {
    const hudContainer = document.getElementById('g2-apple-hud');
    if (!hudContainer) return;

    // 壓分階段（!isPlaying）隱藏蘋果門檻欄位（增添神秘感，避免壓分時詞條亂跳）
    // 只有在遊戲開始後（isPlaying === true）且有壓分（game2Bet > 0）時才顯示正式選定的門檻與蘋果！
    if (!isPlaying || game2Bet === 0 || !game2AppleThresholds || game2AppleThresholds.length === 0) {
        hudContainer.style.display = 'none';
        hudContainer.classList.add('hidden');
        hudContainer.innerHTML = '';
        return;
    }

    hudContainer.style.display = 'block';
    hudContainer.classList.remove('hidden');

    let html = '';
    game2AppleThresholds.forEach(item => {
        let isDone = item.collected;

        if (isDone) {
            // 已達成：金色字體 "獲得！" (粗體) + 該詞條右邊原色蘋果 (不使用 inline filter 覆蓋 CSS 顏色)
            html += `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; font-size: 1.05rem; font-weight: 900; line-height: 1.15; margin-bottom: 2px;">
                <span style="color: #fde047; text-shadow: 0 0 6px #f59e0b, 1px 1px 0 #78350f, -1px -1px 0 #000; font-weight: 900; letter-spacing: 1px;">獲得！</span>
                <span class="apple-item apple-${item.type}" style="font-size: 1.2rem; margin: 0;">🍎</span>
            </div>`;
        } else {
            // 未達成：顯示門檻 LINE 數與蘋果
            html += `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; font-size: 1.02rem; font-weight: bold; line-height: 1.15; margin-bottom: 2px; color: #e2e8f0;">
                <span>${item.lines} LINE</span>
                <span class="apple-item apple-${item.type}" style="font-size: 1.2rem; margin: 0;">🍎</span>
            </div>`;
        }
    });

    hudContainer.innerHTML = html;
}

function checkGame2AppleReward(cardCompletedLines) {
    if (game2Bet <= 0 || cardCompletedLines <= 0) return;

    if (window.g2RainbowAppleActive && cardCompletedLines >= 3) {
        window.g2RainbowAppleActive = false;
        collectApple('rainbow', game2Bet);
    }

    if (!game2AppleThresholds || game2AppleThresholds.length === 0) return;
    let targetItem = game2AppleThresholds.find(item => !item.collected && item.lines === cardCompletedLines);

    if (targetItem) {
        targetItem.collected = true;
        collectApple(targetItem.type, game2Bet);
        renderGame2AppleHUD();
    }
}

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

function getRainbowAppleSVGHtml(sizeRem = '1.8rem') {
    return `<div class="apple-item apple-rainbow" style="font-size: ${sizeRem}; margin: 0;">🍎</div>`;
}

function generateBetApples(gameId) {
    let container = document.querySelector(`.bet-apple-slots[data-game="${gameId}"]`);
    if (!container) return;
    
    let currentBet = gameId === 1 ? game1Bet : (gameId === 2 ? game2Bet : game3Bet);
    let preGenerated = gameId === 1 ? game1PreApples : (gameId === 2 ? game2PreApples : game3PreApples);

    if (currentBet === 0) {
        if (gameId === 1) game1PreApples = [];
        else if (gameId === 2) game2PreApples = [];
        else game3PreApples = [];
        
        let slots = container.querySelectorAll('.apple-slot');
        slots.forEach(slot => {
            slot.innerHTML = `<span style="filter: grayscale(1) opacity(0.5); font-size: 1.8rem; line-height: 1;">🍎</span>`;
        });
        if (gameId === 2) generateGame2AppleThresholds();
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
        // 根據目前壓分金額 (currentBet)，進行對應步數的品質升級 (高壓分如 3000分會 100% 直接升級為金色蘋果)
        let upgradeSteps = Math.floor((currentBet - 600) / 50) + 1;
        for (let step = 0; step < upgradeSteps; step++) {
            let upgradeProb = getUpgradeProb(currentBet);
            for (let i = 0; i < preGenerated.length; i++) {
                if (Math.random() < upgradeProb) {
                    preGenerated[i].type = upgradeApple(preGenerated[i].type);
                }
            }
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
            let upgradeSteps = Math.floor((currentBet - 600) / 50) + 1;
            for (let step = 0; step < upgradeSteps; step++) {
                if (Math.random() < upgradeProb) {
                    preGenerated[preGenerated.length - 1].type = upgradeApple(preGenerated[preGenerated.length - 1].type);
                }
            }
        }
    }
    
    let slots = container.querySelectorAll('.apple-slot');
    slots.forEach((slot, index) => {
        slot.innerHTML = '';
        if (index < preGenerated.length) {
            let a = preGenerated[index];
            if (a.type === 'rainbow') {
                slot.innerHTML = getRainbowAppleSVGHtml('1.8rem');
            } else {
                let appleEl = document.createElement('div');
                appleEl.className = `apple-item apple-${a.type}`;
                appleEl.innerHTML = `🍎<span class="apple-num" style="display:none;">${a.hp}</span>`;
                appleEl.style.fontSize = '1.8rem';
                appleEl.style.margin = '0';
                slot.appendChild(appleEl);
            }
        } else {
            slot.innerHTML = `<span style="filter: grayscale(1) opacity(0.5); font-size: 1.8rem; line-height: 1;">🍎</span>`;
        }
    });

    if (gameId === 1) {
        spawnApples();
    } else if (gameId === 2) {
        generateGame2AppleThresholds();
    } else if (gameId === 3) {
        if (typeof Game3Manager !== 'undefined') {
            Game3Manager.updateHitTable();
        }
    }
}

function spawnApples() {
    DOM.birdMouthSlots.forEach(slot => {
        slot.innerHTML = '';
    });
    topApplesState.fill(null);
    
    // 遊戲開始前 (!isPlaying) 消除框上方鳥嘴列保持隱藏，遊戲開始後才顯示
    if (!isPlaying) return;
    
    let slotsArray = Array.from(DOM.birdMouthSlots);
    if (slotsArray.length === 0) return;
    
    let beakIndex = Math.floor(Math.random() * slotsArray.length);
    
    let beakEl = document.createElement('div');
    beakEl.className = 'bird-mouth';
    beakEl.id = 'bird-mouth';
    beakEl.textContent = 'SP光束';
    slotsArray[beakIndex].appendChild(beakEl);
    
    DOM.birdMouth = beakEl;

    // 消消樂 (Game 1) 若未壓分 (game1Bet === 0)，上方絕對不產生蘋果！
    if (game1Bet === 0) {
        return;
    }
    
    let availableSlots = [];
    for (let i = 0; i < slotsArray.length; i++) {
        if (i !== beakIndex) availableSlots.push(slotsArray[i]);
    }
    availableSlots.sort(() => Math.random() - 0.5);
    
    let applesToSpawn = game1PreApples.length > 0 ? game1PreApples : [];
    if (applesToSpawn.length === 0 && game1Bet > 0) {
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

function getGame2LineMultiplier(line) {
    if (line <= 10) return 1.0;
    if (line <= 20) return 1.5;
    if (line <= 30) return 2.0;
    if (line <= 40) return 3.0;
    if (line <= 50) return 4.0;
    if (line <= 60) return 4.0;
    return 5.0;
}

function calculateGame2TotalPayout(bet, totalLines) {
    if (bet <= 0 || totalLines <= 0) return 0;
    let baseLineValue = bet * 0.2; // 壓分 * 1/5
    let totalWin = 0;
    for (let i = 1; i <= totalLines; i++) {
        let mult = getGame2LineMultiplier(i);
        totalWin += baseLineValue * mult;
    }

    // BONUS 30 LINE 規則：當累計的 LINE 數量達到了 30 LINE，會再 "額外" 獲得該 BONUS 的金額 (BET * 30)
    if (totalLines >= 30) {
        totalWin += bet * 30;
    }

    return Math.floor(totalWin);
}

function getGame2OddsTiers(currentLines) {
    // 第 1 層（最下面那格）：固定顯示當前已獲得的總 LINE 數（若為 0 或 1 則顯示 1 LINE）
    let tier1 = Math.max(1, currentLines);
    let tier2 = tier1 + 1;
    let tier3 = tier1 + 2;
    let tier4 = tier1 + 3;
    let tier5 = tier1 + 4;

    // 第 6 層：依據第 5 層來評估：[(第 5 層 LINE 數 / 5) 取整數 + 1] * 5
    let tier6 = (Math.floor(tier5 / 5) + 1) * 5;
    let tier7 = tier6 + 5;
    let tier8 = tier7 + 5;

    return {
        8: tier8,
        7: tier7,
        6: tier6,
        5: tier5,
        4: tier4,
        3: tier3,
        2: tier2,
        1: tier1
    };
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
    updateGame2OddsPanel();
}

function showGame2CardWinOverlay(amount) {
    const overlay = document.getElementById('g2-card-win-overlay');
    const amtEl = document.getElementById('g2-card-win-amount');
    if (overlay && amtEl) {
        amtEl.textContent = amount;
        overlay.classList.remove('hidden');
        requestAnimationFrame(() => {
            overlay.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    }
}

function hideGame2CardWinOverlay() {
    const overlay = document.getElementById('g2-card-win-overlay');
    if (overlay) {
        overlay.style.transform = 'translate(-50%, -50%) scale(0)';
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }
}

function updateGame2ComboBadge() {
    const badge = document.getElementById('g2-combo-badge');
    if (!badge) return;
    if (game2LvMaxCombo > 0) {
        badge.textContent = `combo ${game2LvMaxCombo}`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function updateGame2OddsPanel() {
    let bet = game2Bet > 0 ? game2Bet : 600;
    let tiers = getGame2OddsTiers(game2LineCount);

    for (let tier = 1; tier <= 8; tier++) {
        let lines = tiers[tier];

        let lineEl = document.getElementById(`g2-odds-line-${tier}`);
        if (lineEl) {
            lineEl.textContent = lines;
        }

        let valEl = document.getElementById(`g2-odds-val-${tier}`);
        if (valEl) {
            let winAmount = calculateGame2TotalPayout(bet, lines);
            valEl.textContent = winAmount;
        }

        let rowEl = document.querySelector(`.g2-odds-row[data-tier="${tier}"]`);
        if (rowEl) {
            // 第 1 層代表當前已累積的 LINE 數，有連線 (game2LineCount > 0) 時第 1 層亮起
            // 第 2~8 層，當累積 LINE 數達標 (game2LineCount >= lines) 時高亮亮起
            if (game2LineCount > 0 && game2LineCount >= lines) {
                rowEl.classList.add('active');
            } else {
                rowEl.classList.remove('active');
            }
        }
    }

    updateGame2BonusDisplay();
}

function updateGame2BonusDisplay() {
    const lineCountHud = document.getElementById('g2-line-count-hud');
    const bonusPanel = document.getElementById('g2-bonus-panel');
    const oddsPanel = document.getElementById('g2-odds-panel');
    const bonusAmtEl = document.getElementById('g2-bonus-amount');

    if (game2Bet === 0) {
        // 沒有壓分的情況 (game2Bet === 0):
        // 左上角顯示 "現在的 LINE 數"；隱藏 BONUS 欄位與 ODDS 欄位！
        if (lineCountHud) {
            lineCountHud.style.display = 'block';
            lineCountHud.classList.remove('hidden');
        }
        if (bonusPanel) {
            bonusPanel.style.display = 'none';
            bonusPanel.classList.add('hidden');
        }
        if (oddsPanel) {
            oddsPanel.style.display = 'none';
            oddsPanel.classList.add('hidden');
        }
    } else {
        // 有壓分的情況 (game2Bet > 0):
        // 隱藏 "現在的 LINE 數"；左上角顯示 BONUS 欄位 (對齊右上蘋果欄位)，主棋盤左側顯示與主棋盤等高的 ODDS 欄位！
        if (lineCountHud) {
            lineCountHud.style.display = 'none';
            lineCountHud.classList.add('hidden');
        }
        if (bonusPanel) {
            bonusPanel.style.display = 'block';
            bonusPanel.classList.remove('hidden');
        }
        if (oddsPanel) {
            oddsPanel.style.display = 'flex';
            oddsPanel.classList.remove('hidden');
        }
        if (bonusAmtEl) {
            let bonusAmount = game2Bet * 30; // 30 LINE BONUS = BET * 30
            bonusAmtEl.textContent = bonusAmount;
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

const G2_LINE_COORDS = {
    '0,1,2': [15, 58, 309, 58],   // 第一橫行
    '3,4,5': [15, 163, 309, 163], // 第二橫行
    '6,7,8': [15, 268, 309, 268], // 第三橫行
    '0,3,6': [58, 15, 58, 309],   // 第一直列
    '1,4,7': [163, 15, 163, 309], // 第二直列
    '2,5,8': [268, 15, 268, 309], // 第三直列
    '0,4,8': [20, 20, 304, 304],  // 主對角線 \
    '2,4,6': [304, 20, 20, 304]   // 反對角線 /
};

const Game2Manager = {
    gridData: [],
    nextGridData: [],
    nextGridDataFull: [],
    nextLevel: 2,
    isCardChanging: false,
    isLvMaxComboChain: false,
    isLvMaxRefreshedCard: false,
    winningMatchedPatterns: [],

    init() {
        this.isCardChanging = false;
        this.isLvMaxComboChain = false;
        this.isLvMaxRefreshedCard = false;
        game2LvMaxCombo = 0;
        updateGame2ComboBadge();
        this.winningMatchedPatterns = [];
        game2Level = 1;
        game2CardNum = 1;
        game2Win = 0;
        game2LineCount = 0;
        this.clearWinningLines();
        this.generateCard(1); // 初始主體固定為 LV1 模板
        let firstNextLvl = 1; // 第一張備用棋盤固定為 LV1
        this.generateNextCard(firstNextLvl);
        generateGame2AppleThresholds();
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

        updateGame2OddsPanel();

        let winningIndices = new Set();
        if (this.winningMatchedPatterns && this.winningMatchedPatterns.length > 0) {
            this.winningMatchedPatterns.forEach(pattern => {
                pattern.forEach(idx => winningIndices.add(idx));
            });
        }

        this.gridData.forEach((tile, index) => {
            const div = document.createElement('div');
            let isRainbowBorder = (tile.type === 'free' || tile.type === 'sp' || tile.color === 'sp' || tile.color === 'purple');
            let isWinningTile = winningIndices.has(index);

            if (tile.hit) {
                div.className = `g2-tile hit ${isRainbowBorder ? 'rainbow-border' : tile.color} ${isWinningTile ? 'winning' : ''}`;
                if (!isRainbowBorder) {
                    div.style.borderColor = `var(--color-${tile.color}, #facc15)`;
                } else {
                    div.style.borderColor = 'transparent';
                }
                div.innerHTML = `<span class="g2-hit-text" style="font-size: 1.6rem; font-weight: 900; color: #facc15; text-shadow: 0 0 8px #facc15, 2px 2px 0 #000;">HIT</span>`;
            } else {
                div.className = `g2-tile ${tile.color} ${isWinningTile ? 'winning' : ''}`;
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

        if (this.winningMatchedPatterns && this.winningMatchedPatterns.length > 0) {
            this.drawWinningLines(this.winningMatchedPatterns);
        }
    },

    upgradeNextCardLevel(levelBoost = 1) {
        if (this.nextLevel >= 9) {
            // 已經達到 LV MAX (LV9)：重新生成 LV MAX 盤面（自動切換為其它顏色/排版組合）
            this.generateNextCard(9);
        } else {
            // 提升等級（最多提升至 LV MAX = LV9）
            let targetLevel = Math.min(9, this.nextLevel + levelBoost);
            this.generateNextCard(targetLevel);
        }
    },

    processBall(logicalColor, isBatchMode = false) {
        if (!this.gridData || this.gridData.length === 0) return;

        let hitMade = false;
        let nextCardLevelBoost = 0;
        let isMainCardLvMax = (game2Level >= 9);

        if (logicalColor === 'rainbow') {
            // 彩色洞：
            let spAlreadyHit = this.gridData.some(tile => (tile.type === 'sp' || tile.color === 'sp') && tile.hit);

            if (isMainCardLvMax || spAlreadyHit) {
                nextCardLevelBoost += 2;
            }

            this.gridData.forEach(tile => {
                if (!tile.hit && (tile.type === 'sp' || tile.color === 'sp')) {
                    tile.hit = true;
                    hitMade = true;
                }
            });
        } else if (logicalColor && logicalColor !== 'white') {
            // 標準單色洞（黃、藍、紅、綠、粉）：
            let colorAlreadyHit = this.gridData.some(tile => tile.color === logicalColor && tile.hit);

            if (isMainCardLvMax || colorAlreadyHit) {
                nextCardLevelBoost += 1;
            }

            this.gridData.forEach(tile => {
                if (!tile.hit && tile.color === logicalColor) {
                    tile.hit = true;
                    hitMade = true;
                }
            });
        }

        if (nextCardLevelBoost > 0 && !this.isCardChanging) {
            this.upgradeNextCardLevel(nextCardLevelBoost);
        }

        if (hitMade) {
            this.renderUI();
        }

        if (!isBatchMode) {
            this.evaluateLineCheck();
        }
    },

    drawWinningLines(matchedPatterns) {
        const barsContainer = document.getElementById('g2-line-bars-container');
        const svgGroup = document.getElementById('g2-lines-group');
        const gridEl = document.getElementById('game2-grid');

        if (barsContainer) barsContainer.innerHTML = '';
        if (svgGroup) svgGroup.innerHTML = '';

        const patternClassMap = {
            '0,1,2': 'row-0',
            '3,4,5': 'row-1',
            '6,7,8': 'row-2',
            '0,3,6': 'col-0',
            '1,4,7': 'col-1',
            '2,5,8': 'col-2',
            '0,4,8': 'diag-1',
            '2,4,6': 'diag-2'
        };

        matchedPatterns.forEach(pattern => {
            let key = pattern.join(',');
            let clsName = patternClassMap[key];

            // 1. 生成 HTML 實體耀眼光條 (絕對層級覆蓋於方塊最頂層)
            if (clsName && barsContainer) {
                const bar = document.createElement('div');
                bar.className = `g2-line-bar ${clsName}`;
                barsContainer.appendChild(bar);
            }

            // 2. 生成 SVG 光雕線條
            let coords = G2_LINE_COORDS[key];
            if (coords && svgGroup) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', coords[0]);
                line.setAttribute('y1', coords[1]);
                line.setAttribute('x2', coords[2]);
                line.setAttribute('y2', coords[3]);
                line.setAttribute('class', 'g2-winning-stroke');
                svgGroup.appendChild(line);
            }

            // 3. 給連線方塊加上黃金光圈與脈衝高亮
            pattern.forEach(idx => {
                if (gridEl && gridEl.children[idx]) {
                    gridEl.children[idx].classList.add('winning');
                }
            });
        });
    },

    clearWinningLines() {
        const barsContainer = document.getElementById('g2-line-bars-container');
        const svgGroup = document.getElementById('g2-lines-group');
        if (barsContainer) barsContainer.innerHTML = '';
        if (svgGroup) svgGroup.innerHTML = '';
        this.winningMatchedPatterns = [];
    },

    evaluateLineCheck() {
        if (this.isCardChanging) return;

        const linePatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        let matchedPatterns = [];
        linePatterns.forEach(pattern => {
            if (pattern.every(idx => this.gridData[idx] && this.gridData[idx].hit)) {
                matchedPatterns.push(pattern);
            }
        });

        if (matchedPatterns.length > 0) {
            this.winningMatchedPatterns = matchedPatterns;
            let completedLines = matchedPatterns.length;
            let prevLines = game2LineCount;
            game2LineCount += completedLines;

            // 判斷是否是在 LV MAX 狀態下達成連線消除
            if (game2Level >= 9) {
                game2LvMaxCombo++;
                this.isLvMaxComboChain = true;
                updateGame2ComboBadge();
            }

            if (game2Bet > 0) {
                game2Win = calculateGame2TotalPayout(game2Bet, game2LineCount);
                let cardWin = game2Win - calculateGame2TotalPayout(game2Bet, prevLines);
                updateGame2WinDisplay();
                recalculateTotalWin();

                if (cardWin > 0) {
                    showGame2CardWinOverlay(cardWin);
                }
            }

            if (game2Bet > 0) {
                checkGame2AppleReward(completedLines);
            }

            // 1. 在對應格子上繪製黃金雷射連線光條與方塊脈衝動畫
            this.drawWinningLines(matchedPatterns);

            // 2. 觸發連線時【先停留 1 秒 (1000ms)】讓玩家清晰看清主棋盤連線狀況，之後再觸發銷毀！
            setTimeout(() => {
                this.triggerCardDestructionAndNextDrop();
            }, 1000);
        } else {
            // 若未達成連線，但當前主棋盤是「LV MAX 刷新的 combo 延續卡」（生命週期僅限下一球/下一批發球）：
            if (this.isLvMaxRefreshedCard) {
                this.isLvMaxRefreshedCard = false;
                this.isLvMaxComboChain = false;
                game2LvMaxCombo = 0;
                updateGame2ComboBadge();
                // 該 LV MAX 刷新的主棋盤未能在下一球達成 combo，立即消滅，備用棋盤補充！
                this.triggerCardDestructionAndNextDrop();
            }
        }
    },

    triggerCardDestructionAndNextDrop() {
        if (this.isCardChanging) return;
        this.isCardChanging = true;

        // 當該張棋盤消失銷毀的同時，即時獲取金額勳章動畫同時消失！
        hideGame2CardWinOverlay();

        const frameEl = document.querySelector('.g2-card-frame');
        if (frameEl) {
            frameEl.classList.add('g2-card-destroying');
        }

        setTimeout(() => {
            if (frameEl) frameEl.classList.remove('g2-card-destroying');
            this.clearWinningLines();

            game2CardNum++;

            // 判斷是否是在 LV MAX 狀態下消除並觸發連擊 combo
            if (this.isLvMaxComboChain) {
                // 主棋盤在 LV MAX 狀態下消除：下一張棋盤【不會】從上方的備用棋盤補充！
                // 自動更新一張同樣是 LV MAX 的棋盤，備用棋盤保持凍結保留！
                game2Level = 9;
                this.generateCard(9);
                this.isLvMaxComboChain = false;
                this.isLvMaxRefreshedCard = true; // 標記此新刷新卡生命週期僅限「下一球/下一批發球」！
            } else {
                // 若未達成 LV MAX 消除或 Combo 中斷，恢復正常從備用棋盤補充
                game2LvMaxCombo = 0;
                this.isLvMaxRefreshedCard = false;
                updateGame2ComboBadge();

                // 備用棋盤下降補充成為主體棋盤
                game2Level = this.nextLevel;
                this.gridData = this.nextGridDataFull;

                // 第二張開始的備用棋盤，依據設定的權重機率抽 LV1 ~ LV MAX
                let newNextLevel = getRandomGame2Level();
                this.generateNextCard(newNextLevel);
            }

            // 重置卡片變更狀態標誌
            this.isCardChanging = false;

            // 重新渲染UI
            this.renderUI();
        }, 600);
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

        if (!isRainbow && (logicalColor === game3TargetColor || (dualPair && dualPair.includes(game3TargetColor)))) {
            game3TotalTargetBalls++;
            triggerClawDropAnimation();

            if (window.game3ExtraClawBallPending) {
                window.game3ExtraClawBallPending = false;
                game3TotalTargetBalls++; // 商店特惠：額外多獲得 1 球與金額，不增加連續連鎖數
                DOM.drawStatus.textContent = `🎯 商店特惠：夾夾樂額外加獲得 1 球與金額獎勵！ 🎯`;
            }

            // 凡是 HIT 門檻 <= 目前累積球數 (game3TotalTargetBalls) 的蘋果 (含彩虹蘋果)，全數收集！避免因商店多加1球跳過HIT門檻而漏抓！
            let collectedApples = game3ApplesInPlay.filter(a => a.hit <= game3TotalTargetBalls);
            if (collectedApples.length > 0) {
                game3ApplesInPlay = game3ApplesInPlay.filter(a => a.hit > game3TotalTargetBalls);
                if (game3Bet > 0) {
                    collectedApples.forEach(collectedApple => {
                        collectApple(collectedApple.type, game3Bet);
                    });
                    DOM.drawStatus.textContent = `🎯 夾中蘋果！已存入蘋果進度表！ 🎯`;
                }
                this.updateHitTable();
            }
        }

        if (game3Bet > 0) {
            let baseRate = (game3TargetColor === 'white') ? 1.0 : 0.5;
            let maxM = game3MaxMultiplier > 0 ? game3MaxMultiplier : 1.0;
            game3TotalWin = Math.floor((game3Bet * baseRate) * maxM) * Math.max(0, game3TotalTargetBalls - 1);
        } else {
            game3TotalWin = 0;
        }
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

async function playRainbowAppleCutscene(targetGame) {
    const cutscene = document.getElementById('rainbow-apple-cutscene');
    const subText = document.getElementById('rainbow-cutscene-sub');
    const bigAppleContainer = document.getElementById('rainbow-big-apple-container');
    if (bigAppleContainer) bigAppleContainer.innerHTML = getRainbowAppleSVGHtml('9.5rem');
    const gameNames = { 1: '消消樂 (遊戲 1)', 2: '九宮格 (遊戲 2)', 3: '夾夾樂 (遊戲 3)' };
    if (subText) subText.textContent = `即將降臨至 ${gameNames[targetGame]}！`;
    if (cutscene) cutscene.classList.add('show');
    
    await sleep(3500); // 3.5秒全螢幕集氣動畫
    
    // ** 自動將降臨目標遊戲從右側備用區切換至主畫面 **
    switchActiveGame('game' + targetGame);
    
    const targetEl = document.getElementById('game' + targetGame + '-container');
    if (targetEl) {
        targetEl.classList.add('rainbow-landing-flash');
        setTimeout(() => targetEl.classList.remove('rainbow-landing-flash'), 1200);
    }
    
    await sleep(500);
    if (cutscene) cutscene.classList.remove('show');
    
    applyRainbowAppleToTargetGame(targetGame);
}

function applyRainbowAppleToTargetGame(targetGame) {
    let preGenerated = targetGame === 1 ? game1PreApples : (targetGame === 2 ? game2PreApples : game3PreApples);
    
    if (!preGenerated || preGenerated.length === 0) {
        generateBetApples(targetGame);
        preGenerated = targetGame === 1 ? game1PreApples : (targetGame === 2 ? game2PreApples : game3PreApples);
    }
    
    if (preGenerated && preGenerated.length > 0) {
        preGenerated[0].type = 'rainbow';
        generateBetApples(targetGame);
    }

    if (targetGame === 1) {
        spawnApples();
    } else if (targetGame === 2) {
        generateGame2AppleThresholds();
        window.g2RainbowAppleActive = true;
    } else if (targetGame === 3) {
        if (game3ApplesInPlay && game3ApplesInPlay.length > 0) {
            game3ApplesInPlay[0].type = 'rainbow';
            Game3Manager.updateHitTable();
        } else {
            game3ApplesInPlay = [{ hit: 3, type: 'rainbow' }];
            Game3Manager.updateHitTable();
        }
        window.g3RainbowAppleActive = true;
    }
}

async function startGame() {
    try {
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
            if (DOM.mgColorRules) DOM.mgColorRules.innerHTML = '';
            for (let i=0; i<3; i++) {
                currentStepMapping[selected[i]] = steps[i];
                if (DOM.mgColorRules) {
                    DOM.mgColorRules.innerHTML += `
                        <div class="track-square" style="background: var(--color-${selected[i]}); margin: 0 10px; font-size: 1.1rem; color: #fff; font-weight: bold; width: 25px; height: 25px; border-radius: 4px; display: flex; align-items: center; justify-content: center;">${steps[i]}</div>
                    `;
                }
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
        game3TotalWin = 0;
        bonusWin = 0;
        ballCount = 0;
        currentCombo = 0;
        allClearBonusCount = 0;
        batchEliminatedAny = false;
        if (DOM.ballCountText) DOM.ballCountText.textContent = ballCount;
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
        
        if (DOM.btnStart) DOM.btnStart.disabled = true;
        document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = true);
        document.querySelectorAll('.color-btn').forEach(btn => btn.style.pointerEvents = 'none'); // 禁用選色
        if (DOM.ballHistory) DOM.ballHistory.innerHTML = '';
        hideAllOutOverlays();
        
        if (DOM.safeIndicator) {
            DOM.safeIndicator.textContent = '前 3 球安全保障！';
            DOM.safeIndicator.className = 'safe-indicator';
        }
        
        initBoard();
        spawnApples();
        
        // ** 商店 (Shop System) 重置 **
        shopTriggeredForBall = {};
        window.game3ExtraClawBallPending = false;
        stagedShopApples = [];
        if (window.updateStagedApplesUI) window.updateStagedApplesUI();

        // ** 彩虹蘋果 (Rainbow Apple) 1% 機率登場機制 **
        isRainbowAppleThisRound = false;
        rainbowAppleTargetGame = 0;
        rainbowAppleDirectJPTriggered = false;
        window.g2RainbowAppleActive = false;
        window.g3RainbowAppleActive = false;

        // 清除上一局遺留的彩虹蘋果狀態，確保全場最多只會有 1 顆彩虹蘋果降臨
        [game1PreApples, game2PreApples, game3PreApples].forEach(arr => {
            if (arr) {
                arr.forEach(a => {
                    if (a.type === 'rainbow') a.type = getAppleType();
                });
            }
        });

        let betGames = [];
        if (game1Bet > 0) betGames.push(1);
        if (game2Bet > 0) betGames.push(2);
        if (game3Bet > 0) betGames.push(3);

        let isRainbowTriggered = forceRainbowAppleDebug || (Math.random() < 0.01);
        forceRainbowAppleDebug = false;

        if (isRainbowTriggered && betGames.length > 0) {
            isRainbowAppleThisRound = true;
            rainbowAppleTargetGame = betGames[Math.floor(Math.random() * betGames.length)];
            await playRainbowAppleCutscene(rainbowAppleTargetGame);
        }

        pendingDrawsQueue = 3;
        pendingInitialBatch = 3;
        
        if (DOM.drawStatus) DOM.drawStatus.textContent = '遊戲開始！';
        await sleep(1000);
        
        leftEngineActive = true;
        startLeftEngine();
        startRightEngine();
    } catch (err) {
        console.error("Error in startGame:", err);
        isPlaying = false;
        leftEngineActive = false;
        boardState = 'IDLE';
        if (DOM.btnStart) DOM.btnStart.disabled = false;
        document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = false);
        document.querySelectorAll('.color-btn').forEach(btn => btn.style.pointerEvents = 'auto');
    }
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
    if (!DOM.ballHistory) return;
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
    if (!DOM.rouletteResultText) return;
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
    let wrapper = document.querySelector('.roulette-wheel-wrapper');
    if (!wrapper) return;

    let orbitEl = document.createElement('div');
    orbitEl.className = 'roulette-ball-orbit';
    let ballEl = document.createElement('div');
    ballEl.className = 'roulette-ball visible';
    orbitEl.appendChild(ballEl);
    
    wrapper.appendChild(orbitEl);
    
    let ballObj = { orbitEl, ballEl, state: 'spinning_outer', offsetAngle: 0 };
    activeBalls.push(ballObj);
    
    if (DOM.fireBox) {
        DOM.fireBox.classList.add('active');
        DOM.fireBox.textContent = '發球！';
    }
    
    orbitEl.style.transition = 'none';
    orbitEl.style.transform = `rotate(0deg)`;
    void orbitEl.offsetWidth; 
    
    let baseSpins = 3 * 360; 
    
    let possibleIndices = [];
    for (let i = 0; i < OUTER_WHEEL_SLOTS.length; i++) {
        if (OUTER_WHEEL_SLOTS[i] === targetMain) possibleIndices.push(i);
    }
    if (possibleIndices.length === 0) possibleIndices = [0];
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
        if (DOM.fireBox) {
            DOM.fireBox.classList.remove('active');
            DOM.fireBox.textContent = 'WAIT';
        }
        ballEl.classList.remove('visible');
        updateResultText(targetMain.toUpperCase(), targetMain);
        await sleep(500);
    } else {
        await sleep(500);
        
        if (DOM.rouletteResultText) {
            DOM.rouletteResultText.textContent = '進入內圈小轉盤！';
            DOM.rouletteResultText.style.color = '#a855f7';
        }
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
        
        if (DOM.fireBox) {
            DOM.fireBox.classList.remove('active');
            DOM.fireBox.textContent = 'WAIT';
        }
        ballEl.classList.remove('visible'); 
        updateResultText(innerTargetText, innerTargetColor);
        await sleep(800);
    }
    
    orbitEl.remove();
    activeBalls = activeBalls.filter(b => b !== ballObj);
}

async function shootBallAsync(isSafeMode, isBatchMode = false) {
    try {
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
                if (DOM.drawStatus) DOM.drawStatus.textContent = '抽中 OUT！等待盤面結算...';
                return 'game_over';
            } else {
                if (DOM.drawStatus) DOM.drawStatus.textContent = '安全期！抽中白球不結束。';
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
                if (DOM.drawStatus) DOM.drawStatus.textContent = '彩色球！獲得雷射！';
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
                if (DOM.drawStatus) DOM.drawStatus.textContent = '小轉盤：同步消除雙色！';
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
            if (DOM.drawStatus) DOM.drawStatus.textContent = `抽中 ${COLOR_ZH[color]}！`;
            return 'color';
        }
    } catch (e) {
        console.error("Error in shootBallAsync:", e);
        return 'error';
    }
}

async function checkAndTriggerShop(currentBall, forceRainbowEvent = false) {
    let thresholds = [10, 20, 30];
    for (let t of thresholds) {
        if (currentBall >= t && !shopTriggeredForBall[t] && t < 40) {
            shopTriggeredForBall[t] = true;
            await triggerShopModalProcess(forceRainbowEvent);
            break;
        }
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
                    
                    // 批次發球 (初始 3球 / 彩色洞 3球) 全部進洞後，統一進行盤面連線檢定！
                    await Promise.all(promises);
                    Game2Manager.evaluateLineCheck();
                    
                    // 備註1: 檢定是否在批次期間連續觸發彩色洞，若有觸發，先彈出商店 (價格+20%) 再續發3球
                    let isRainbowEvent = (rainbowTriggeredCount > 0);
                    await checkAndTriggerShop(ballCount, isRainbowEvent);
                    
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
                    
                    // 備註2: 若剛好在第 10, 20, 30 球進彩色洞，商店先出來 (價格+20%)，之後才加入並發射3球
                    let isRainbowHitOnThreshold = (res === 'rainbow' && [10, 20, 30].includes(ballCount));
                    await checkAndTriggerShop(ballCount, isRainbowHitOnThreshold);
                    
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
                                if (block.attachedApple && game3Bet > 0) collectApple(block.attachedApple, game3Bet);
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
                                    if (block.attachedApple && game3Bet > 0) collectApple(block.attachedApple, game3Bet);
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
                                if (block.attachedApple && game3Bet > 0) collectApple(block.attachedApple, game3Bet);
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
                                    if (block.attachedApple && game3Bet > 0) collectApple(block.attachedApple, game3Bet);
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
                    if (block.attachedApple && game3Bet > 0) {
                        collectApple(block.attachedApple, game3Bet);
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
    // 提高機率至 35%：消除補充色球時，有 35% 機率補充 1~3 顆普通銀色金錢球
    if (spawnMoneyBallsChance < 35 && emptySpots.length > 0) {
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
            // 連鎖發生的金錢球：金色背景 + 金色框 (isChainReward = true)
            block = createBlock(-1, c, null, true, guaranteedRewardValue, false, true);
        } else if (randomMoneySpots.has(i)) {
            // 消除補充機率產生的金錢球：保持普通銀色背景 + 銀色框 (isChainReward = false)
            let randomValue = getRandomMoneyBallValue();
            block = createBlock(-1, c, null, true, randomValue, false, false);
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
                
                // 清除普通附著蘋果本身的動畫，避免一直跳動（彩虹蘋果保留動畫）
                if (topApplesState[c].type !== 'rainbow') {
                    smallApple.style.animation = 'none';
                }
                
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
        showRoundEndOutOverlays();
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
                if (miniGameSteps < 20) {
                    let compScore = Math.round(activeJPAmount / 3);
                    DOM.drawStatus.textContent = `🎯 JP結算！未達 20 島，發放補償 3 顆金蘋果 (每顆 ${compScore} 分)！ 🎯`;
                    
                    let div = document.createElement('div');
                    div.style.position = 'fixed';
                    div.style.top = '25%';
                    div.style.left = '50%';
                    div.style.transform = 'translate(-50%, -50%)';
                    div.style.background = 'radial-gradient(circle, rgba(15,23,42,0.96), rgba(0,0,0,0.98))';
                    div.style.color = '#fde047';
                    div.style.padding = '20px 40px';
                    div.style.borderRadius = '20px';
                    div.style.fontSize = '2rem';
                    div.style.fontWeight = '900';
                    div.style.zIndex = '99999';
                    div.style.border = '3px solid #facc15';
                    div.style.boxShadow = '0 0 35px #facc15';
                    div.style.textAlign = 'center';
                    div.innerHTML = `🍎 JP未達20島補償 🍎<br><span style="font-size:1.4rem; color:#fff;">繼承原 JP 獎金 (${activeJPAmount} 分)，獲得 3 顆金蘋果！<br>每顆金蘋果分數: ${compScore} 分</span>`;
                    document.body.appendChild(div);

                    for (let i = 0; i < 3; i++) {
                        collectApple('gold', null, compScore);
                        await sleep(400);
                    }

                    await sleep(3000);
                    div.remove();
                } else {
                    let ratio = 0;
                    if (miniGameSteps >= 90) ratio = 0.20;
                    else if (miniGameSteps >= 50) ratio = 0.10;
                    else ratio = 0.05;
                    
                    let reward = Math.floor(activeJPAmount * ratio);
                    if ((game1Bet > 0 || game2Bet > 0 || game3Bet > 0) && reward > 0) {
                        bonusWin += reward;
                        recalculateTotalWin();
                        DOM.drawStatus.textContent = `🎯 JP結算！抵達 ${miniGameSteps} 島，獲得獎金 ${reward} 🎯`;
                        await sleep(3000);
                    }
                }
            }
        }
    }
    
    // ** 結算並將商店購買的暫存蘋果存入 7 蘋果進度條 **
    if (stagedShopApples.length > 0) {
        DOM.drawStatus.textContent = `🎯 正在將商店購買的 ${stagedShopApples.length} 顆蘋果存入 7 蘋果進度表...`;
        await sleep(1500);
        stagedShopApples.forEach(a => {
            collectApple(a.type, a.bet);
        });
        stagedShopApples = [];
        updateStagedApplesUI();
    }
    
    if (rainbowAppleDirectJPTriggered) {
        rainbowAppleDirectJPTriggered = false;
        let notice = document.getElementById('jp-roulette-notice');
        if (notice) notice.classList.remove('hidden');
        DOM.drawStatus.textContent = `🎯 彩虹蘋果直通！準備進入 JP 轉盤遊戲... 🎯`;
        await sleep(3500);
        if (notice) notice.classList.add('hidden');
        await sleep(500);
        await runJPRouletteGame();
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
    showRoundEndOutOverlays();
    DOM.btnStart.disabled = false;
    document.querySelectorAll('.chip-btn').forEach(btn => btn.disabled = false);
    document.querySelectorAll('.color-btn').forEach(btn => btn.style.pointerEvents = 'auto');
    DOM.drawStatus.textContent = `請押分，並按開始`;
    DOM.betInputs.forEach(el => el.textContent = "0");
    game1Bet = 0;
    game2Bet = 0;
    game3Bet = 0;
    updateGame2OddsPanel();
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


function collectApple(type, customBet = null, customScore = null) {
    if (type === 'rainbow') {
        let totalBet = (game1Bet > 0 ? game1Bet : 0) + (game2Bet > 0 ? game2Bet : 0) + (game3Bet > 0 ? game3Bet : 0);
        let jpScore = Math.floor((totalBet / 600) * 10000);
        activeJPAmount = jpScore;
        rainbowAppleDirectJPTriggered = true;
        
        let div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.top = '30%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.background = 'radial-gradient(circle, rgba(15,23,42,0.96), rgba(0,0,0,0.98))';
        div.style.color = '#fde047';
        div.style.padding = '25px 45px';
        div.style.borderRadius = '24px';
        div.style.fontSize = '2.2rem';
        div.style.fontWeight = '900';
        div.style.zIndex = '99999';
        div.style.border = '3px solid #facc15';
        div.style.boxShadow = '0 0 35px #facc15, 0 0 70px #3b82f6';
        div.style.textAlign = 'center';
        div.innerHTML = `🌈 獲得彩虹蘋果！ 🌈<br><span style="font-size:1.5rem; color:#6ee7b7;">直通 JP 轉盤！JP 獎金估算: ${jpScore}</span>`;
        document.body.appendChild(div);
        setTimeout(() => { div.remove(); }, 3500);
        return;
    }

    if (customScore === null || customScore === undefined) {
        let activeBet = (customBet !== null && customBet !== undefined) ? customBet : (game1Bet > 0 ? game1Bet : 0);
        if (activeBet <= 0) return; // 若當前遊戲壓分為 0，絕對不可收集蘋果！
    }

    if (currentAppleColors.length === 7) {
        currentAppleColors = []; 
        currentAppleScores = [];
    }
    
    currentAppleColors.push(type);
    
    let score = 0;
    if (customScore !== null && customScore !== undefined) {
        score = Math.round(customScore);
    } else {
        let activeBet = (customBet !== null && customBet !== undefined) ? customBet : (game1Bet > 0 ? game1Bet : 0);
        switch (type) {
            case 'gold': score = activeBet * 2.5; break;
            case 'silver': score = activeBet * 1.5; break;
            case 'bronze': score = activeBet * 1.0; break;
            case 'red': score = activeBet * 0.5; break;
            case 'green': score = activeBet * 0.25; break;
        }
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

// 響應式全螢幕直視自適應縮放引擎（專為平板與多端螢幕設計，確保 100% 免滑動直視全畫面）
function resizeApp() {
    const wrapper = document.querySelector('.app-wrapper');
    if (!wrapper) return;
    
    // 暫時解除縮放以取得真實原始尺寸
    wrapper.style.transform = 'none';
    wrapper.style.transformOrigin = 'center center';
    
    const appWidth = wrapper.offsetWidth;
    const appHeight = wrapper.offsetHeight;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 預留 10px 邊距安全值
    const scaleX = (windowWidth - 10) / appWidth;
    const scaleY = (windowHeight - 10) / appHeight;
    
    // 取較小值等比例縮放，最大不超過 100% 原始大小
    let scale = Math.min(scaleX, scaleY);
    if (scale > 1) scale = 1;
    
    wrapper.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', resizeApp);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeApp, 100);
    setTimeout(resizeApp, 300);
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeApp);
}

window.addEventListener('DOMContentLoaded', () => {
    switchActiveGame('game1');
    Game2Manager.init();
    setTimeout(resizeApp, 50);
    setTimeout(resizeApp, 200);
    setTimeout(resizeApp, 600);

    const btnDebugRainbow = document.getElementById('btn-debug-rainbow');
    if (btnDebugRainbow) {
        btnDebugRainbow.addEventListener('click', () => {
            forceRainbowAppleDebug = true;
            alert("🌈 下一局將 100% 觸發彩虹蘋果登場！請設定押分並點擊 [開始遊戲]！");
        });
    }

    // ** 開分 & 洗分 密碼驗證與連擊授權邏輯 **
    const ADMIN_PASSWORD = '787878';
    let depositAuthExpiryTimestamp = 0; // 10秒內免密碼 (從輸入正確密碼起算，點擊不刷新)
    let clearAuthExpiryTimestamp = 0;   // 5秒內免密碼 (從輸入正確密碼起算，點擊不刷新)
    let pendingAdminAction = null;       // 'deposit' 或 'clear'

    function handleDepositCredit() {
        let now = Date.now();
        if (now < depositAuthExpiryTimestamp) {
            executeDepositCredit();
        } else {
            pendingAdminAction = 'deposit';
            showPasswordModal("💳 請輸入開分授權密碼");
        }
    }

    function handleClearCredit() {
        let now = Date.now();
        if (now < clearAuthExpiryTimestamp) {
            executeClearCredit();
        } else {
            pendingAdminAction = 'clear';
            showPasswordModal("🧹 請輸入洗分授權密碼");
        }
    }

    function executeDepositCredit() {
        credit += 10000;
        updateCreditDisplay();
        DOM.drawStatus.textContent = '💳 開分成功 (+10000)';
    }

    function executeClearCredit() {
        credit = 0;
        updateCreditDisplay();
        DOM.drawStatus.textContent = '🧹 洗分成功 (總分歸零)';
    }

    function showPasswordModal(titleText) {
        const modal = document.getElementById('password-modal');
        const title = document.getElementById('password-modal-title');
        const input = document.getElementById('password-input');
        if (modal && input) {
            if (titleText && title) title.textContent = titleText;
            input.value = '';
            modal.classList.remove('hidden');
            setTimeout(() => input.focus(), 100);
        }
    }

    function hidePasswordModal() {
        const modal = document.getElementById('password-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        pendingAdminAction = null;
    }

    function confirmPasswordModal() {
        const input = document.getElementById('password-input');
        if (!input) return;
        let val = input.value.trim();
        if (val === ADMIN_PASSWORD) {
            let action = pendingAdminAction;
            hidePasswordModal();
            let now = Date.now();
            if (action === 'deposit') {
                depositAuthExpiryTimestamp = now + 10000; // 從輸入正確密碼當刻起固定計算 10 秒，過後需重新輸入
                executeDepositCredit();
            } else if (action === 'clear') {
                clearAuthExpiryTimestamp = now + 5000; // 從輸入正確密碼當刻起固定計算 5 秒，過後需重新輸入
                executeClearCredit();
            }
        } else {
            alert("密碼錯誤！請重新輸入。");
            input.value = '';
            input.focus();
        }
    }

    const btnDeposit = document.getElementById('btn-deposit-credit');
    const btnClear = document.getElementById('btn-clear-credit');
    const btnSwitchMode = document.getElementById('btn-switch-mode');
    const btnPassCancel = document.getElementById('btn-password-cancel');
    const btnPassConfirm = document.getElementById('btn-password-confirm');
    const inputPass = document.getElementById('password-input');

    if (btnDeposit) btnDeposit.addEventListener('click', handleDepositCredit);
    if (btnClear) btnClear.addEventListener('click', handleClearCredit);
    if (btnSwitchMode) btnSwitchMode.addEventListener('click', toggleGameMode);
    if (btnPassCancel) btnPassCancel.addEventListener('click', hidePasswordModal);
    if (btnPassConfirm) btnPassConfirm.addEventListener('click', confirmPasswordModal);

    if (inputPass) {
        inputPass.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmPasswordModal();
            else if (e.key === 'Escape') hidePasswordModal();
        });
    }

    // ** 懸浮商店 (Shop System) 控制邏輯 **
    let shopTimerInterval = null;
    let shopSecLeft = 10;
    let shopResolvePromise = null;
    let shopActiveSlotData = {}; // 紀錄當次商店快照 (如蘋果取代欄位資料)
    let purchasedSlotsInCurrentShop = new Set(); // 紀錄當次商店已購買的欄位
    const APPLE_NAMES_MAP = {
        gold: '金蘋果',
        silver: '銀蘋果',
        bronze: '銅蘋果',
        red: '紅蘋果',
        green: '綠蘋果',
        rainbow: '彩虹蘋果'
    };

    window.updateStagedApplesUI = function updateStagedApplesUI() {
        const container = document.getElementById('shop-staged-apples-container');
        if (!container) return;
        container.innerHTML = '';
        stagedShopApples.forEach((a, idx) => {
            let el = document.createElement('div');
            el.className = 'staged-apple-item';
            el.innerHTML = `<span class="apple-item apple-${a.type}" style="font-size:1.6rem; margin:0;">🍎</span>`;
            el.title = `商店暫存蘋果 #${idx + 1}: ${APPLE_NAMES_MAP[a.type] || a.type} (${a.score}分)`;
            container.appendChild(el);
        });
    };
    const updateStagedApplesUI = window.updateStagedApplesUI;

    function getAppleScore(type, bet) {
        switch (type) {
            case 'gold': return Math.floor(bet * 2.5);
            case 'silver': return Math.floor(bet * 1.5);
            case 'bronze': return Math.floor(bet * 1.0);
            case 'red': return Math.floor(bet * 0.5);
            case 'green': return Math.floor(bet * 0.25);
            default: return Math.floor(bet * 0.25);
        }
    }

    window.triggerShopModalProcess = function(isRainbowEventShop = false) {
        return new Promise((resolve) => {
            shopResolvePromise = resolve;
            const modal = document.getElementById('shop-modal');
            const fillEl = document.getElementById('shop-timer-fill');
            const secEl = document.getElementById('shop-timer-sec');
            if (!modal) {
                resolve();
                return;
            }

            purchasedSlotsInCurrentShop.clear();

            // 遊戲2 (九宮格) 商品價格與升級等級隨機浮動計算
            let g2Random = Math.random() * 100;
            let g2Boost = 3;
            let g2PriceRatio = 1.0;
            if (g2Random < 30)      { g2Boost = 3; g2PriceRatio = 1.0; } // 30% (+3級, 1.0倍)
            else if (g2Random < 50) { g2Boost = 4; g2PriceRatio = 1.2; } // 20% (+4級, 1.2倍)
            else if (g2Random < 70) { g2Boost = 5; g2PriceRatio = 1.4; } // 20% (+5級, 1.4倍)
            else if (g2Random < 90) { g2Boost = 6; g2PriceRatio = 1.6; } // 20% (+6級, 1.6倍)
            else                     { g2Boost = 9; g2PriceRatio = 2.0; } // 10% (LV MAX, 2.0倍)

            // 遊戲3 (夾夾樂) 商品價格根據選色計算
            let g3PriceRatio = (game3TargetColor === 'white') ? 1.8 : 0.6; // 白球 1.8倍，其餘色 0.6倍

            // 判斷 10% 蘋果取代機制 (隨機選擇 第 2, 3, 4 格中的一格)
            let appleReplacedSlot = null;
            let replacedAppleData = null;
            if (Math.random() < 0.10) {
                appleReplacedSlot = Math.floor(Math.random() * 3) + 2;
                let slotGameBet = appleReplacedSlot === 2 ? game1Bet : (appleReplacedSlot === 3 ? game2Bet : game3Bet);
                let actualAppleBet = slotGameBet > 0 ? slotGameBet : 600; // 無壓分則一律以基本分 600 計算
                
                // 計算蘋果價格 (基本為 1.0倍壓分；若為彩色洞特別商店，額外增加 0.2倍壓分)
                let appleBasePrice = actualAppleBet;
                let appleSurcharge = isRainbowEventShop ? Math.floor(actualAppleBet * 0.2) : 0;
                let appleFinalPrice = appleBasePrice + appleSurcharge;

                let appleType = getAppleType(); // 隨機產生 5 種品質顏色 (金/銀/銅/紅/綠)
                let appleScore = getAppleScore(appleType, actualAppleBet);
                replacedAppleData = { type: appleType, bet: actualAppleBet, price: appleFinalPrice, score: appleScore };
            }

            // 計算各遊戲商品最終價格 (含備註1 & 備註2 之 2成加成)
            let prices = {
                2: Math.floor(game1Bet * 1.0) + (isRainbowEventShop ? Math.floor(game1Bet * 0.2) : 0),
                3: Math.floor(game2Bet * g2PriceRatio) + (isRainbowEventShop ? Math.floor(game2Bet * 0.2) : 0),
                4: Math.floor(game3Bet * g3PriceRatio) + (isRainbowEventShop ? Math.floor(game3Bet * 0.2) : 0)
            };

            shopActiveSlotData = {
                appleReplacedSlot: appleReplacedSlot,
                replacedAppleData: replacedAppleData,
                g2Boost: g2Boost,
                prices: prices,
                isRainbowEventShop: isRainbowEventShop
            };

            // 渲染 4 個欄位 (根據有無壓分、價格與蘋果替代動態顯示)
            renderShopModalCards(shopActiveSlotData);

            shopSecLeft = 10;
            if (secEl) secEl.textContent = '10';
            if (fillEl) {
                fillEl.style.transition = 'none';
                fillEl.style.width = '100%';
                requestAnimationFrame(() => {
                    fillEl.style.transition = 'width 1s linear';
                });
            }

            modal.classList.remove('hidden');
            let statusPrefix = isRainbowEventShop ? '🌈 [彩色洞特別商店 (+20%金額加成)] ' : '🛒 ';
            DOM.drawStatus.textContent = `${statusPrefix}商店開放中 (停留 10 秒)！請點選商品購買...`;

            if (shopTimerInterval) clearInterval(shopTimerInterval);
            shopTimerInterval = setInterval(() => {
                shopSecLeft--;
                if (secEl) secEl.textContent = shopSecLeft;
                if (fillEl) fillEl.style.width = `${(shopSecLeft / 10) * 100}%`;

                if (shopSecLeft <= 0) {
                    closeShopAndFinish(); // 10秒到期自動關閉商店
                }
            }, 1000);
        });
    };

    function renderShopModalCards(slotData) {
        const cards = document.querySelectorAll('.shop-item-card');
        const { appleReplacedSlot, replacedAppleData, g2Boost, prices } = slotData;

        cards.forEach(card => {
            let itemIndex = parseInt(card.getAttribute('data-item'));
            if (itemIndex === 1) return; // 不買欄位始終保持可用

            card.className = 'shop-item-card'; // 重置 CSS 類別
            let gameBet = itemIndex === 2 ? game1Bet : (itemIndex === 3 ? game2Bet : game3Bet);

            let badge = card.querySelector('.shop-card-badge');
            let icon = card.querySelector('.shop-card-icon');
            let title = card.querySelector('.shop-card-title');
            let desc = card.querySelector('.shop-card-desc');

            if (itemIndex === appleReplacedSlot && replacedAppleData) {
                // 蘋果取代該欄位 (不管有無壓分，皆可購買)
                card.classList.add('card-apple');
                if (badge) badge.textContent = `${replacedAppleData.price} BET`;
                if (icon) {
                    icon.className = `shop-card-icon apple-item apple-${replacedAppleData.type}`;
                    icon.innerHTML = '🍎';
                }
                if (title) title.textContent = APPLE_NAMES_MAP[replacedAppleData.type] || '特別蘋果';
                if (desc) desc.innerHTML = `分值: ${replacedAppleData.score} 分<br>局末加入 7 蘋果進度`;
            } else if (gameBet <= 0) {
                // 該遊戲未壓分 -> 顯示售完/鎖定，無法購買
                card.classList.add('card-soldout');
                if (badge) badge.textContent = '鎖定';
                if (icon) {
                    icon.className = 'shop-card-icon';
                    icon.innerHTML = '售完';
                }
                if (title) title.textContent = '售完';
                if (desc) desc.innerHTML = '未壓分無法購買';
            } else {
                // 該遊戲有壓分 -> 恢復預設商品 (顯示精確結算後的購買金額)
                let itemPrice = prices[itemIndex] || gameBet;
                if (badge) badge.textContent = `${itemPrice} BET`;

                if (itemIndex === 2) {
                    card.classList.add('card-clear');
                    if (icon) { icon.className = 'shop-card-icon'; icon.innerHTML = '消'; }
                    if (title) title.textContent = '全消閃爍球';
                    if (desc) desc.innerHTML = '遊戲1: 3顆球變閃爍<br>消除時該色全清';
                } else if (itemIndex === 3) {
                    card.classList.add('card-upgrade');
                    if (icon) { icon.className = 'shop-card-icon'; icon.innerHTML = '升'; }
                    let boostText = g2Boost >= 9 ? 'LV MAX' : `+${g2Boost}級`;
                    if (title) title.textContent = `預備盤升級 (${boostText})`;
                    if (desc) desc.innerHTML = `遊戲2: 備用棋盤<br>提升 ${g2Boost >= 9 ? '至 LV MAX' : '+' + g2Boost + ' 級'}`;
                } else if (itemIndex === 4) {
                    card.classList.add('card-claw');
                    if (icon) { icon.className = 'shop-card-icon'; icon.innerHTML = '夾'; }
                    if (title) title.textContent = '雙倍夾球數';
                    if (desc) desc.innerHTML = '遊戲3: 下次進目標色<br>多得1球與金額';
                }
            }
        });
    }

    function closeShopAndFinish() {
        if (shopTimerInterval) {
            clearInterval(shopTimerInterval);
            shopTimerInterval = null;
        }
        const modal = document.getElementById('shop-modal');
        if (modal) modal.classList.add('hidden');

        DOM.drawStatus.textContent = '🛒 商店關閉，大轉盤繼續發球...';

        if (shopResolvePromise) {
            let res = shopResolvePromise;
            shopResolvePromise = null;
            res();
        }
    }

    function handleShopCardClick(itemIndex) {
        if (itemIndex === 1) {
            // 最左欄 "不買" / 取消 -> 立即關閉商店
            closeShopAndFinish();
            return;
        }

        if (purchasedSlotsInCurrentShop.has(itemIndex)) {
            DOM.drawStatus.textContent = `🛒 該商品在此次商店已購買過！`;
            return;
        }

        let success = executeShopPurchase(itemIndex);
        if (success) {
            purchasedSlotsInCurrentShop.add(itemIndex);
            markCardAsPurchased(itemIndex);
        }
    }

    function markCardAsPurchased(itemIndex) {
        const card = document.querySelector(`.shop-item-card[data-item="${itemIndex}"]`);
        if (!card) return;
        card.classList.add('card-purchased');
        let badge = card.querySelector('.shop-card-badge');
        let icon = card.querySelector('.shop-card-icon');
        let title = card.querySelector('.shop-card-title');
        let desc = card.querySelector('.shop-card-desc');

        if (badge) badge.textContent = '已購買';
        if (icon) {
            icon.className = 'shop-card-icon';
            icon.innerHTML = '✓';
        }
        if (title) title.textContent = '已購買';
        if (desc) desc.textContent = '已成功購買此商品';
    }

    function executeShopPurchase(itemIndex) {
        // 如果點選的是蘋果取代欄位 (不管有無壓分)
        if (itemIndex === shopActiveSlotData.appleReplacedSlot && shopActiveSlotData.replacedAppleData) {
            let appleData = shopActiveSlotData.replacedAppleData;
            if (credit < appleData.price) {
                alert("餘額不足，無法購買！");
                return false;
            }
            credit -= appleData.price;
            updateCreditDisplay();

            stagedShopApples.push(appleData);
            updateStagedApplesUI();
            DOM.drawStatus.textContent = `🛒 成功購買商店 ${APPLE_NAMES_MAP[appleData.type] || ''} (價值 ${appleData.score} 分)！可繼續購買其他商品！`;
            return true;
        }

        let gameBet = itemIndex === 2 ? game1Bet : (itemIndex === 3 ? game2Bet : game3Bet);
        if (gameBet <= 0) {
            alert("該遊戲未壓分，無法購買商品！");
            return false;
        }

        let itemPrice = shopActiveSlotData.prices[itemIndex] || gameBet;
        if (credit < itemPrice) {
            alert("餘額不足，無法購買！");
            return false;
        }
        credit -= itemPrice;
        updateCreditDisplay();

        if (itemIndex === 2) {
            // 第二格：消
            let candidateBlocks = [];
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    let block = board[r][c];
                    if (block !== null && !block.isMoney) {
                        candidateBlocks.push(block);
                    }
                }
            }
            candidateBlocks.sort(() => Math.random() - 0.5);
            let selected = candidateBlocks.slice(0, 3);
            selected.forEach(b => {
                b.isFlash = true;
                b.el.classList.add('block-super-flashing');
            });
            DOM.drawStatus.textContent = `🛒 商店購買成功！遊戲1 已產生 3 顆全消閃爍球！可繼續購買其他商品！`;
            return true;
        } else if (itemIndex === 3) {
            // 第三格：升
            let boost = shopActiveSlotData.g2Boost || 3;
            let currentNext = Game2Manager.nextLevel || 1;
            let newNext = Math.min(9, currentNext + boost);
            Game2Manager.generateNextCard(newNext);
            DOM.drawStatus.textContent = `🛒 商店購買成功！遊戲2 備用棋盤升級 ${boost >= 9 ? '至 LV MAX' : '+' + boost + '級 (LV.' + newNext + ')'}！可繼續購買其他商品！`;
            return true;
        } else if (itemIndex === 4) {
            // 第四格：夾
            window.game3ExtraClawBallPending = true;
            DOM.drawStatus.textContent = `🛒 商店購買成功！遊戲3 下次進目標色將獲得雙倍夾球數與金額！可繼續購買其他商品！`;
            return true;
        }
        return false;
    }

    // 綁定商店卡片點擊、雙擊與觸摸往上滑動手勢
    document.querySelectorAll('.shop-item-card').forEach(card => {
        let touchStartY = 0;

        // 雙擊確認
        card.addEventListener('dblclick', (e) => {
            let itemIndex = parseInt(e.currentTarget.getAttribute('data-item'));
            handleShopCardClick(itemIndex);
        });

        // 觸摸往上滑動確認
        card.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            card.classList.add('active-touch');
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            card.classList.remove('active-touch');
            let touchEndY = e.changedTouches[0].clientY;
            if (touchStartY - touchEndY > 30) { // 往上滑動超過 30px 算作確認
                let itemIndex = parseInt(e.currentTarget.getAttribute('data-item'));
                handleShopCardClick(itemIndex);
            }
        }, { passive: true });

        // 單擊點選確認
        card.addEventListener('click', (e) => {
            let itemIndex = parseInt(e.currentTarget.getAttribute('data-item'));
            handleShopCardClick(itemIndex);
        });
    });
});
