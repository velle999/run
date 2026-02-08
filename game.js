// ==================== GAME ENGINE ====================

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = 'start';
        this.frameCount = 0;
        this.isPaused = false;
        
        this.settings = this.loadSettings();
        this.stats = this.loadStats();
        this.achievements = new AchievementManager();
        
        this.initializeEntities();
        this.initializeEventListeners();
        this.gameLoop();
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
            this.particleSystem.createBurst(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2,
                '#39d353',
                8
            );
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
        
        // Draw game elements
        this.background.draw();
        this.collectibleManager.draw(this.ctx);
        this.powerupManager.draw(this.ctx);
        this.obstacleManager.draw(this.ctx);
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
        
        // Web Audio API sound generation
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
        
        // Invincibility flashing
        if (this.invincible && Math.floor(frameCount / 5) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        ctx.fillStyle = '#39d353';
        
        if (this.sliding) {
            // Sliding pose
            ctx.fillRect(this.x, this.y + 16, 32, 16);
            ctx.fillRect(this.x + 8, this.y + 8, 16, 8);
        } else {
            // Head
            ctx.fillRect(this.x + 8, this.y, 16, 16);
            // Body
            ctx.fillRect(this.x + 8, this.y + 16, 16, 12);
            // Legs (animated)
            const legOffset = Math.floor(frameCount / 10) % 2 * 4;
            ctx.fillRect(this.x + 8, this.y + 28, 6, 4);
            ctx.fillRect(this.x + 18, this.y + 28, 6, 4);
            
            // Eyes
            ctx.fillStyle = '#0d1117';
            ctx.fillRect(this.x + 10, this.y + 6, 4, 4);
            ctx.fillRect(this.x + 18, this.y + 6, 4, 4);
        }
        
        ctx.restore();
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

    draw(ctx) {
        this.obstacles.forEach(obs => {
            ctx.fillStyle = obs.color;
            
            if (obs.type === 'bug') {
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.fillStyle = '#0d1117';
                ctx.fillRect(obs.x + 8, obs.y + 4, 4, 4);
                ctx.fillRect(obs.x + 16, obs.y + 4, 4, 4);
            } else if (obs.type === 'conflict') {
                for (let i = 0; i < 3; i++) {
                    ctx.fillRect(obs.x, obs.y + i * 12, obs.width, 8);
                }
            } else if (obs.type === 'spike') {
                // Draw triangular spike
                ctx.beginPath();
                ctx.moveTo(obs.x, obs.y + obs.height);
                ctx.lineTo(obs.x + obs.width / 2, obs.y);
                ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
                ctx.closePath();
                ctx.fill();
            }
        });
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

    draw(ctx) {
        this.collectibles.forEach(col => {
            const drawY = col.y + col.floatOffset;
            
            // Glow effect
            ctx.fillStyle = 'rgba(57, 211, 83, 0.3)';
            ctx.fillRect(col.x - 2, drawY - 2, col.width + 4, col.height + 4);
            
            // Main checkmark
            ctx.fillStyle = '#39d353';
            ctx.fillRect(col.x, drawY, col.width, col.height);
            ctx.fillStyle = '#0d1117';
            
            // Checkmark shape
            ctx.fillRect(col.x + 4, drawY + 12, 4, 8);
            ctx.fillRect(col.x + 8, drawY + 8, 4, 4);
            ctx.fillRect(col.x + 12, drawY + 4, 4, 8);
        });
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

    draw(ctx) {
        this.powerups.forEach(pu => {
            const drawY = pu.y + pu.floatOffset;
            
            // Glow effect
            ctx.fillStyle = pu.color.replace(')', ', 0.3)').replace('rgb', 'rgba');
            ctx.fillRect(pu.x - 4, drawY - 4, pu.width + 8, pu.height + 8);
            
            // Main box
            ctx.fillStyle = pu.color;
            ctx.fillRect(pu.x, drawY, pu.width, pu.height);
            
            // Icon (simplified)
            ctx.fillStyle = '#0d1117';
            ctx.fillRect(pu.x + 8, drawY + 8, 16, 16);
        });
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
            p.vy += 0.2; // gravity
            p.life--;
            p.alpha = p.life / p.maxLife;
            return p.life > 0;
        });
    }

    draw() {
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
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
                size: 4,
                color: color,
                life: 30,
                maxLife: 30,
                alpha: 1
            });
        }
    }

    createExplosion(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                size: 6,
                color: color,
                life: 40,
                maxLife: 40,
                alpha: 1
            });
        }
    }
}

// ==================== BACKGROUND ====================

class Background {
    constructor(ctx) {
        this.ctx = ctx;
        this.elements = [];
        this.init();
    }

    init() {
        const chars = ['{}', '()', '[]', '//', '/*', '*/', '<>', '==', '!=', '++', '--'];
        for (let i = 0; i < 20; i++) {
            this.elements.push({
                x: Math.random() * 900,
                y: Math.random() * 400,
                char: chars[Math.floor(Math.random() * chars.length)],
                speed: 0.2 + Math.random() * 0.5,
                opacity: 0.1 + Math.random() * 0.15
            });
        }
    }

    update(gameSpeed) {
        this.elements.forEach(el => {
            el.x -= el.speed;
            if (el.x < -50) {
                el.x = 900;
                el.y = Math.random() * 400;
            }
        });
    }

    draw() {
        this.ctx.font = '24px VT323';
        this.elements.forEach(el => {
            this.ctx.fillStyle = `rgba(57, 211, 83, ${el.opacity})`;
            this.ctx.fillText(el.char, el.x, el.y);
        });
        
        // Draw ground
        this.ctx.fillStyle = '#39d353';
        this.ctx.fillRect(0, 412, 900, 4);
        
        // Draw grid pattern
        this.ctx.fillStyle = 'rgba(57, 211, 83, 0.2)';
        for (let i = 0; i < 900; i += 20) {
            this.ctx.fillRect(i, 416, 2, 84);
        }
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
