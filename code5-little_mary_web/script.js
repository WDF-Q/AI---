// script.js

// === 系統設定 ===
// 機台管理員密碼 (用於洗分與重設機台)，如果忘記可以來這裡查看或修改
const ADMIN_PASSWORD = "787878"; 
const ITEMS = [
    { name: "BAR", color: "var(--color-red)", odds: 50, has_image: false },
    { name: "77", color: "var(--color-blue)", odds: 40, has_image: false },
    { name: "STAR", color: "var(--color-yellow)", odds: 30, has_image: true },
    { name: "WATERMELON", color: "var(--color-green)", odds: 20, has_image: true },
    { name: "BELL", color: "var(--color-gold)", odds: 20, has_image: true },
    { name: "MANGO", color: "var(--color-green)", odds: 15, has_image: true },
    { name: "ORANGE", color: "var(--color-orange)", odds: 10, has_image: true },
    { name: "APPLE", color: "var(--color-red)", odds: 5, has_image: true },
    { name: "CHERRY", color: "var(--color-red)", odds: 2, has_image: true },
    { name: "TRAIN", color: "var(--color-purple)", odds: 0, has_image: false },
    { name: "LOSE", color: "var(--color-dark-red)", odds: 0, has_image: false },
    { name: "JACKPOT", color: "var(--color-cyan)", odds: 0, has_image: true },
];

const BOARD_CONFIG = [
    "ORANGE", "BELL", "CHERRY", "BAR", "JACKPOT", "CHERRY", "MANGO",
    "WATERMELON", "CHERRY", "TRAIN", "APPLE", "CHERRY",
    "ORANGE", "BELL", "CHERRY", "77", "APPLE", "CHERRY", "MANGO",
    "STAR", "CHERRY", "LOSE", "APPLE", "CHERRY"
];

const BET_OPTIONS = ["APPLE", "WATERMELON", "STAR", "77", "BAR", "BELL", "MANGO", "ORANGE", "CHERRY"];

// Game State Management
let currentMachineId = null;
let allMachinesData = {};
let game = null;
let globalVisits = 0;
let globalPlayTime = 0;

function createMachineData() {
    let state = {
        credits: 0,
        jackpot: 500.0,
        win_amount: 0,
        bets: {},
        total_accumulated_bets: 0,
        total_accumulated_cashout: 0,
        saved_bets_before_die: {},
        bets_modified_this_round: false,
        last_win_was_grand_prize: false,
        state: "IDLE",
        
        current_pos: 0,
        target_pos: 0,
        spin_timer: 0,
        spin_delay: 50,
        steps_remaining: 0,
        
        train_lights_left: 0,
        train_blink_count: 0,
        is_blinking_on: true,
        extra_spins_left: 0,
        bounce_steps: 0,
        bounce_delay: 50,
        
        multi_active_pos: [],
        bouncing_targets: [],
        
        grand_prize_blink_count: 0,
        is_blinking_left: true,
        left_half_pos: [],
        right_half_pos: [],
        grand_prize_half: ""
    };
    BET_OPTIONS.forEach(opt => {
        state.bets[opt] = 0;
        state.saved_bets_before_die[opt] = 0;
    });
    return {
        game: state,
        visits: 0,
        playTime: 0
    };
}

// DOM Elements
const boardGrid = document.getElementById('board-grid');
const betPanel = document.getElementById('bet-panel');
const cellEls = [];
const betEls = {};

// Info displays
const elCredits = document.getElementById('display-credits');
const elWin = document.getElementById('display-win');
const elJackpot = document.getElementById('display-jackpot');
const elTotalBets = document.getElementById('display-total-bets');
const elTotalCashout = document.getElementById('display-total-cashout');
const elGrandPrizeBanner = document.getElementById('grand-prize-banner');

// Modals
const modalOverlay = document.getElementById('modal-overlay');
const modalMessage = document.getElementById('modal-message');
const modalBtnConfirm = document.getElementById('modal-btn-confirm');
const modalBtnCancel = document.getElementById('modal-btn-cancel');
const modalInputPassword = document.getElementById('modal-input-password');
let pendingModalAction = null;

// Lobby
const lobbyContainer = document.getElementById('lobby-container');
const gameWrapper = document.getElementById('game-wrapper');
const btnBackLobby = document.getElementById('btn-back-lobby');
const gameTitle = document.getElementById('game-title');
const machineCards = document.querySelectorAll('.machine-card');

// Helpers
const getItemInfo = (name) => ITEMS.find(i => i.name === name);

// Setup Functions
function initLayout() {
    // 1. Setup Board 24 Cells
    const positions = [];
    for(let i=1; i<=7; i++) positions.push({col: i, row: 1}); // Top
    for(let i=2; i<=6; i++) positions.push({col: 7, row: i}); // Right
    for(let i=7; i>=1; i--) positions.push({col: i, row: 7}); // Bottom
    for(let i=6; i>=2; i--) positions.push({col: 1, row: i}); // Left

    for(let i=0; i<24; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.gridColumn = positions[i].col;
        cell.style.gridRow = positions[i].row;
        
        const itemName = BOARD_CONFIG[i];
        const info = getItemInfo(itemName);
        
        if (info.has_image) {
            const img = document.createElement('img');
            img.src = `assets/${itemName}.png`;
            // If image fails to load, fallback to text
            img.onerror = () => { img.style.display = 'none'; drawFallback(cell, itemName, info); };
            cell.appendChild(img);
        } else {
            drawFallback(cell, itemName, info);
        }
        
        boardGrid.appendChild(cell);
        cellEls.push(cell);
    }

    // 2. Setup Bet Buttons
    BET_OPTIONS.forEach(opt => {
        const info = getItemInfo(opt);
        const btn = document.createElement('div');
        btn.className = 'bet-btn';
        
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'bet-icon-wrapper';
        
        if (info.has_image) {
            const img = document.createElement('img');
            img.src = `assets/${opt}.png`;
            img.onerror = () => { img.style.display = 'none'; };
            iconWrapper.appendChild(img);
        } else {
            const txt = document.createElement('div');
            txt.textContent = opt;
            txt.style.color = info.color;
            txt.style.fontWeight = 'bold';
            txt.style.fontSize = '0.75rem';
            txt.style.whiteSpace = 'nowrap';
            iconWrapper.appendChild(txt);
        }
        btn.appendChild(iconWrapper);
        
        const odds = document.createElement('div');
        odds.className = 'bet-odds';
        odds.textContent = `x${info.odds}`;
        btn.appendChild(odds);
        
        const val = document.createElement('div');
        val.className = 'bet-value no-bet';
        val.textContent = '0';
        btn.appendChild(val);
        
        btn.addEventListener('click', () => handleBetClick(opt));
        
        betPanel.appendChild(btn);
        betEls[opt] = val;
    });

    // Initial UI Setup
    let dummy = createMachineData();
    game = dummy.game;
    updateUI();
    updateHeaderStats();
    game = null;
}

function drawFallback(cell, name, info) {
    if (name === "BAR") {
        const div = document.createElement('div');
        div.className = 'symbol-bar';
        div.innerHTML = 'BAR<br>BAR<br>BAR';
        cell.appendChild(div);
    } else if (name === "77") {
        const div = document.createElement('div');
        div.className = 'symbol-77';
        div.textContent = '77';
        cell.appendChild(div);
    } else if (name === "TRAIN") {
        const div = document.createElement('div');
        div.className = 'symbol-train';
        div.innerHTML = '火車<br>衝刺';
        cell.appendChild(div);
    } else if (name === "LOSE") {
        const div = document.createElement('div');
        div.className = 'symbol-lose';
        div.innerHTML = 'YOU<br>DIE';
        cell.appendChild(div);
    } else {
        const div = document.createElement('div');
        div.className = 'symbol-text';
        div.textContent = name.substring(0, 6);
        div.style.color = info.color;
        cell.appendChild(div);
    }
}

// Local Storage
function loadStats(machineId) {
    const data = localStorage.getItem(`littleMaryStats_${machineId}`);
    let mData = allMachinesData[machineId];
    if (data) {
        const parsed = JSON.parse(data);
        mData.game.total_accumulated_bets = parsed.bets || 0;
        mData.game.total_accumulated_cashout = parsed.cashout || 0;
    }
    
    let visits = localStorage.getItem(`globalVisits_${machineId}`);
    mData.visits = visits ? parseInt(visits) : 0;

    let pTime = localStorage.getItem(`globalPlayTime_${machineId}`);
    mData.playTime = pTime ? parseInt(pTime) : 0;
}

function saveStats() {
    if (!currentMachineId) return;
    let mData = allMachinesData[currentMachineId];
    localStorage.setItem(`littleMaryStats_${currentMachineId}`, JSON.stringify({
        bets: mData.game.total_accumulated_bets,
        cashout: mData.game.total_accumulated_cashout
    }));
    localStorage.setItem(`globalVisits_${currentMachineId}`, mData.visits);
    localStorage.setItem(`globalPlayTime_${currentMachineId}`, mData.playTime);
}

// Update play time every second
setInterval(() => {
    if (currentMachineId && game) {
        allMachinesData[currentMachineId].playTime += 1;
        globalPlayTime = allMachinesData[currentMachineId].playTime;
        localStorage.setItem(`globalPlayTime_${currentMachineId}`, globalPlayTime);
        updateHeaderStats();
    }
}, 1000);

function updateHeaderStats() {
    const elVisits = document.getElementById('stat-visits');
    const elTime = document.getElementById('stat-time');
    if (elVisits) elVisits.textContent = globalVisits;
    if (elTime) {
        let h = Math.floor(globalPlayTime / 3600);
        let m = Math.floor((globalPlayTime % 3600) / 60);
        let s = globalPlayTime % 60;
        let timeStr = "";
        if (h > 0) timeStr += h + "時";
        if (m > 0 || h > 0) timeStr += m + "分";
        timeStr += s + "秒";
        elTime.textContent = timeStr;
    }
}

// Interactions
function handleBetClick(opt) {
    if (!game) return;
    if (game.win_amount > 0) return;
    if (game.state !== "IDLE" && game.state !== "SHOW_WIN") return;
    
    if (game.credits >= 1) {
        game.credits -= 1;
        game.bets[opt] += 1;
        game.bets_modified_this_round = true;
        if (game.state === "SHOW_WIN") game.state = "IDLE";
        updateUI();
    }
}

function handleStart() {
    if (!game) return;
    if (game.state === "IDLE" || game.state === "SHOW_WIN") {
        if (game.win_amount > 0) {
            game.credits += game.win_amount;
            game.win_amount = 0;
            if (game.state === "SHOW_WIN") game.state = "IDLE";
            updateUI();
        } else {
            processStart();
        }
    } else if (["SPINNING", "TRAIN_SPINNING", "TRAIN_PAUSE", "TRAIN_BLINK", "TRAIN_BOUNCING", "GRAND_PRIZE_START"].includes(game.state)) {
        fastForward();
    }
}

function processStart() {
    let totalBet = Object.values(game.bets).reduce((a,b)=>a+b, 0);
    
    if (totalBet === 0) {
        let totalSaved = Object.values(game.saved_bets_before_die).reduce((a,b)=>a+b, 0);
        if (totalSaved > 0) {
            if (game.credits >= totalSaved) {
                game.credits -= totalSaved;
                game.bets = {...game.saved_bets_before_die};
                game.total_accumulated_bets += totalSaved;
                saveStats();
                startSpin();
            }
        }
        return;
    }
    
    if (!game.bets_modified_this_round) {
        if (game.credits >= totalBet) {
            game.credits -= totalBet;
            game.total_accumulated_bets += totalBet;
            saveStats();
            startSpin();
        }
    } else {
        game.total_accumulated_bets += totalBet;
        saveStats();
        startSpin();
    }
}

function getRandomTargetPos() {
    let rand = Math.random() * 100;
    let targetItem = "";
    if (rand < 1) targetItem = "BAR";
    else if (rand < 4) targetItem = "77";
    else if (rand < 7) targetItem = "STAR";
    else if (rand < 10) targetItem = "WATERMELON";
    else if (rand < 17) targetItem = "BELL";
    else if (rand < 24) targetItem = "MANGO";
    else if (rand < 31) targetItem = "ORANGE";
    else if (rand < 71) targetItem = "APPLE";
    else if (rand < 91) targetItem = "CHERRY";
    else if (rand < 91.5) targetItem = "TRAIN";
    else if (rand < 99.5) targetItem = "LOSE";
    else targetItem = "JACKPOT";

    let positions = [];
    for (let i = 0; i < BOARD_CONFIG.length; i++) {
        if (BOARD_CONFIG[i] === targetItem) {
            positions.push(i);
        }
    }
    return positions[Math.floor(Math.random() * positions.length)];
}

function startSpin() {
    game.win_amount = 0;
    game.bets_modified_this_round = false;
    game.multi_active_pos = [];
    game.saved_bets_before_die = {};
    BET_OPTIONS.forEach(opt => game.saved_bets_before_die[opt] = 0);
    game.last_win_was_grand_prize = false;
    
    if (Math.random() < 0.01) {
        game.state = "GRAND_PRIZE_START";
        game.spin_timer = Date.now();
        game.grand_prize_blink_count = 0;
        game.is_blinking_left = true;
        
        let allLeft = [3, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 15];
        game.left_half_pos = allLeft.filter(p => p!==21 && p!==9 && p!==4);
        
        let allRight = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        game.right_half_pos = allRight.filter(p => p!==21 && p!==9 && p!==4);
        
        game.multi_active_pos = [];
    } else {
        game.state = "SPINNING";
        game.target_pos = getRandomTargetPos();
        let steps_to_target = (game.target_pos - game.current_pos + 24) % 24;
        game.steps_remaining = 24 * 3 + steps_to_target;
        game.spin_delay = 20;
        game.spin_timer = Date.now();
    }
    updateUI();
}

function checkWin() {
    let itemName = BOARD_CONFIG[game.current_pos];
    let totalBet = Object.values(game.bets).reduce((a,b)=>a+b, 0);
    
    if (game.jackpot < 9999) {
        game.jackpot += totalBet * 0.1;
    }
    
    if (itemName === "TRAIN") {
        game.state = "TRAIN_PAUSE";
        game.spin_timer = Date.now();
    } else if (itemName === "LOSE") {
        game.win_amount = 0;
        game.saved_bets_before_die = {...game.bets};
        BET_OPTIONS.forEach(opt => game.bets[opt] = 0);
        game.state = "SHOW_WIN";
    } else if (itemName === "JACKPOT") {
        game.win_amount = Math.floor(game.jackpot);
        game.jackpot = 500.0;
        game.state = "SHOW_WIN";
    } else {
        if (game.bets[itemName] > 0) {
            let info = getItemInfo(itemName);
            game.win_amount = game.bets[itemName] * info.odds;
        }
        game.state = "SHOW_WIN";
    }
    updateUI();
}

function evaluateGrandPrize() {
    game.last_win_was_grand_prize = true;
    let win = 0;
    game.multi_active_pos.forEach(pos => {
        let itemName = BOARD_CONFIG[pos];
        if (BET_OPTIONS.includes(itemName) && game.bets[itemName] > 0) {
            let info = getItemInfo(itemName);
            win += game.bets[itemName] * info.odds;
        }
    });
    game.win_amount = win;
    game.state = "SHOW_WIN";
    updateUI();
}

function fastForward() {
    if (game.state === "SPINNING") {
        game.current_pos = game.target_pos;
        game.steps_remaining = 0;
        checkWin();
    } else if (game.state === "TRAIN_SPINNING") {
        while(game.train_lights_left > 0) {
            game.current_pos = (game.current_pos + 1) % 24;
            game.train_lights_left -= 1;
            let itemName = BOARD_CONFIG[game.current_pos];
            if (BET_OPTIONS.includes(itemName) && game.bets[itemName] > 0) {
                let info = getItemInfo(itemName);
                game.win_amount += game.bets[itemName] * info.odds;
            }
        }
        game.state = "SHOW_WIN";
    } else if (["TRAIN_PAUSE", "TRAIN_BLINK", "TRAIN_BOUNCING"].includes(game.state)) {
        if (game.state === "TRAIN_PAUSE" || game.state === "TRAIN_BLINK") {
            game.state = "TRAIN_BOUNCING";
            let num_bounces = Math.floor(Math.random() * 8) + 3; // 3 to 10
            let valid_spots = [...Array(24).keys()].filter(i => i!==21);
            // shuffle valid_spots
            valid_spots.sort(() => 0.5 - Math.random());
            game.bouncing_targets = valid_spots.slice(0, num_bounces);
            game.extra_spins_left = num_bounces;
        }
        while(game.bouncing_targets.length > 0) {
            game.current_pos = game.bouncing_targets.shift();
            game.multi_active_pos.push(game.current_pos);
            let itemName = BOARD_CONFIG[game.current_pos];
            if (itemName === "JACKPOT") {
                game.win_amount += Math.floor(game.jackpot);
                game.jackpot = 500.0;
            } else if (BET_OPTIONS.includes(itemName) && game.bets[itemName] > 0) {
                let info = getItemInfo(itemName);
                game.win_amount += game.bets[itemName] * info.odds;
            }
            game.extra_spins_left -= 1;
        }
        game.state = "SHOW_WIN";
        game.is_blinking_on = true;
    } else if (game.state === "GRAND_PRIZE_START") {
        game.grand_prize_half = Math.random() < 0.5 ? "LEFT" : "RIGHT";
        game.multi_active_pos = game.grand_prize_half === "LEFT" ? game.left_half_pos : game.right_half_pos;
        evaluateGrandPrize();
    }
    updateUI();
}

// Game Loop Update
function gameLoop() {
    requestAnimationFrame(gameLoop);
    if (!game) return;
    
    const currentTime = Date.now();
    let needsUIUpdate = false;
    
    if (game.state === "SPINNING") {
        if (currentTime - game.spin_timer > game.spin_delay) {
            game.spin_timer = currentTime;
            game.current_pos = (game.current_pos + 1) % 24;
            game.steps_remaining -= 1;
            if (game.steps_remaining < 15) game.spin_delay += 15;
            if (game.steps_remaining <= 0) {
                game.current_pos = game.target_pos;
                checkWin();
            } else {
                needsUIUpdate = true;
            }
        }
    } else if (game.state === "TRAIN_SPINNING") {
        if (currentTime - game.spin_timer > 200) {
            game.spin_timer = currentTime;
            game.current_pos = (game.current_pos + 1) % 24;
            game.train_lights_left -= 1;
            let itemName = BOARD_CONFIG[game.current_pos];
            if (BET_OPTIONS.includes(itemName) && game.bets[itemName] > 0) {
                let info = getItemInfo(itemName);
                game.win_amount += game.bets[itemName] * info.odds;
            }
            if (game.train_lights_left <= 0) {
                game.state = "SHOW_WIN";
            }
            needsUIUpdate = true;
        }
    } else if (game.state === "TRAIN_PAUSE") {
        if (currentTime - game.spin_timer > 1000) {
            game.state = "TRAIN_BLINK";
            game.spin_timer = currentTime;
            game.train_blink_count = 0;
            game.is_blinking_on = false;
            needsUIUpdate = true;
        }
    } else if (game.state === "TRAIN_BLINK") {
        if (currentTime - game.spin_timer > 500) {
            game.spin_timer = currentTime;
            game.is_blinking_on = !game.is_blinking_on;
            if (game.is_blinking_on) game.train_blink_count += 1;
            
            if (game.train_blink_count >= 3) {
                game.state = "TRAIN_BOUNCING";
                let num_bounces = Math.floor(Math.random() * 8) + 3;
                let valid_spots = [...Array(24).keys()].filter(i => i!==21);
                valid_spots.sort(() => 0.5 - Math.random());
                game.bouncing_targets = valid_spots.slice(0, num_bounces);
                game.extra_spins_left = num_bounces;
                game.bounce_steps = 0;
            }
            needsUIUpdate = true;
        }
    } else if (game.state === "TRAIN_BOUNCING") {
        if (game.bounce_steps === 0) {
            if (game.bouncing_targets.length === 0) {
                game.state = "SHOW_WIN";
                needsUIUpdate = true;
                return;
            }
            game.target_pos = game.bouncing_targets.shift();
            game.bounce_steps = Math.floor(Math.random() * 11) + 10; // 10 to 20
            game.bounce_delay = 50;
            game.spin_timer = currentTime;
        } else if (currentTime - game.spin_timer > game.bounce_delay) {
            game.spin_timer = currentTime;
            game.current_pos = Math.floor(Math.random() * 24);
            game.bounce_steps -= 1;
            game.bounce_delay += 5;
            if (game.bounce_steps <= 0) {
                game.current_pos = game.target_pos;
                game.multi_active_pos.push(game.current_pos);
                let itemName = BOARD_CONFIG[game.current_pos];
                if (itemName === "JACKPOT") {
                    game.win_amount += Math.floor(game.jackpot);
                    game.jackpot = 500.0;
                } else if (BET_OPTIONS.includes(itemName) && game.bets[itemName] > 0) {
                    let info = getItemInfo(itemName);
                    game.win_amount += game.bets[itemName] * info.odds;
                }
                game.extra_spins_left -= 1;
            }
            needsUIUpdate = true;
        }
    } else if (game.state === "GRAND_PRIZE_START") {
        if (currentTime - game.spin_timer > 150) {
            game.spin_timer = currentTime;
            game.is_blinking_left = !game.is_blinking_left;
            game.grand_prize_blink_count += 1;
            if (game.grand_prize_blink_count >= 20) {
                game.grand_prize_half = Math.random() < 0.5 ? "LEFT" : "RIGHT";
                game.multi_active_pos = game.grand_prize_half === "LEFT" ? game.left_half_pos : game.right_half_pos;
                evaluateGrandPrize();
            }
            needsUIUpdate = true;
        }
    }
    
    if (needsUIUpdate) {
        updateBoardCells();
    }
}

// UI Updates
function updateUI() {
    if (!game) return;
    // Top Info
    elCredits.textContent = game.credits;
    elWin.textContent = game.win_amount;
    elJackpot.textContent = Math.floor(game.jackpot);
    elTotalBets.textContent = game.total_accumulated_bets;
    elTotalCashout.textContent = game.total_accumulated_cashout;
    
    // Bets
    BET_OPTIONS.forEach(opt => {
        const valEl = betEls[opt];
        valEl.textContent = game.bets[opt];
        if (game.bets[opt] > 0) {
            valEl.classList.add('has-bet');
            valEl.classList.remove('no-bet');
        } else {
            valEl.classList.add('no-bet');
            valEl.classList.remove('has-bet');
        }
    });

    // Grand Prize Banner
    if (game.state === "GRAND_PRIZE_START" && game.is_blinking_left) {
        elGrandPrizeBanner.classList.remove('hidden');
    } else if (game.state === "SHOW_WIN" && game.last_win_was_grand_prize) {
        elGrandPrizeBanner.classList.remove('hidden');
    } else {
        elGrandPrizeBanner.classList.add('hidden');
    }

    updateBoardCells();
}

function updateBoardCells() {
    cellEls.forEach((cell, i) => {
        let isActive = false;
        let hideContent = false;
        
        if (game.state === "GRAND_PRIZE_START") {
            isActive = game.is_blinking_left ? game.left_half_pos.includes(i) : game.right_half_pos.includes(i);
        } else {
            if (game.state === "TRAIN_BLINK" && !game.is_blinking_on) {
                hideContent = true;
            }
            isActive = (i === game.current_pos || game.multi_active_pos.includes(i));
        }

        if (isActive) {
            cell.classList.add('active');
        } else {
            cell.classList.remove('active');
        }

        if (hideContent) {
            cell.classList.add('hidden-content');
        } else {
            cell.classList.remove('hidden-content');
        }
    });
}

function showModal(msg, action) {
    modalMessage.textContent = msg;
    pendingModalAction = action;
    if (action === "RESET" || action === "CASH_OUT") {
        modalInputPassword.classList.remove('hidden');
        modalInputPassword.value = '';
    } else {
        modalInputPassword.classList.add('hidden');
    }
    modalOverlay.classList.remove('hidden');
}

function hideModal() {
    modalOverlay.classList.add('hidden');
    pendingModalAction = null;
}

// Event Listeners for Actions
document.getElementById('btn-insert-coin').addEventListener('click', () => {
    if (!game) return;
    if (game.state === "IDLE" || game.state === "SHOW_WIN") {
        game.credits += 10;
        if (game.state === "SHOW_WIN") {
            game.state = "IDLE";
            game.win_amount = 0;
        }
        updateUI();
    }
});

document.getElementById('btn-cash-out').addEventListener('click', () => {
    if (!game) return;
    if (game.state !== "IDLE") {
        alert("請等待轉盤停止後再進行洗分！");
        return;
    }
    if (game.win_amount > 0) {
        alert("您還有未領取的得分！請先點擊「得分」按鈕將分數轉為總分。");
        return;
    }
    if (game.credits <= 0) {
        alert("目前總分為 0，沒有分數可以洗喔！");
        return;
    }
    showModal("請輸入密碼以洗分", "CASH_OUT");
});



document.getElementById('btn-take-score').addEventListener('click', () => {
    if (!game) return;
    if (game.win_amount > 0) {
        game.credits += game.win_amount;
        game.win_amount = 0;
        if (game.state === "SHOW_WIN") game.state = "IDLE";
        updateUI();
    }
});

document.getElementById('btn-start').addEventListener('click', handleStart);

document.getElementById('btn-reset-stats').addEventListener('click', () => {
    if (!game) return;
    if ((game.state === "IDLE" || game.state === "SHOW_WIN") && game.win_amount === 0) {
        showModal("請輸入密碼以重設機台", "RESET");
    }
});

modalBtnConfirm.addEventListener('click', () => {
    if (!game) return;
    if (pendingModalAction === "CASH_OUT") {
        if (modalInputPassword.value !== ADMIN_PASSWORD) {
            alert("密碼錯誤！");
            return;
        }
        let cashedAmount = game.credits;
        game.total_accumulated_cashout += game.credits;
        game.credits = 0;
        saveStats();
        game.state = "IDLE";
        hideModal();
        updateUI();
        alert("洗分成功！共洗出 " + cashedAmount + " 分。");
    } else if (pendingModalAction === "RESET") {
        if (modalInputPassword.value !== ADMIN_PASSWORD) {
            alert("密碼錯誤！");
            return;
        }
        game.total_accumulated_bets = 0;
        game.total_accumulated_cashout = 0;
        saveStats();
        game.state = "IDLE";
        hideModal();
        updateUI();
    }
});

modalBtnCancel.addEventListener('click', hideModal);

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!gameWrapper.classList.contains('hidden')) {
            e.preventDefault();
            handleStart();
        }
    }
});

// Lobby Interactions
machineCards.forEach(card => {
    card.addEventListener('click', () => {
        const machineId = card.dataset.machine;
        enterGame(machineId);
    });
});

btnBackLobby.addEventListener('click', () => {
    exitGame();
});

function enterGame(machineId) {
    if (!allMachinesData[machineId]) {
        allMachinesData[machineId] = createMachineData();
        loadStats(machineId);
    }
    
    currentMachineId = machineId;
    allMachinesData[machineId].visits += 1;
    saveStats();
    
    game = allMachinesData[machineId].game;
    globalVisits = allMachinesData[machineId].visits;
    globalPlayTime = allMachinesData[machineId].playTime;

    // 更新標題
    gameTitle.textContent = `${machineId}號機台`;
    lobbyContainer.classList.add('hidden');
    gameWrapper.classList.remove('hidden');
    
    updateUI();
    updateHeaderStats();
}

function exitGame() {
    currentMachineId = null;
    game = null;
    lobbyContainer.classList.remove('hidden');
    gameWrapper.classList.add('hidden');
}

// Boot
initLayout();
requestAnimationFrame(gameLoop);
