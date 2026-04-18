# Coinroids

A Phaser + TypeScript browser game focused on fast-paced arcade gameplay and polished UI feedback. 

👉 Play it here: https://phaser-coinroids.vercel.app/

[![Coinroids Gameplay](./src/assets/demo.gif)](https://your-vercel-link.vercel.app)

**⚠️ Desktop Only:** Coinroids is currently designed for keyboard input and is **not supported on mobile devices**. Please use a desktop or laptop browser for the best experience.

Coinroids is a portfolio experiment built with Phaser that reimagines the classic asteroid-style arcade loop with a crypto theme. You pilot a ship through a starfield, blast incoming coins with laser shots, and try to survive long enough to build the most valuable wallet possible before your lives are gone or time runs out.

The project started as a gameplay prototype and evolved into a polished front-end game focused on game feel, visual feedback, and lightweight systems such as shielded enemies, wallet scoring, and retro-inspired audio synthesis.

## Highlights

- Built as a portfolio project to explore browser-based game development
- Fast arcade movement with thrust, turning, braking, and wraparound navigation
- Laser weapon system with synthesized sound effects using the Web Audio API (Application Programming Interface)
- Shielded crypto coins with hit reactions and difficulty scaling
- Wallet-based scoring system using a frozen crypto price snapshot for dramatic run totals
- Polished heads-up display (HUD) and run summary experience
- Lightweight asset pipeline using SVG graphics and procedural Phaser rendering


## Tech Stack

- **Phaser** for gameplay, rendering, animation, and Arcade Physics
- **TypeScript** for strongly typed game logic and improved maintainability
- **Vite** for development server and production builds
- **HTML** for the application shell
- **CSS** for layout and UI styling
- **Web Audio API (Application Programming Interface)** for synthesized sound effects


## Gameplay

- Move with **W** or **Up Arrow**
- Rotate with **A / D** or **Left / Right Arrow**
- Fire with **Space**
- Brake with **Shift**
- Survive for **60 seconds** or until your lives reaches zero
- Break coin shields, destroy coins, and grow your wallet value


## Current Coin Lineup

- Bitcoin, Ethereum, Solana, XRP, Dogecoin

Each coin has its own size, speed, spawn weight, and shield strength. Higher-value coins are larger, tougher, and more rewarding.

---

## Getting Started

### Prerequisites

- **Node.js** 18 or newer recommended
- **npm**

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Then open the local URL shown by Vite in your terminal, usually:

```text
http://localhost:5173
```

### Create a production build

```bash
npm run build
```

### Preview the production build locally

```bash
npm run preview
```

## Why I Built This

I made Coinroids as a portfolio experiment to explore:

- game feel and gameplay feedback in the browser
- Phaser as a front-end game framework
- balancing challenge and reward in a small arcade loop
- combining playful design with a polished web presentation

It is also a good example of shipping a focused interactive project from prototype to a demo-ready state.

## Notable Work

- Migrated the entire project from JavaScript to TypeScript
- Introduced stronger typing across Phaser systems and game objects
- Improved maintainability and developer experience

## Future Ideas

- Fullscreen support refinements
- Leaderboard or high-score persistence beyond local storage
- Additional sound design variations
- More coin types, power-ups, or combo scoring
- Mobile-friendly control options
- Live coin prices instead of a snapshot

## License

This project is currently shared as a personal portfolio/demo project. It utilizes **Phaser** with **npm install phaser**
