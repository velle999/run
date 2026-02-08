# 🎮 Commit Streak

**An endless runner game for developers. Keep your GitHub streak alive!**

![Commit Streak](https://img.shields.io/badge/status-production-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🌟 Features

### Core Gameplay
- **Endless Runner Mechanics**: Jump and slide to avoid obstacles
- **Combo System**: Build combos for higher scores
- **Power-ups**: Collect special items for temporary advantages
  - 🛡️ Invincibility
  - ⏱️ Slow Motion
  - 🧲 Magnet (auto-collect)
- **Progressive Difficulty**: Game speed increases over time

### Visual & Audio
- **Retro Pixel Art**: GitHub-themed terminal aesthetic
- **Particle Effects**: Dynamic explosions and bursts
- **Screen Shake**: Impact feedback on collisions
- **Procedural Sound**: Web Audio API-generated sound effects
- **Smooth Animations**: CSS and Canvas-based animations

### Game Systems
- **Achievement System**: 8 unlockable achievements
- **High Score Tracking**: Persistent localStorage saves
- **Statistics Tracking**: Score, streak, combo, and commits
- **Settings Panel**: Customizable audio and visual preferences
- **Pause Menu**: ESC or P to pause during gameplay

## 🎯 Controls

| Key | Action |
|-----|--------|
| `↑` or `SPACE` | Jump |
| `↓` | Slide |
| `ESC` or `P` | Pause |

## 🚀 Quick Start

### Option 1: GitHub Pages (Recommended)

1. **Fork this repository**
2. **Enable GitHub Pages**:
   - Go to Settings → Pages
   - Source: Deploy from branch
   - Branch: main → /root
   - Save
3. **Access your game**: `https://yourusername.github.io/commit-streak/`

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/commit-streak.git
cd commit-streak

# Open with a local server (Python example)
python -m http.server 8000

# Or use Node.js
npx http-server

# Open browser
open http://localhost:8000
```

## 📁 Project Structure

```
commit-streak/
├── index.html          # Main HTML structure
├── styles.css          # All styling and animations
├── game.js            # Complete game engine
└── README.md          # Documentation
```

## 🏗️ Architecture

### Modular Design

The game is built with a clean, object-oriented architecture:

```javascript
GameEngine              // Main game controller
├── Player             // Player character and physics
├── ObstacleManager    // Obstacle spawning and collision
├── CollectibleManager // Commit collectibles
├── PowerupManager     // Power-up system
├── ParticleSystem     // Visual effects
├── Background         // Parallax background
├── Camera             // Screen shake effects
└── AchievementManager // Achievement tracking
```

### Key Classes

- **GameEngine**: Core game loop, state management, and event handling
- **Player**: Character physics, animations, and input handling
- **Managers**: Separate systems for obstacles, collectibles, and power-ups
- **ParticleSystem**: Procedural particle generation
- **AchievementManager**: Progress tracking and persistence

## 🎨 Customization

### Changing Colors

Edit CSS variables in `styles.css`:

```css
:root {
    --bg-dark: #0d1117;
    --terminal-green: #39d353;
    --warning-orange: #f85149;
    /* ... */
}
```

### Adding New Obstacles

In `game.js`, extend the `ObstacleManager`:

```javascript
this.types = [
    { type: 'bug', width: 32, height: 32, y: 380, color: '#f85149' },
    { type: 'your_obstacle', width: 40, height: 40, y: 372, color: '#ff00ff' }
];
```

### Creating New Achievements

Add to the `AchievementManager` constructor:

```javascript
{
    id: 'unique_id',
    name: 'ACHIEVEMENT NAME',
    desc: 'Achievement description',
    icon: '🏆',
    requirement: (stats) => stats.score >= 10000
}
```

## 🔧 Technical Details

### Technologies Used
- **Vanilla JavaScript** (ES6+)
- **HTML5 Canvas API** for rendering
- **CSS3** for UI and animations
- **Web Audio API** for sound generation
- **LocalStorage** for data persistence

### Performance Optimizations
- Efficient particle pooling
- Canvas-based rendering with proper cleanup
- Minimal DOM manipulation
- Optimized collision detection
- Request animation frame for smooth 60fps

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 📊 Statistics Tracked

- **Score**: Total points earned
- **Streak**: Current consecutive commits collected
- **Combo**: Multiplier for consecutive collections
- **Commits**: Total commits collected
- **High Score**: Best score achieved

## 🏆 Achievements

| Achievement | Requirement | Icon |
|------------|-------------|------|
| First Commit | Collect 1 commit | ✓ |
| Getting Started | 10 streak | 🔥 |
| On Fire | 50 streak | 🔥 |
| Milestone | 1000 points | 🎯 |
| High Achiever | 5000 points | 🏆 |
| Combo Master | 5x combo | ⚡ |
| Unstoppable | 10x combo | 💫 |
| Contributor | 100 commits | 📝 |

## 🎮 Gameplay Tips

1. **Timing is Everything**: Wait until the last moment to jump over obstacles
2. **Use Slide**: Sliding is faster for low obstacles
3. **Build Combos**: Collect commits consecutively for score multipliers
4. **Save Power-ups**: Use invincibility when obstacles cluster
5. **Watch the Pattern**: Obstacles spawn in predictable intervals

## 🐛 Known Issues

- None currently! Report issues on GitHub.

## 🚧 Future Enhancements

Planned features for future versions:

- [ ] Mobile touch controls
- [ ] Leaderboard integration
- [ ] Daily challenges
- [ ] More power-up types
- [ ] Boss fights
- [ ] Multiple characters
- [ ] Dark/light mode themes
- [ ] Sound/music toggle in-game
- [ ] Progressive Web App (PWA) support

## 📝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2024 Commit Streak

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Acknowledgments

- Inspired by the classic Chrome Dino game
- GitHub color scheme and design language
- Pixel art community for aesthetic inspiration

## 📧 Contact

Questions? Suggestions? Open an issue on GitHub!

---

**Made with ❤️ for the developer community**

🎮 [Play Now](#) | 🐛 [Report Bug](#) | 💡 [Request Feature](#)
