import re

file_path = 'script.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update variables
content = content.replace(
    '''const MAX_MG_STEPS = 140;
let currentStepMapping = {};
const MG_STATIONS = [0, 20, 50, 90, 140];
let passedStations = [];''',
    '''let mgPhase = 1; // 1: 0-140, 2: 140-290
const MG_STATIONS_PHASE1 = [0, 20, 50, 90, 140];
const MG_STATIONS_PHASE2 = [140, 170, 200, 230, 260, 290];
function getCurrentStations() {
    return mgPhase === 1 ? MG_STATIONS_PHASE1 : MG_STATIONS_PHASE2;
}
let currentStepMapping = {};
let passedStations = [];'''
)

# 2. Update updateMiniGameUI
content = content.replace(
    '''function updateMiniGameUI() {
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
}''',
    '''function updateMiniGameUI() {
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
        let el = document.getElementById(mg-label-);
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
}'''
)

# 3. Update applyMiniGameSteps & jumpToNextIsland
content = content.replace(
    '''async function jumpToNextIsland() {
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
        DOM.drawStatus.textContent = '🎉 恭喜達成 JP 遊戲 🎉';
        await sleep(1000);
        DOM.outOverlay.classList.remove('show');
    }
    
    await sleep(500);
}

async function applyMiniGameSteps(steps) {
    if (steps <= 0) return;
    
    let oldSteps = miniGameSteps;
    miniGameSteps = Math.min(140, miniGameSteps + steps);
    updateMiniGameUI();
    
    if (oldSteps < 140 && miniGameSteps === 140) {
        DOM.drawStatus.textContent = '🎉 恭喜達成 JP 遊戲 🎉';
        await sleep(1000);
    } else if ([20, 50, 90].includes(miniGameSteps)) {
        DOM.drawStatus.textContent = 精準抵達  島！直達下一島嶼！;
        await sleep(1000);
        await jumpToNextIsland();
    }
}''',
    '''async function jumpToNextIsland() {
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
            DOM.drawStatus.textContent = 精準抵達  島！直達下一島嶼！;
            await sleep(1000);
            await jumpToNextIsland();
        } else if (miniGameSteps === 290 && oldSteps < 290) {
            DOM.drawStatus.textContent = '🏆 抵達終極 290 島！ 🏆';
            await sleep(1000);
        }
    }
    
    await sleep(200);
}'''
)

# 4. Update startGame initialization
content = content.replace(
    '''        if (currentAppleColors.length === 7) {
            currentAppleColors = [];
            currentAppleScores = [];
            updateAppleUI();
        }
        
        miniGameSteps = 0;
        passedStations = [];
        
        // 鎖定本次 JP 遊戲三局的顏色與步數''',
    '''        if (currentAppleColors.length === 7) {
            currentAppleColors = [];
            currentAppleScores = [];
            updateAppleUI();
        }
        
        miniGameSteps = 0;
        passedStations = [];
        resetMiniGamePhase1UI();
        
        // 鎖定本次 JP 遊戲三局的顏色與步數'''
)

# 5. Update runJPRouletteGame
content = content.replace(
    '''    for (let i = 0; i < 10; i++) {
        DOM.drawStatus.textContent = JP轉盤 第 /10 顆球發射！目前累積: ;
        
        let targetColor = possibleColors[Math.floor(Math.random() * possibleColors.length)];''',
    '''    let maxBalls = 10;
    if (miniGameSteps > 140) {
        maxBalls = 10 + Math.floor((miniGameSteps - 140) / 30);
        if (maxBalls > 15) maxBalls = 15;
    }
    
    for (let i = 0; i < maxBalls; i++) {
        DOM.drawStatus.textContent = JP轉盤 第 / 顆球發射！目前累積: ;
        
        let targetColor = possibleColors[Math.floor(Math.random() * possibleColors.length)];'''
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patch successfully created!")
