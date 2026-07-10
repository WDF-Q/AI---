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
            
            pendingEventsQueue.push({ type: 'layer8_hit', colors: pair });
            DOM.drawStatus.textContent = '小轉盤：同步消除雙色！';
            return 'sp';
        }
    } else {
        let color = baseDraw;
        await spawnAndSpinBall(color, false);
        historyTracker[color]++;
        addBallToHistoryUI(COLOR_ZH[color], color);
        
        pendingEventsQueue.push({ type: 'layer8_hit', colors: [color] });
        DOM.drawStatus.textContent = `抽中 ${COLOR_ZH[color]}！`;
        return 'color';
    }
}