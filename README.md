# Coinroids

Coinroids is a portfolio experiment built with Phaser that reimagines the classic asteroid-style arcade loop with a crypto theme. You pilot a ship through a starfield, blast incoming coins with laser shots, and try to survive long enough to build the most valuable wallet possible before your hull is destroyed or time runs out.

The project started as a fun gameplay prototype and evolved into a small front-end game focused on moment-to-moment feel, visual feedback, and lightweight game systems such as shielded enemies, wallet scoring, and retro-inspired audio synthesis.

## Highlights

- Built as a portfolio experiment to explore game development with Phaser
- Fast arcade movement with thrust, turning, braking, and wraparound space navigation
- Laser weapon system with custom synthesized sound effects
- Shielded crypto coins with hit reactions and difficulty scaling
- Wallet-based scoring system using a frozen crypto price snapshot for dramatic run totals
- Responsive browser layout with a polished heads-up display and run summary modal
- Lightweight asset setup using SVG coin art and procedural Phaser graphics

## Tech Stack

- **Phaser** for gameplay, rendering, animation, and Arcade Physics
- **JavaScript** for game logic and UI wiring
- **Vite** for local development and production builds
- **HTML** for the app shell and overlay structure
- **CSS** for layout, styling, and heads-up display visuals
- **Web Audio API** for synthesized sound effects

## Gameplay

- Move with **W** or **Up Arrow**
- Rotate with **A / D** or **Left / Right Arrow**
- Fire with **Space**
- Brake with **Shift**
- Survive for **60 seconds** or until your hull reaches zero
- Break coin shields, destroy coins, and grow your wallet value

## Current Coin Lineup

- Bitcoin
- Ethereum
- Solana
- XRP
- Dogecoin

Each coin has its own size, speed, spawn weight, and shield strength. Higher-value coins are larger, tougher, and more rewarding to collect.

## Project Structure

```text
.
├── index.html
├── package.json
├── src
│   ├── main.js
│   ├── style.css
│   └── assets
│       └── coins
│           ├── btc.svg
│           ├── doge.svg
│           ├── eth.svg
│           ├── sol.svg
│           └── xrp.svg
└── ...
```

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

## Deployment

This project is a simple front-end Vite app, so it can be deployed easily to services like **Vercel**.

Typical deployment flow:

1. Push the repo to GitHub
2. Import the project into Vercel
3. Let Vercel detect the app as a Vite project
4. Deploy using the default build settings

## Why I Built This

I made Coinroids as a portfolio experiment to explore:

- game feel and gameplay feedback in the browser
- Phaser as a front-end game framework
- balancing challenge and reward in a small arcade loop
- combining playful design with a polished web presentation

It is also a good example of shipping a focused interactive project from prototype to a demo-ready state.

## Future Ideas

- Fullscreen support refinements
- Leaderboard or high-score persistence beyond local storage
- Additional sound design variations
- More enemy types, power-ups, or combo scoring
- Mobile-friendly control options

## License

This project is currently shared as a personal portfolio/demo project.
