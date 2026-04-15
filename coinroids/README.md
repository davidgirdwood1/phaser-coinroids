# Coinroids

Coinroids is a small arcade browser game built with plain JavaScript, Vite, and Phaser. You pilot a ship, blast incoming crypto coins, and fill a mock wallet before the one-minute run ends or your hull reaches zero.

## Stack

- JavaScript
- Vite
- Phaser

Phaser can be installed directly from npm and developed locally in your own editor. Vite provides the local development server and production build flow. The official docs listed at the bottom of this README cover the current setup pattern and build commands.

## Features

- Desktop-friendly asteroid-style controls
- Five coin types with different rarity, value, speed, and health
- Live wallet sidebar with mock coin totals and total dollar value
- One-minute run timer
- Simple game-over / success modal with run summary
- No backend, accounts, or persistence required

## Local setup

```bash
npm install
```

### 4) Start the local development server

```bash
npm run dev
```

Vite will print a local URL in the terminal, usually something like:

```bash
http://localhost:5173/
```

### 5) Build for production

```bash
npm run build
```

The production-ready files will be generated in the `dist` folder.

### 6) Preview the production build locally

```bash
npm run preview
```

## Controls

- `W` or `Up Arrow`: thrust
- `A` / `D` or `Left Arrow` / `Right Arrow`: rotate
- `Space`: shoot
- `Shift`: brake


## Free hosting with Vercel

This project is a static front-end app, so it is a good fit for Vercel free hosting.

Basic path:

1. Push the repo to GitHub.
2. Import the repo into Vercel.
3. Keep the default framework preset if Vercel detects Vite, or set the build command to `npm run build` and output directory to `dist`.
4. Deploy.

## Project structure

```text
coinroids/
├─ index.html
├─ package.json
├─ README.md
└─ src/
   ├─ main.js
   └─ style.css
```

## Notes for future polish

A few easy version-two upgrades if you want them later:

- Add sound effects
- Add a start screen before the timer begins
- Add a leaderboard backed by local storage or a small backend
- Add wave progression and a boss coin
- Add touch controls for mobile

## Official references

- Vite Getting Started: https://vite.dev/guide/  
- Vite Build Guide: https://vite.dev/guide/build  
- Phaser Installation: https://docs.phaser.io/phaser/getting-started/installation  
- Phaser Local Development Environment: https://docs.phaser.io/phaser/getting-started/set-up-dev-environment  

