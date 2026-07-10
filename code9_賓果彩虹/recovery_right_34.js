
async function startRightEngine() {
    while (isPlaying) {
        if (boardState === 'IDLE' && pendingEventsQueue.length > 0) {
            boardState = 'BUSY';
            try {
                let event = pendingEventsQueue.shift();
                
                if (event.type === 'layer8_hit') {
                    let eliminatedAny = false;
                    let flashColorsTriggered = new Set();
                    
                    for (let color of event.colors) {
                        for (let c = 0; c < COLS; c++) {
                            let block = board[ROWS - 1][c];
                            if (block !== null && !block.isMoney && block.color === color) {
                                if (block.isFlash) flashColorsTriggered.add(block.color);
                                block.el.classList.add('eliminating');
                                setTimeout((el) => el.remove(), 1000, block.el);
                                board[ROWS - 1][c] = null;
                                eliminatedAny = true;
                            }
                        }
                    }
                    
                    if (flashColorsTriggered.size > 0) {
                        DOM.drawStatus.textContent = `⚡ 發光球引爆！ ⚡`;
                        for (let r = 0; r < ROWS; r++) {
                            for (let c = 0; c < COLS; c++) {
                                let block = board[r][c];
                                if (block !== null && !block.isMoney && flashColorsTriggered.has(block.color)) {
                                    block.el.classList.add('eliminating');
                                    setTimeout((el) => el.remove(), 1000, block.el);
                                    board[r][c] = null;
                                    eliminatedAny = true;
                                }
                            }
                        }
                    }
                    
                    if (eliminatedAny) {
                        currentCombo = 1;
                        updateLadderActive(currentCombo);
                        DOM.drawStatus.textContent = `${currentCombo} 連鎖！(底部引爆)`;
                        showComboOverlay(currentCombo);
                        await sleep(1000);
                        batchEliminatedAny = true;
                    }
                } else if (event.type === 'trigger_chains') {
                    if (batchEliminatedAny) {
                        await applyGravity();
                        await checkMatchesAndChain();
                        await refillBoard();
                        batchEliminatedAny = false;
                        currentCombo = 0;
                        updateLadderActive(0);
                    }
                } else if (event.type === 'laser_strike') {
                    let birdMouth = document.getElementById('bird-mouth');
                    if (birdMouth) birdMouth.classList.add('bird-charging');
                    
                    await sleep(500); // 讓鳥嘴集氣膨脹
                    
                    let leftPx = parseInt(birdMouth ? (birdMouth.style.left || "0") : "0", 10);
                    let targetCol = Math.round((leftPx - OFFSET) / (BLOCK_SIZE + GAP));
                    
                    let laserBeam = document.getElementById('laser-beam');
                    if (laserBeam) {
                        laserBeam.style.left = `${OFFSET + targetCol * (BLOCK_SIZE + GAP)}px`;
                        laserBeam.classList.remove('hidden');
                        laserBeam.style.animation = 'none';
                        void laserBeam.offsetWidth;
                        laserBeam.style.animation = 'laser-flash 0.6s ease-out forwards';
                    }
                    
                    DOM.drawStatus.textContent = `⚡ 鳥嘴雷射發射！ ⚡`;
                    await sleep(400); // 等待雷射特效到達最大
                    if (birdMouth) birdMouth.classList.remove('bird-charging');
                    
                    let moneyCollected = 0;
                    let flashColorsTriggered = new Set();
                    
                    for (let r = 0; r < ROWS; r++) {
                        let block = board[r][targetCol];
                        if (block !== null) {
                            if (block.isMoney) {
                                moneyCollected += block.moneyValue;
                                totalWin += block.moneyValue;
                                DOM.drawStatus.textContent = `雷射命中！獲得獎金 +${block.moneyValue}！`;
                            } else {
                                if (block.isFlash) flashColorsTriggered.add(block.color);
                            }
                            block.el.classList.add('eliminating');
                            setTimeout((el) => el.remove(), 500, block.el);
                            board[r][targetCol] = null;
                        }
                    }
                    
                    if (flashColorsTriggered.size > 0) {
                        DOM.drawStatus.textContent = `⚡ 發光球引爆！ ⚡`;
                        for (let r = 0; r < ROWS; r++) {
                            for (let c = 0; c < COLS; c++) {
                                let block = board[r][c];
                                if (block !== null && !block.isMoney && flashColorsTriggered.has(block.color)) {
                                    block.el.classList.add('eliminating');
                                    setTimeout((el) => el.remove(), 500, block.el);
                                    board[r][c] = null;
                                }
                            }
                        }
                    }
                    
                    if (moneyCollected > 0) {
                        updateWinDisplay();
                    }
                    
                    await sleep(500);
                    
                    if (laserBeam) laserBeam.classList.add('hidden');
                    
                    await applyGravity();
                    await checkMatchesAndChain();
                    await refillBoard();
                    
                } else if (event.type === 'game_over') {
                    boardState = 'SETTLING';
                    await checkMatchesAndChain(); // 結算最後盤面
                    await finishGameOverSequence();
                    boardState = 'IDLE';
                    continue;
                }
            } catch (err) {
                console.error("Right engine err:", err);
            }
            
            boardState = 'IDLE';
        } else {
            await sleep(100);
        }
    }
}