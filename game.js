// ==================== GAME ENGINE ====================

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = 'start';
        this.frameCount = 0;
        this.isPaused = false;
        
        // Mobile detection
        this.isMobile = this.detectMobile();
        this.touchControls = {
            touchStartX: 0,
            touchStartY: 0,
            touchEndX: 0,
            touchEndY: 0,
            minSwipeDistance: 50
        };
        
        this.settings = this.loadSettings();
        this.stats = this.loadStats();
        this.achievements = new AchievementManager();
        
        this.initializeEntities();
        this.initializeEventListeners();
        this.initializeMobileControls();
        this.gameLoop();
    }
    
    detectMobile() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        return isMobileDevice || isTouchDevice;
    }

    initializeEntities() {
        this.player = new Player(100, 380);
        this.obstacleManager = new ObstacleManager();
        this.collectibleManager = new CollectibleManager();
        this.powerupManager = new PowerupManager();
        this.particleSystem = new ParticleSystem(this.ctx);
        this.background = new Background(this.ctx);
        this.camera = new Camera();
    }

    loadSettings() {
        const defaults = {
            sound: true,
            music: true,
            particles: true,
            screenShake: true
        };
        const saved = localStorage.getItem('commitStreakSettings');
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    }

    saveSettings() {
        localStorage.setItem('commitStreakSettings', JSON.stringify(this.settings));
    }

    loadStats() {
        const defaults = {
            score: 0,
            streak: 0,
            highScore: parseInt(localStorage.getItem('commitStreakHigh')) || 0,
            lives: 3,
            combo: 0,
            maxCombo: 0,
            commits: 0,
            gameSpeed: 5,
            speedMultiplier: 1
        };
        return { ...defaults };
    }

    resetGame() {
        this.stats.score = 0;
        this.stats.streak = 0;
        this.stats.lives = 3;
        this.stats.combo = 0;
        this.stats.maxCombo = 0;
        this.stats.commits = 0;
        this.stats.gameSpeed = 5;
        this.stats.speedMultiplier = 1;
        this.frameCount = 0;
        
        this.player.reset();
        this.obstacleManager.reset();
        this.collectibleManager.reset();
        this.powerupManager.reset();
        this.particleSystem.reset();
        
        this.updateUI();
        this.updateLives();
    }

    startGame() {
        this.resetGame();
        this.state = 'playing';
        this.hideAllScreens();
        this.showMobileControls();
        this.playSound('start');
    }

    pauseGame() {
        if (this.state === 'playing') {
            this.isPaused = true;
            document.getElementById('pauseOverlay').classList.remove('hidden');
        }
    }

    resumeGame() {
        this.isPaused = false;
        document.getElementById('pauseOverlay').classList.add('hidden');
    }

    gameOver() {
        this.state = 'gameOver';
        this.playSound('gameOver');
        this.hideMobileControls();
        
        // Update high score
        if (this.stats.score > this.stats.highScore) {
            this.stats.highScore = this.stats.score;
            localStorage.setItem('commitStreakHigh', this.stats.highScore);
        }

        // Check achievements
        const newAchievements = this.achievements.checkAchievements(this.stats);
        
        // Display game over screen
        document.getElementById('finalScore').textContent = this.stats.score;
        document.getElementById('finalStreak').textContent = this.stats.streak;
        document.getElementById('finalCombo').textContent = `x${this.stats.maxCombo}`;
        document.getElementById('finalCommits').textContent = this.stats.commits;
        
        if (newAchievements.length > 0) {
            this.displayNewAchievements(newAchievements);
        }
        
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }

    displayNewAchievements(achievements) {
        const container = document.getElementById('achievementsList');
        container.innerHTML = '';
        
        achievements.forEach(ach => {
            const item = document.createElement('div');
            item.className = 'achievement-item unlocked';
            item.innerHTML = `
                <div class="achievement-icon">${ach.icon}</div>
                <div class="achievement-name">${ach.name}</div>
            `;
            container.appendChild(item);
        });
        
        document.getElementById('newAchievements').classList.remove('hidden');
    }

    hideAllScreens() {
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('achievementsScreen').classList.add('hidden');
        document.getElementById('settingsScreen').classList.add('hidden');
    }

    update() {
        if (this.state !== 'playing' || this.isPaused) return;

        this.frameCount++;
        
        // Update player
        this.player.update();
        
        // Add player trail particles
        if (this.settings.particles && this.frameCount % 3 === 0) {
            this.particleSystem.createTrail(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2,
                this.player.invincible ? '#bc8cff' : 'rgba(57, 211, 83, 0.6)'
            );
        }
        
        // Check for active power-up effects
        this.powerupManager.updateEffects(this.player, this.stats);
        
        // Update game speed
        if (this.frameCount % 500 === 0) {
            this.stats.gameSpeed = Math.min(this.stats.gameSpeed + 0.3, 12);
        }
        
        const currentSpeed = this.stats.gameSpeed * this.stats.speedMultiplier;
        
        // Update managers
        this.obstacleManager.update(currentSpeed, this.frameCount);
        this.collectibleManager.update(currentSpeed, this.frameCount);
        this.powerupManager.update(currentSpeed, this.frameCount);
        this.background.update(currentSpeed);
        this.particleSystem.update();
        
        // Collision detection
        this.checkCollisions();
        
        // Update score
        this.stats.score += Math.floor(currentSpeed / 10);
        
        if (this.frameCount % 30 === 0) {
            this.updateUI();
        }
    }

    checkCollisions() {
        // Check obstacle collisions
        const obstacleHit = this.obstacleManager.checkCollision(this.player);
        if (obstacleHit && !this.player.invincible) {
            this.handleDamage();
            this.obstacleManager.removeObstacle(obstacleHit);
        }
        
        // Check collectible collisions
        const collectible = this.collectibleManager.checkCollision(this.player);
        if (collectible) {
            this.handleCollectible();
            this.collectibleManager.removeCollectible(collectible);
        }
        
        // Check power-up collisions
        const powerup = this.powerupManager.checkCollision(this.player);
        if (powerup) {
            this.handlePowerup(powerup);
            this.powerupManager.removePowerup(powerup);
        }
    }

    handleDamage() {
        this.stats.lives--;
        this.stats.combo = 0;
        this.updateLives();
        this.updateCombo();
        this.playSound('hit');
        
        if (this.settings.screenShake) {
            this.camera.shake(10, 200);
        }
        
        if (this.settings.particles) {
            this.particleSystem.createExplosion(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2,
                '#f85149',
                15
            );
        }
        
        if (this.stats.lives <= 0) {
            this.gameOver();
        } else {
            // Brief invincibility
            this.player.invincible = true;
            setTimeout(() => this.player.invincible = false, 1500);
        }
    }

    handleCollectible() {
        this.stats.score += 100;
        this.stats.streak++;
        this.stats.commits++;
        this.stats.combo++;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
        
        this.updateUI();
        this.updateCombo();
        this.playSound('collect');
        
        if (this.settings.particles) {
            const x = this.player.x + this.player.width / 2;
            const y = this.player.y + this.player.height / 2;
            
            this.particleSystem.createBurst(x, y, '#39d353', 8);
            this.particleSystem.createSparkle(x, y, '#4ae168');
        }
    }

    handlePowerup(powerup) {
        this.powerupManager.activatePowerup(powerup.type);
        this.playSound('powerup');
        this.showPowerupIndicator(powerup.type);
        
        if (this.settings.particles) {
            this.particleSystem.createBurst(
                powerup.x + powerup.width / 2,
                powerup.y + powerup.height / 2,
                '#bc8cff',
                12
            );
        }
    }

    showPowerupIndicator(type) {
        const indicator = document.getElementById('powerupIndicator');
        indicator.classList.remove('hidden');
        
        setTimeout(() => {
            indicator.classList.add('hidden');
        }, 5000);
    }

    updateUI() {
        document.querySelector('#score .value').textContent = this.stats.score;
        document.querySelector('#streak .value').textContent = this.stats.streak;
        document.querySelector('#highScore .value').textContent = this.stats.highScore;
    }

    updateLives() {
        const lifeElements = document.querySelectorAll('.life');
        lifeElements.forEach((el, i) => {
            if (i < this.stats.lives) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    updateCombo() {
        const comboIndicator = document.getElementById('comboIndicator');
        const comboValue = document.querySelector('.combo-value');
        
        if (this.stats.combo > 2) {
            comboIndicator.classList.remove('hidden');
            comboValue.textContent = `x${this.stats.combo}`;
        } else {
            comboIndicator.classList.add('hidden');
        }
    }

    draw() {
        // Apply camera shake
        this.ctx.save();
        if (this.settings.screenShake) {
            const shake = this.camera.getShake();
            this.ctx.translate(shake.x, shake.y);
        }
        
        // Clear canvas
        this.ctx.fillStyle = '#0d1117';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw game elements (pass frameCount for animations)
        this.background.draw();
        this.collectibleManager.draw(this.ctx, this.frameCount);
        this.powerupManager.draw(this.ctx, this.frameCount);
        this.obstacleManager.draw(this.ctx, this.frameCount);
        this.player.draw(this.ctx, this.frameCount);
        
        if (this.settings.particles) {
            this.particleSystem.draw();
        }
        
        this.ctx.restore();
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    playSound(type) {
        if (!this.settings.sound) return;
        
        // Firefox Mobile requires user interaction before AudioContext
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            switch(type) {
                case 'jump':
                    oscillator.frequency.value = 400;
                    oscillator.type = 'square';
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.1);
                    break;
                case 'collect':
                    oscillator.frequency.value = 800;
                    oscillator.type = 'sine';
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.15);
                    break;
                case 'hit':
                    oscillator.frequency.value = 100;
                    oscillator.type = 'sawtooth';
                    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.2);
                    break;
                case 'powerup':
                    oscillator.frequency.value = 600;
                    oscillator.type = 'sine';
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.3);
                    break;
            }
            
            // Close context after sound plays to avoid memory leaks
            setTimeout(() => {
                audioContext.close();
            }, 1000);
            
        } catch (error) {
            // Silently fail if AudioContext is not available
            console.warn('Audio not available:', error.message);
        }
    }

    initializeEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (this.state !== 'playing' || this.isPaused) {
                if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
                    if (this.isPaused) {
                        this.resumeGame();
                    }
                }
                return;
            }
            
            if ((e.key === 'ArrowUp' || e.key === ' ') && !this.player.jumping && !this.player.sliding) {
                this.player.jump();
                this.playSound('jump');
            }
            
            if (e.key === 'ArrowDown' && !this.player.jumping && !this.player.sliding) {
                this.player.slide();
            }
            
            if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
                this.pauseGame();
            }
        });

        // Button event listeners
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());
        document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
        
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.hideAllScreens();
            document.getElementById('startScreen').classList.remove('hidden');
        });
        
        document.getElementById('quitBtn').addEventListener('click', () => {
            this.resumeGame();
            this.state = 'start';
            this.hideAllScreens();
            document.getElementById('startScreen').classList.remove('hidden');
        });
        
        // Achievements button
        document.getElementById('achievementsBtn').addEventListener('click', () => {
            this.achievements.display();
            this.hideAllScreens();
            document.getElementById('achievementsScreen').classList.remove('hidden');
        });
        
        document.getElementById('closeAchievementsBtn').addEventListener('click', () => {
            this.hideAllScreens();
            document.getElementById('startScreen').classList.remove('hidden');
        });
        
        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.hideAllScreens();
            document.getElementById('settingsScreen').classList.remove('hidden');
            this.updateSettingsUI();
        });
        
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            this.hideAllScreens();
            document.getElementById('startScreen').classList.remove('hidden');
        });
        
        // Settings toggles
        document.getElementById('soundToggle').addEventListener('change', (e) => {
            this.settings.sound = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('musicToggle').addEventListener('change', (e) => {
            this.settings.music = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('particlesToggle').addEventListener('change', (e) => {
            this.settings.particles = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('screenShakeToggle').addEventListener('change', (e) => {
            this.settings.screenShake = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('resetProgressBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
                localStorage.removeItem('commitStreakHigh');
                localStorage.removeItem('commitStreakAchievements');
                this.stats.highScore = 0;
                this.achievements = new AchievementManager();
                this.updateUI();
                alert('Progress reset successfully!');
            }
        });
    }
    
    initializeMobileControls() {
        if (!this.isMobile) return;
        
        // Show mobile controls and touch zones during gameplay
        const mobileControls = document.getElementById('mobileControls');
        const touchZones = document.getElementById('touchZones');
        
        // Touch button controls
        const jumpBtn = document.getElementById('jumpBtn');
        const slideBtn = document.getElementById('slideBtn');
        
        // Prevent default touch behaviors
        [jumpBtn, slideBtn].forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
            });
        });
        
        // Jump button
        jumpBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.state === 'playing' && !this.isPaused && !this.player.jumping && !this.player.sliding) {
                this.player.jump();
                this.playSound('jump');
                this.triggerVibration(50);
                jumpBtn.classList.add('vibration-pulse');
                setTimeout(() => jumpBtn.classList.remove('vibration-pulse'), 300);
            }
        });
        
        // Slide button
        slideBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.state === 'playing' && !this.isPaused && !this.player.jumping && !this.player.sliding) {
                this.player.slide();
                this.triggerVibration(50);
                slideBtn.classList.add('vibration-pulse');
                setTimeout(() => slideBtn.classList.remove('vibration-pulse'), 300);
            }
        });
        
        // Swipe gesture detection on canvas
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.state !== 'playing' || this.isPaused) return;
            const touch = e.touches[0];
            this.touchControls.touchStartX = touch.clientX;
            this.touchControls.touchStartY = touch.clientY;
            e.preventDefault();
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.state !== 'playing' || this.isPaused) return;
            e.preventDefault();
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (this.state !== 'playing' || this.isPaused) return;
            
            const touch = e.changedTouches[0];
            this.touchControls.touchEndX = touch.clientX;
            this.touchControls.touchEndY = touch.clientY;
            
            this.handleSwipeGesture();
            e.preventDefault();
        }, { passive: false });
        
        // Show instructions on first mobile visit
        if (!localStorage.getItem('commitStreakMobileInstructionsSeen')) {
            this.showMobileInstructions();
        }
    }
    
    handleSwipeGesture() {
        const deltaX = this.touchControls.touchEndX - this.touchControls.touchStartX;
        const deltaY = this.touchControls.touchEndY - this.touchControls.touchStartY;
        const minDistance = this.touchControls.minSwipeDistance;
        
        // Determine if swipe is more vertical or horizontal
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            // Vertical swipe
            if (Math.abs(deltaY) > minDistance) {
                if (deltaY < 0) {
                    // Swipe up - Jump
                    if (!this.player.jumping && !this.player.sliding) {
                        this.player.jump();
                        this.playSound('jump');
                        this.triggerVibration(50);
                    }
                } else {
                    // Swipe down - Slide
                    if (!this.player.jumping && !this.player.sliding) {
                        this.player.slide();
                        this.triggerVibration(50);
                    }
                }
            }
        }
    }
    
    triggerVibration(duration) {
        if ('vibrate' in navigator && this.settings.screenShake) {
            navigator.vibrate(duration);
        }
    }
    
    showMobileInstructions() {
        const instructionsOverlay = document.getElementById('mobileInstructions');
        instructionsOverlay.classList.remove('hidden');
        
        document.getElementById('closeInstructionsBtn').addEventListener('click', () => {
            instructionsOverlay.classList.add('hidden');
            localStorage.setItem('commitStreakMobileInstructionsSeen', 'true');
        });
    }
    
    showMobileControls() {
        if (this.isMobile) {
            document.getElementById('mobileControls').classList.remove('hidden');
        }
    }
    
    hideMobileControls() {
        if (this.isMobile) {
            document.getElementById('mobileControls').classList.add('hidden');
        }
    }

    updateSettingsUI() {
        document.getElementById('soundToggle').checked = this.settings.sound;
        document.getElementById('musicToggle').checked = this.settings.music;
        document.getElementById('particlesToggle').checked = this.settings.particles;
        document.getElementById('screenShakeToggle').checked = this.settings.screenShake;
    }
}

// ==================== PLAYER ====================

class Player {
    constructor(x, y) {
        this.initialX = x;
        this.initialY = y;
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.velocityY = 0;
        this.jumping = false;
        this.sliding = false;
        this.slideTimer = 0;
        this.invincible = false;
        this.gravity = 0.6;
        this.jumpForce = -13;
        this.groundY = 380;
    }

    reset() {
        this.x = this.initialX;
        this.y = this.initialY;
        this.velocityY = 0;
        this.jumping = false;
        this.sliding = false;
        this.slideTimer = 0;
        this.invincible = false;
    }

    jump() {
        this.velocityY = this.jumpForce;
        this.jumping = true;
    }

    slide() {
        this.sliding = true;
        this.height = 16;
        this.slideTimer = 20;
    }

    update() {
        // Handle sliding
        if (this.sliding) {
            this.slideTimer--;
            if (this.slideTimer <= 0) {
                this.sliding = false;
                this.height = 32;
            }
        }

        // Apply physics
        this.velocityY += this.gravity;
        this.y += this.velocityY;

        // Ground collision
        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.velocityY = 0;
            this.jumping = false;
        }
    }

    draw(ctx, frameCount) {
        ctx.save();
        
        // Invincibility shield effect
        if (this.invincible) {
            const pulseSize = 2 + Math.sin(frameCount * 0.3) * 1;
            ctx.fillStyle = 'rgba(188, 140, 255, 0.3)';
            ctx.fillRect(
                this.x - pulseSize, 
                this.y - pulseSize, 
                this.width + pulseSize * 2, 
                this.height + pulseSize * 2
            );
            
            // Invincibility flashing
            if (Math.floor(frameCount / 5) % 2 === 0) {
                ctx.globalAlpha = 0.7;
            }
        }
        
        // Motion blur trail when moving fast
        if (!this.jumping && !this.sliding) {
            ctx.fillStyle = 'rgba(57, 211, 83, 0.15)';
            ctx.fillRect(this.x - 8, this.y + 4, 8, this.height - 8);
            ctx.fillRect(this.x - 4, this.y + 8, 4, this.height - 16);
        }
        
        const colors = {
            primary: '#39d353',
            secondary: '#2ea043',
            dark: '#0d1117',
            highlight: '#4ae168',
            eye: '#58a6ff'
        };
        
        if (this.sliding) {
            this.drawSliding(ctx, colors, frameCount);
        } else if (this.jumping) {
            this.drawJumping(ctx, colors, frameCount);
        } else {
            this.drawRunning(ctx, colors, frameCount);
        }
        
        ctx.restore();
    }
    
    drawRunning(ctx, colors, frameCount) {
        const runCycle = Math.floor(frameCount / 6) % 4;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(this.x + 4, this.y + 30, 24, 4);
        
        // Body - slightly bobbing
        const bob = Math.sin(frameCount * 0.3) * 1;
        
        // Main body
        ctx.fillStyle = colors.primary;
        ctx.fillRect(this.x + 10, this.y + 8 + bob, 12, 16);
        
        // Head with antenna
        ctx.fillRect(this.x + 8, this.y + 2 + bob, 16, 10);
        ctx.fillRect(this.x + 14, this.y + bob, 4, 3); // Antenna
        
        // Arms (animated)
        const armSwing = runCycle < 2 ? -2 : 2;
        ctx.fillRect(this.x + 6, this.y + 12 + bob + armSwing, 4, 8);
        ctx.fillRect(this.x + 22, this.y + 12 + bob - armSwing, 4, 8);
        
        // Legs (running animation)
        if (runCycle === 0) {
            ctx.fillRect(this.x + 10, this.y + 24 + bob, 5, 6);
            ctx.fillRect(this.x + 17, this.y + 26 + bob, 5, 4);
        } else if (runCycle === 1) {
            ctx.fillRect(this.x + 10, this.y + 26 + bob, 5, 4);
            ctx.fillRect(this.x + 17, this.y + 24 + bob, 5, 6);
        } else if (runCycle === 2) {
            ctx.fillRect(this.x + 10, this.y + 25 + bob, 5, 5);
            ctx.fillRect(this.x + 17, this.y + 25 + bob, 5, 5);
        } else {
            ctx.fillRect(this.x + 10, this.y + 24 + bob, 5, 6);
            ctx.fillRect(this.x + 17, this.y + 26 + bob, 5, 4);
        }
        
        // Eyes (animated blinking)
        const blink = frameCount % 120 < 3;
        if (!blink) {
            ctx.fillStyle = colors.eye;
            ctx.fillRect(this.x + 10, this.y + 5 + bob, 3, 3);
            ctx.fillRect(this.x + 19, this.y + 5 + bob, 3, 3);
            
            // Eye shine
            ctx.fillStyle = colors.highlight;
            ctx.fillRect(this.x + 11, this.y + 5 + bob, 1, 1);
            ctx.fillRect(this.x + 20, this.y + 5 + bob, 1, 1);
        } else {
            ctx.fillStyle = colors.dark;
            ctx.fillRect(this.x + 10, this.y + 6 + bob, 3, 1);
            ctx.fillRect(this.x + 19, this.y + 6 + bob, 3, 1);
        }
        
        // Mouth
        ctx.fillStyle = colors.dark;
        ctx.fillRect(this.x + 14, this.y + 9 + bob, 4, 1);
        
        // Body details
        ctx.fillStyle = colors.secondary;
        ctx.fillRect(this.x + 11, this.y + 10 + bob, 2, 2);
        ctx.fillRect(this.x + 19, this.y + 10 + bob, 2, 2);
        ctx.fillRect(this.x + 15, this.y + 15 + bob, 2, 2);
    }
    
    drawJumping(ctx, colors, frameCount) {
        // Shadow (smaller when in air)
        const shadowSize = 20 - (this.groundY - this.y) / 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(this.x + (32 - shadowSize) / 2, this.groundY + 30, shadowSize, 3);
        
        // Main body
        ctx.fillStyle = colors.primary;
        ctx.fillRect(this.x + 10, this.y + 8, 12, 16);
        
        // Head
        ctx.fillRect(this.x + 8, this.y + 2, 16, 10);
        ctx.fillRect(this.x + 14, this.y, 4, 3); // Antenna
        
        // Arms (up position)
        ctx.fillRect(this.x + 4, this.y + 8, 6, 6);
        ctx.fillRect(this.x + 22, this.y + 8, 6, 6);
        
        // Legs (tucked)
        ctx.fillRect(this.x + 10, this.y + 24, 5, 4);
        ctx.fillRect(this.x + 17, this.y + 24, 5, 4);
        
        // Eyes (wide open)
        ctx.fillStyle = colors.eye;
        ctx.fillRect(this.x + 10, this.y + 5, 3, 4);
        ctx.fillRect(this.x + 19, this.y + 5, 3, 4);
        
        // Eye shine
        ctx.fillStyle = colors.highlight;
        ctx.fillRect(this.x + 11, this.y + 5, 1, 1);
        ctx.fillRect(this.x + 20, this.y + 5, 1, 1);
        
        // Excited mouth
        ctx.fillStyle = colors.dark;
        ctx.fillRect(this.x + 13, this.y + 9, 6, 2);
        
        // Motion lines (speed effect)
        ctx.fillStyle = 'rgba(57, 211, 83, 0.4)';
        ctx.fillRect(this.x - 4, this.y + 10, 3, 2);
        ctx.fillRect(this.x - 7, this.y + 14, 4, 2);
        ctx.fillRect(this.x - 5, this.y + 18, 3, 2);
    }
    
    drawSliding(ctx, colors, frameCount) {
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(this.x, this.y + 14, 32, 4);
        
        // Main body (horizontal)
        ctx.fillStyle = colors.primary;
        ctx.fillRect(this.x, this.y + 18, 28, 12);
        
        // Head (front)
        ctx.fillRect(this.x + 24, this.y + 16, 8, 10);
        
        // Arms (stretched forward)
        ctx.fillRect(this.x + 28, this.y + 20, 4, 4);
        
        // Legs (stretched back)
        ctx.fillRect(this.x - 2, this.y + 20, 6, 4);
        ctx.fillRect(this.x + 2, this.y + 24, 6, 3);
        
        // Eyes (determined look)
        ctx.fillStyle = colors.eye;
        ctx.fillRect(this.x + 26, this.y + 18, 2, 2);
        ctx.fillRect(this.x + 29, this.y + 18, 2, 2);
        
        // Dust cloud behind
        const dustOffset = frameCount % 10;
        ctx.fillStyle = `rgba(57, 211, 83, ${0.3 - dustOffset / 30})`;
        ctx.fillRect(this.x - 10 - dustOffset, this.y + 24, 6, 4);
        ctx.fillRect(this.x - 16 - dustOffset * 1.5, this.y + 26, 4, 3);
        
        // Speed lines
        ctx.fillStyle = 'rgba(57, 211, 83, 0.5)';
        ctx.fillRect(this.x - 8, this.y + 20, 6, 1);
        ctx.fillRect(this.x - 12, this.y + 23, 8, 1);
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// ==================== OBSTACLE MANAGER ====================

class ObstacleManager {
    constructor() {
        this.obstacles = [];
        this.types = [
            { type: 'bug', width: 32, height: 32, y: 380, color: '#f85149' },
            { type: 'conflict', width: 32, height: 36, y: 344, color: '#f85149' },
            { type: 'spike', width: 24, height: 48, y: 364, color: '#ff6b6b' }
        ];
    }

    reset() {
        this.obstacles = [];
    }

    update(speed, frameCount) {
        // Update existing obstacles
        this.obstacles = this.obstacles.filter(obs => {
            obs.x -= speed;
            return obs.x + obs.width > 0;
        });

        // Spawn new obstacles
        if (frameCount % 120 === 0) {
            this.spawn();
        }
    }

    spawn() {
        const type = this.types[Math.floor(Math.random() * this.types.length)];
        this.obstacles.push({
            x: 900,
            y: type.y,
            width: type.width,
            height: type.height,
            type: type.type,
            color: type.color
        });
    }

    draw(ctx, frameCount) {
        this.obstacles.forEach(obs => {
            this.drawObstacle(ctx, obs, frameCount);
        });
    }
    
    drawObstacle(ctx, obs, frameCount) {
        ctx.save();
        
        if (obs.type === 'bug') {
            this.drawBug(ctx, obs, frameCount);
        } else if (obs.type === 'conflict') {
            this.drawConflict(ctx, obs, frameCount);
        } else if (obs.type === 'spike') {
            this.drawSpike(ctx, obs, frameCount);
        }
        
        ctx.restore();
    }
    
    drawBug(ctx, obs, frameCount) {
        const wiggle = Math.sin(frameCount * 0.2 + obs.x * 0.1) * 2;
        const legMove = Math.floor(frameCount / 8) % 2;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(obs.x + 4, obs.y + obs.height + 1, obs.width - 8, 3);
        
        // Body segments
        ctx.fillStyle = '#f85149';
        ctx.fillRect(obs.x + 8, obs.y + 4, 16, 12); // Main body
        ctx.fillRect(obs.x + 10, obs.y + 16, 12, 8); // Lower segment
        
        // Head
        ctx.fillRect(obs.x + 6, obs.y + wiggle, 20, 8);
        
        // Antennae
        ctx.fillStyle = '#d73a49';
        ctx.fillRect(obs.x + 8, obs.y - 4 + wiggle, 2, 6);
        ctx.fillRect(obs.x + 22, obs.y - 4 + wiggle, 2, 6);
        ctx.fillRect(obs.x + 6, obs.y - 4 + wiggle, 4, 2);
        ctx.fillRect(obs.x + 22, obs.y - 4 + wiggle, 4, 2);
        
        // Eyes (menacing)
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(obs.x + 10, obs.y + 2 + wiggle, 4, 3);
        ctx.fillRect(obs.x + 18, obs.y + 2 + wiggle, 4, 3);
        
        // Legs (animated)
        ctx.fillStyle = '#d73a49';
        const legY1 = legMove === 0 ? 2 : -1;
        const legY2 = legMove === 0 ? -1 : 2;
        
        // Left legs
        ctx.fillRect(obs.x + 2, obs.y + 12 + legY1, 6, 2);
        ctx.fillRect(obs.x + 4, obs.y + 18 + legY2, 6, 2);
        
        // Right legs
        ctx.fillRect(obs.x + 24, obs.y + 12 + legY2, 6, 2);
        ctx.fillRect(obs.x + 22, obs.y + 18 + legY1, 6, 2);
        
        // Mandibles
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(obs.x + 4, obs.y + 6 + wiggle, 2, 2);
        ctx.fillRect(obs.x + 26, obs.y + 6 + wiggle, 2, 2);
    }
    
    drawConflict(ctx, obs, frameCount) {
        const pulse = Math.sin(frameCount * 0.15) * 2;
        const shake = Math.sin(frameCount * 0.5) * 1;
        
        // Warning glow
        ctx.fillStyle = 'rgba(248, 81, 73, 0.3)';
        ctx.fillRect(obs.x - 4, obs.y - 4, obs.width + 8, obs.height + 8);
        
        // Main conflict bars
        ctx.fillStyle = '#f85149';
        for (let i = 0; i < 3; i++) {
            const barY = obs.y + i * 12;
            ctx.fillRect(obs.x + shake, barY, obs.width, 8);
            
            // Danger stripes
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(obs.x + 4 + shake, barY + 1, 4, 2);
            ctx.fillRect(obs.x + 12 + shake, barY + 1, 4, 2);
            ctx.fillRect(obs.x + 20 + shake, barY + 1, 4, 2);
            ctx.fillStyle = '#f85149';
        }
        
        // Lightning bolts between bars
        ctx.fillStyle = '#ffeb3b';
        const boltOffset = Math.floor(frameCount / 4) % 3;
        
        if (boltOffset === 0) {
            ctx.fillRect(obs.x + 10, obs.y + 8, 2, 4);
            ctx.fillRect(obs.x + 8, obs.y + 12, 2, 4);
            ctx.fillRect(obs.x + 20, obs.y + 20, 2, 4);
            ctx.fillRect(obs.x + 22, obs.y + 24, 2, 4);
        } else if (boltOffset === 1) {
            ctx.fillRect(obs.x + 16, obs.y + 8, 2, 4);
            ctx.fillRect(obs.x + 18, obs.y + 12, 2, 4);
            ctx.fillRect(obs.x + 14, obs.y + 20, 2, 4);
            ctx.fillRect(obs.x + 12, obs.y + 24, 2, 4);
        }
        
        // Exclamation marks
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(obs.x + 14, obs.y - 8 + pulse, 4, 6);
        ctx.fillRect(obs.x + 14, obs.y - 1 + pulse, 4, 2);
    }
    
    drawSpike(ctx, obs, frameCount) {
        const glow = Math.sin(frameCount * 0.1) * 0.2 + 0.8;
        
        // Danger glow
        ctx.fillStyle = `rgba(255, 107, 107, ${glow * 0.4})`;
        ctx.fillRect(obs.x - 4, obs.y - 4, obs.width + 8, obs.height + 8);
        
        // Main spike (triangle)
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();
        
        // Inner highlight
        ctx.fillStyle = '#ff8a8a';
        ctx.beginPath();
        ctx.moveTo(obs.x + 6, obs.y + obs.height - 6);
        ctx.lineTo(obs.x + obs.width / 2, obs.y + 8);
        ctx.lineTo(obs.x + obs.width - 6, obs.y + obs.height - 6);
        ctx.closePath();
        ctx.fill();
        
        // Dark core
        ctx.fillStyle = '#d73a49';
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.width / 2 - 4, obs.y + obs.height - 12);
        ctx.lineTo(obs.x + obs.width / 2, obs.y + 12);
        ctx.lineTo(obs.x + obs.width / 2 + 4, obs.y + obs.height - 12);
        ctx.closePath();
        ctx.fill();
        
        // Base
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(obs.x, obs.y + obs.height, obs.width, 4);
    }

    checkCollision(player) {
        const playerBounds = player.getBounds();
        return this.obstacles.find(obs => 
            this.isColliding(playerBounds, obs)
        );
    }

    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    removeObstacle(obstacle) {
        const index = this.obstacles.indexOf(obstacle);
        if (index > -1) {
            this.obstacles.splice(index, 1);
        }
    }
}

// ==================== COLLECTIBLE MANAGER ====================

class CollectibleManager {
    constructor() {
        this.collectibles = [];
    }

    reset() {
        this.collectibles = [];
    }

    update(speed, frameCount) {
        // Update existing collectibles
        this.collectibles = this.collectibles.filter(col => {
            col.x -= speed;
            col.floatOffset = Math.sin(frameCount * 0.1 + col.floatPhase) * 3;
            return col.x + col.width > 0;
        });

        // Spawn new collectibles
        if (frameCount % 80 === 0) {
            this.spawn();
        }
    }

    spawn() {
        const yPositions = [300, 340, 380];
        const y = yPositions[Math.floor(Math.random() * yPositions.length)];
        
        this.collectibles.push({
            x: 900,
            y: y,
            width: 24,
            height: 24,
            floatOffset: 0,
            floatPhase: Math.random() * Math.PI * 2
        });
    }

    draw(ctx, frameCount) {
        this.collectibles.forEach(col => {
            this.drawCollectible(ctx, col, frameCount);
        });
    }
    
    drawCollectible(ctx, col, frameCount) {
        const drawY = col.y + col.floatOffset;
        const rotation = (frameCount * 0.05) % (Math.PI * 2);
        const scale = 1 + Math.sin(frameCount * 0.1) * 0.1;
        
        ctx.save();
        
        // Outer glow (pulsing)
        const glowSize = 8 + Math.sin(frameCount * 0.15) * 3;
        const glowAlpha = 0.3 + Math.sin(frameCount * 0.15) * 0.1;
        ctx.fillStyle = `rgba(57, 211, 83, ${glowAlpha})`;
        ctx.fillRect(
            col.x - glowSize / 2, 
            drawY - glowSize / 2, 
            col.width + glowSize, 
            col.height + glowSize
        );
        
        // Inner glow
        ctx.fillStyle = 'rgba(57, 211, 83, 0.5)';
        ctx.fillRect(col.x - 2, drawY - 2, col.width + 4, col.height + 4);
        
        // Rotate around center
        const centerX = col.x + col.width / 2;
        const centerY = drawY + col.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);
        
        // Main checkmark box
        ctx.fillStyle = '#39d353';
        ctx.fillRect(col.x, drawY, col.width, col.height);
        
        // Border highlight
        ctx.fillStyle = '#4ae168';
        ctx.fillRect(col.x, drawY, col.width, 2);
        ctx.fillRect(col.x, drawY, 2, col.height);
        
        // Checkmark shape
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(col.x + 5, drawY + 13, 3, 7);
        ctx.fillRect(col.x + 8, drawY + 17, 3, 3);
        ctx.fillRect(col.x + 11, drawY + 10, 3, 7);
        ctx.fillRect(col.x + 14, drawY + 6, 3, 4);
        
        // Shine effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(col.x + 2, drawY + 2, 4, 4);
        
        ctx.restore();
        
        // Particles around collectible
        if (frameCount % 10 === 0) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 15;
            const particleX = centerX + Math.cos(angle) * distance;
            const particleY = centerY + Math.sin(angle) * distance;
            
            ctx.fillStyle = 'rgba(57, 211, 83, 0.6)';
            ctx.fillRect(particleX, particleY, 2, 2);
        }
    }

    checkCollision(player) {
        const playerBounds = player.getBounds();
        return this.collectibles.find(col =>
            playerBounds.x < col.x + col.width &&
            playerBounds.x + playerBounds.width > col.x &&
            playerBounds.y < col.y + col.height &&
            playerBounds.y + playerBounds.height > col.y
        );
    }

    removeCollectible(collectible) {
        const index = this.collectibles.indexOf(collectible);
        if (index > -1) {
            this.collectibles.splice(index, 1);
        }
    }
}

// ==================== POWERUP MANAGER ====================

class PowerupManager {
    constructor() {
        this.powerups = [];
        this.activePowerup = null;
        this.powerupTimer = 0;
        
        this.types = [
            { type: 'invincibility', color: '#bc8cff', duration: 5000 },
            { type: 'slowmo', color: '#58a6ff', duration: 5000 },
            { type: 'magnet', color: '#f9826c', duration: 5000 }
        ];
    }

    reset() {
        this.powerups = [];
        this.activePowerup = null;
        this.powerupTimer = 0;
    }

    update(speed, frameCount) {
        // Update existing power-ups
        this.powerups = this.powerups.filter(pu => {
            pu.x -= speed;
            pu.floatOffset = Math.sin(frameCount * 0.08 + pu.floatPhase) * 5;
            return pu.x + pu.width > 0;
        });

        // Spawn new power-ups (rare)
        if (frameCount % 400 === 0 && Math.random() < 0.5) {
            this.spawn();
        }
    }

    spawn() {
        const type = this.types[Math.floor(Math.random() * this.types.length)];
        this.powerups.push({
            x: 900,
            y: 320,
            width: 32,
            height: 32,
            type: type.type,
            color: type.color,
            duration: type.duration,
            floatOffset: 0,
            floatPhase: Math.random() * Math.PI * 2
        });
    }

    draw(ctx, frameCount) {
        this.powerups.forEach(pu => {
            this.drawPowerup(ctx, pu, frameCount);
        });
    }
    
    drawPowerup(ctx, pu, frameCount) {
        const drawY = pu.y + pu.floatOffset;
        const pulse = Math.sin(frameCount * 0.1) * 0.15 + 1;
        
        ctx.save();
        
        // Multi-layer glow
        const glowIntensity = Math.sin(frameCount * 0.12) * 0.3 + 0.5;
        
        // Outer glow
        ctx.fillStyle = pu.color.replace(')', `, ${glowIntensity * 0.2})`).replace('rgb', 'rgba');
        ctx.fillRect(pu.x - 12, drawY - 12, pu.width + 24, pu.height + 24);
        
        // Middle glow
        ctx.fillStyle = pu.color.replace(')', `, ${glowIntensity * 0.4})`).replace('rgb', 'rgba');
        ctx.fillRect(pu.x - 6, drawY - 6, pu.width + 12, pu.height + 12);
        
        // Inner glow
        ctx.fillStyle = pu.color.replace(')', ', 0.6)').replace('rgb', 'rgba');
        ctx.fillRect(pu.x - 2, drawY - 2, pu.width + 4, pu.height + 4);
        
        // Rotate for visual interest
        const rotation = frameCount * 0.03;
        const centerX = pu.x + pu.width / 2;
        const centerY = drawY + pu.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.scale(pulse, pulse);
        ctx.translate(-centerX, -centerY);
        
        // Main box with gradient effect
        ctx.fillStyle = pu.color;
        ctx.fillRect(pu.x, drawY, pu.width, pu.height);
        
        // Highlight
        const lighterColor = this.lightenColor(pu.color);
        ctx.fillStyle = lighterColor;
        ctx.fillRect(pu.x + 2, drawY + 2, pu.width - 4, 4);
        ctx.fillRect(pu.x + 2, drawY + 2, 4, pu.height - 4);
        
        // Draw type-specific icon
        ctx.fillStyle = '#0d1117';
        
        if (pu.type === 'invincibility') {
            // Shield icon
            ctx.fillRect(pu.x + 10, drawY + 6, 12, 14);
            ctx.fillRect(pu.x + 8, drawY + 8, 16, 10);
            ctx.fillRect(pu.x + 12, drawY + 10, 8, 8);
            ctx.fillStyle = lighterColor;
            ctx.fillRect(pu.x + 14, drawY + 12, 4, 4);
        } else if (pu.type === 'slowmo') {
            // Clock icon
            ctx.fillRect(pu.x + 10, drawY + 8, 12, 12);
            ctx.fillStyle = lighterColor;
            ctx.fillRect(pu.x + 15, drawY + 10, 2, 6);
            ctx.fillRect(pu.x + 15, drawY + 13, 4, 2);
        } else if (pu.type === 'magnet') {
            // Magnet icon
            ctx.fillRect(pu.x + 8, drawY + 10, 4, 12);
            ctx.fillRect(pu.x + 20, drawY + 10, 4, 12);
            ctx.fillRect(pu.x + 8, drawY + 10, 16, 4);
            ctx.fillStyle = lighterColor;
            ctx.fillRect(pu.x + 10, drawY + 12, 2, 8);
            ctx.fillRect(pu.x + 20, drawY + 12, 2, 8);
        }
        
        ctx.restore();
        
        // Orbiting particles
        const orbitAngle = frameCount * 0.1;
        for (let i = 0; i < 3; i++) {
            const angle = orbitAngle + (i * Math.PI * 2 / 3);
            const orbitRadius = 20 + Math.sin(frameCount * 0.08 + i) * 3;
            const particleX = centerX + Math.cos(angle) * orbitRadius;
            const particleY = centerY + Math.sin(angle) * orbitRadius;
            
            ctx.fillStyle = pu.color;
            ctx.fillRect(particleX - 2, particleY - 2, 3, 3);
        }
    }
    
    lightenColor(color) {
        // Simple color lightening
        if (color === '#bc8cff') return '#d4b0ff';
        if (color === '#58a6ff') return '#7ec0ff';
        if (color === '#f9826c') return '#ffa896';
        return color;
    }

    checkCollision(player) {
        const playerBounds = player.getBounds();
        return this.powerups.find(pu =>
            playerBounds.x < pu.x + pu.width &&
            playerBounds.x + playerBounds.width > pu.x &&
            playerBounds.y < pu.y + pu.height &&
            playerBounds.y + playerBounds.height > pu.y
        );
    }

    removePowerup(powerup) {
        const index = this.powerups.indexOf(powerup);
        if (index > -1) {
            this.powerups.splice(index, 1);
        }
    }

    activatePowerup(type) {
        this.activePowerup = type;
        const powerup = this.types.find(p => p.type === type);
        
        setTimeout(() => {
            this.activePowerup = null;
        }, powerup.duration);
    }

    updateEffects(player, stats) {
        if (this.activePowerup === 'invincibility') {
            player.invincible = true;
        }
        
        if (this.activePowerup === 'slowmo') {
            stats.speedMultiplier = 0.5;
        } else {
            stats.speedMultiplier = 1;
        }
    }
}

// ==================== PARTICLE SYSTEM ====================

class ParticleSystem {
    constructor(ctx) {
        this.ctx = ctx;
        this.particles = [];
    }

    reset() {
        this.particles = [];
    }

    update() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.type !== 'trail') {
                p.vy += p.gravity || 0.2;
            }
            
            p.life--;
            p.alpha = p.life / p.maxLife;
            
            // Shrink particles over time
            if (p.shrink) {
                p.size *= 0.96;
            }
            
            return p.life > 0 && p.size > 0.5;
        });
    }

    draw() {
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            
            if (p.glow) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = p.color;
            }
            
            this.ctx.fillStyle = p.color;
            
            if (p.shape === 'circle') {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                this.ctx.fillRect(p.x, p.y, p.size, p.size);
            }
            
            this.ctx.restore();
        });
    }

    createBurst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 2 + Math.random() * 3;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 2,
                color: color,
                life: 30,
                maxLife: 30,
                alpha: 1,
                gravity: 0.15,
                glow: true,
                shape: 'circle',
                shrink: true
            });
        }
    }

    createExplosion(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                size: 4 + Math.random() * 4,
                color: color,
                life: 40,
                maxLife: 40,
                alpha: 1,
                gravity: 0.25,
                glow: true,
                shape: Math.random() > 0.5 ? 'circle' : 'square',
                shrink: true
            });
        }
        
        // Add shockwave ring
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = 5 + Math.random() * 2;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2,
                color: color,
                life: 20,
                maxLife: 20,
                alpha: 1,
                gravity: 0,
                glow: true,
                shape: 'circle',
                shrink: true
            });
        }
    }
    
    createTrail(x, y, color) {
        this.particles.push({
            x: x + Math.random() * 8 - 4,
            y: y + Math.random() * 8 - 4,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: 2 + Math.random() * 2,
            color: color,
            life: 15,
            maxLife: 15,
            alpha: 0.6,
            gravity: 0.05,
            glow: false,
            shape: 'square',
            shrink: true,
            type: 'trail'
        });
    }
    
    createSparkle(x, y, color) {
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 * i) / 4;
            const speed = 1 + Math.random();
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2,
                color: color,
                life: 25,
                maxLife: 25,
                alpha: 1,
                gravity: 0,
                glow: true,
                shape: 'circle',
                shrink: true
            });
        }
    }
}

// ==================== BACKGROUND ====================

class Background {
    constructor(ctx) {
        this.ctx = ctx;
        this.elements = [];
        this.stars = [];
        this.gridLines = [];
        this.init();
    }

    init() {
        // Code symbols (near layer)
        const chars = ['{}', '()', '[]', '//', '/*', '*/', '<>', '==', '!=', '++', '--', 'fn', 'if', 'for'];
        for (let i = 0; i < 20; i++) {
            this.elements.push({
                x: Math.random() * 900,
                y: Math.random() * 400,
                char: chars[Math.floor(Math.random() * chars.length)],
                speed: 0.3 + Math.random() * 0.6,
                opacity: 0.1 + Math.random() * 0.2,
                size: 20 + Math.random() * 8
            });
        }
        
        // Far layer symbols (slower, dimmer)
        for (let i = 0; i < 15; i++) {
            this.elements.push({
                x: Math.random() * 900,
                y: Math.random() * 400,
                char: chars[Math.floor(Math.random() * chars.length)],
                speed: 0.1 + Math.random() * 0.2,
                opacity: 0.05 + Math.random() * 0.1,
                size: 16 + Math.random() * 6
            });
        }
        
        // Stars/pixels (background layer)
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * 900,
                y: Math.random() * 400,
                size: Math.random() * 2 + 1,
                speed: 0.05 + Math.random() * 0.1,
                opacity: 0.2 + Math.random() * 0.4,
                twinkle: Math.random() * Math.PI * 2
            });
        }
        
        // Grid lines (perspective effect)
        for (let i = 0; i < 10; i++) {
            this.gridLines.push({
                x: i * 100,
                speed: 2,
                opacity: 0.15
            });
        }
    }

    update(gameSpeed) {
        // Update code elements
        this.elements.forEach(el => {
            el.x -= el.speed;
            if (el.x < -50) {
                el.x = 900 + Math.random() * 100;
                el.y = Math.random() * 400;
            }
        });
        
        // Update stars
        this.stars.forEach(star => {
            star.x -= star.speed;
            if (star.x < -5) {
                star.x = 900 + Math.random() * 50;
                star.y = Math.random() * 400;
            }
            star.twinkle += 0.05;
        });
        
        // Update grid
        this.gridLines.forEach(line => {
            line.x -= line.speed;
            if (line.x < -10) {
                line.x = 900;
            }
        });
    }

    draw() {
        // Draw stars (furthest layer)
        this.stars.forEach(star => {
            const twinkleOpacity = star.opacity * (0.5 + Math.sin(star.twinkle) * 0.5);
            this.ctx.fillStyle = `rgba(88, 166, 255, ${twinkleOpacity})`;
            this.ctx.fillRect(star.x, star.y, star.size, star.size);
        });
        
        // Draw grid lines (perspective floor)
        this.ctx.strokeStyle = 'rgba(57, 211, 83, 0.1)';
        this.ctx.lineWidth = 1;
        this.gridLines.forEach(line => {
            this.ctx.beginPath();
            this.ctx.moveTo(line.x, 420);
            this.ctx.lineTo(line.x, 500);
            this.ctx.stroke();
        });
        
        // Draw code elements (sort by speed for layering)
        const sorted = [...this.elements].sort((a, b) => a.speed - b.speed);
        sorted.forEach(el => {
            this.ctx.font = `${el.size}px VT323`;
            this.ctx.fillStyle = `rgba(57, 211, 83, ${el.opacity})`;
            this.ctx.fillText(el.char, el.x, el.y);
        });
        
        // Draw ground with gradient
        const groundGradient = this.ctx.createLinearGradient(0, 410, 0, 416);
        groundGradient.addColorStop(0, 'rgba(57, 211, 83, 0.4)');
        groundGradient.addColorStop(1, 'rgba(57, 211, 83, 1)');
        this.ctx.fillStyle = groundGradient;
        this.ctx.fillRect(0, 410, 900, 6);
        
        // Main ground line
        this.ctx.fillStyle = '#39d353';
        this.ctx.fillRect(0, 412, 900, 4);
        
        // Draw perspective grid on ground
        this.ctx.fillStyle = 'rgba(57, 211, 83, 0.2)';
        for (let i = 0; i < 900; i += 20) {
            const height = 84 - (i % 100) / 5; // Perspective effect
            this.ctx.fillRect(i, 416, 2, height);
        }
        
        // Horizontal grid lines
        for (let i = 420; i < 500; i += 15) {
            this.ctx.fillStyle = `rgba(57, 211, 83, ${0.1 - (i - 420) / 800})`;
            this.ctx.fillRect(0, i, 900, 1);
        }
        
        // Subtle glow under ground
        const glowGradient = this.ctx.createLinearGradient(0, 416, 0, 450);
        glowGradient.addColorStop(0, 'rgba(57, 211, 83, 0.15)');
        glowGradient.addColorStop(1, 'rgba(57, 211, 83, 0)');
        this.ctx.fillStyle = glowGradient;
        this.ctx.fillRect(0, 416, 900, 34);
    }
}

// ==================== CAMERA ====================

class Camera {
    constructor() {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTime = 0;
    }

    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeTime = Date.now();
    }

    getShake() {
        const elapsed = Date.now() - this.shakeTime;
        if (elapsed > this.shakeDuration) {
            return { x: 0, y: 0 };
        }
        
        const progress = 1 - (elapsed / this.shakeDuration);
        const intensity = this.shakeIntensity * progress;
        
        return {
            x: (Math.random() - 0.5) * intensity,
            y: (Math.random() - 0.5) * intensity
        };
    }
}

// ==================== ACHIEVEMENT MANAGER ====================

class AchievementManager {
    constructor() {
        this.achievements = [
            { id: 'first_commit', name: 'FIRST COMMIT', desc: 'Collect your first commit', icon: '✓', requirement: (stats) => stats.commits >= 1 },
            { id: 'streak_10', name: 'GETTING STARTED', desc: 'Reach a streak of 10', icon: '🔥', requirement: (stats) => stats.streak >= 10 },
            { id: 'streak_50', name: 'ON FIRE', desc: 'Reach a streak of 50', icon: '🔥', requirement: (stats) => stats.streak >= 50 },
            { id: 'score_1000', name: 'MILESTONE', desc: 'Score 1000 points', icon: '🎯', requirement: (stats) => stats.score >= 1000 },
            { id: 'score_5000', name: 'HIGH ACHIEVER', desc: 'Score 5000 points', icon: '🏆', requirement: (stats) => stats.score >= 5000 },
            { id: 'combo_5', name: 'COMBO MASTER', desc: 'Get a 5x combo', icon: '⚡', requirement: (stats) => stats.maxCombo >= 5 },
            { id: 'combo_10', name: 'UNSTOPPABLE', desc: 'Get a 10x combo', icon: '💫', requirement: (stats) => stats.maxCombo >= 10 },
            { id: 'commits_100', name: 'CONTRIBUTOR', desc: 'Collect 100 commits', icon: '📝', requirement: (stats) => stats.commits >= 100 }
        ];
        
        this.unlocked = this.loadUnlocked();
    }

    loadUnlocked() {
        const saved = localStorage.getItem('commitStreakAchievements');
        return saved ? JSON.parse(saved) : [];
    }

    saveUnlocked() {
        localStorage.setItem('commitStreakAchievements', JSON.stringify(this.unlocked));
    }

    checkAchievements(stats) {
        const newUnlocked = [];
        
        this.achievements.forEach(achievement => {
            if (!this.unlocked.includes(achievement.id) && achievement.requirement(stats)) {
                this.unlocked.push(achievement.id);
                newUnlocked.push(achievement);
            }
        });
        
        if (newUnlocked.length > 0) {
            this.saveUnlocked();
        }
        
        return newUnlocked;
    }

    display() {
        const grid = document.getElementById('achievementsGrid');
        grid.innerHTML = '';
        
        this.achievements.forEach(achievement => {
            const isUnlocked = this.unlocked.includes(achievement.id);
            const item = document.createElement('div');
            item.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
            item.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.desc}</div>
            `;
            grid.appendChild(item);
        });
    }
}

// ==================== INITIALIZE GAME ====================

let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new GameEngine();
});
