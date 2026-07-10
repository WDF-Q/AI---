    DOM.rouletteInner.style.background = `conic-gradient(${gradientStopsInner.join(', ')})`;
    
    startWheelRotations();
}

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