import Phaser from 'phaser';
import './style.css';
import btcUrl from './assets/coins/btc.svg';
import ethUrl from './assets/coins/eth.svg';
import solUrl from './assets/coins/sol.svg';
import dogeUrl from './assets/coins/doge.svg';
import pepeUrl from './assets/coins/pepe.svg';
import bonkUrl from './assets/coins/bonk.svg';

const GAME_WIDTH = 1100;
const GAME_HEIGHT = 700;
const ROUND_DURATION_MS = 60000;
const SHOOT_DELAY_MS = 180;
const MAX_SPEED = 360;
const DRAG = 0.992;
const BRAKE_DRAG = 0.965;

// ===== AUDIO VOLUME CONFIG =====
const MASTER_VOLUME = 0.8;
const SHOOT_VOLUME = 0.35;
const COIN_VOLUME = 0.45;
const COIN_FINAL_VOLUME = 0.6;
const HIT_VOLUME = 0.7;

// ===== LOCAL TOP SCORE =====
const TOP_RUN_STORAGE_KEY = 'coinroidsTopRun';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const amountFormatters = {
  BTC: new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
  ETH: new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  SOL: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  DOGE: new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  PEPE: new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  BONK: new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
};

const COIN_TYPES = {
  BTC: { label: 'Bitcoin', amount: 0.0001, usd: 8.5, scale: 1.2, hp: 3, speed: 42, spawnWeight: 8, assetUrl: btcUrl, ring: 0xf7931a },
  ETH: { label: 'Ethereum', amount: 0.0015, usd: 4.8, scale: 1.08, hp: 2, speed: 58, spawnWeight: 10, assetUrl: ethUrl, ring: 0x8e9cff },
  SOL: { label: 'Solana', amount: 0.08, usd: 10.75, scale: 1.02, hp: 2, speed: 68, spawnWeight: 10, assetUrl: solUrl, ring: 0x3df2cb },
  DOGE: { label: 'Dogecoin', amount: 4, usd: 0.72, scale: 0.96, hp: 1, speed: 75, spawnWeight: 14, assetUrl: dogeUrl, ring: 0xdcb350 },
  PEPE: { label: 'Pepe', amount: 800, usd: 0.65, scale: 0.88, hp: 1, speed: 92, spawnWeight: 14, assetUrl: pepeUrl, ring: 0x56d36d },
  BONK: { label: 'Bonk', amount: 3000, usd: 0.54, scale: 0.82, hp: 1, speed: 112, spawnWeight: 12, assetUrl: bonkUrl, ring: 0xff7f50 }
};

const wallet = {};
const walletDomBySymbol = {};
for (const symbol of Object.keys(COIN_TYPES)) {
  wallet[symbol] = 0;
}

const walletListEl = document.getElementById('wallet-list');
const walletTotalEl = document.getElementById('wallet-total');
const topRunEl = document.getElementById('top-run');
const overlayEl = document.getElementById('overlay');
const modalTitleEl = document.getElementById('modal-title');
const modalSummaryEl = document.getElementById('modal-summary');
const modalBreakdownEl = document.getElementById('modal-breakdown');
const restartButtonEl = document.getElementById('restart-button');
const playAgainButtonEl = document.getElementById('play-again-button');

function formatCoinAmount(symbol, amount) {
  return (amountFormatters[symbol] ?? amountFormatters.DOGE).format(amount);
}

function formatUsd(value) {
  return usdFormatter.format(value);
}

function getTopRun() {
  try {
    const raw = localStorage.getItem(TOP_RUN_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function setTopRun(value) {
  localStorage.setItem(TOP_RUN_STORAGE_KEY, JSON.stringify(value));
}

function maybeUpdateTopRun(value) {
  const currentTopRun = getTopRun();
  if (value > currentTopRun) {
    setTopRun(value);
    return value;
  }
  return currentTopRun;
}

function renderTopRun() {
  if (!topRunEl) return;
  topRunEl.textContent = formatUsd(getTopRun());
}

function getWalletTotalUsd() {
  return Object.entries(wallet).reduce((sum, [symbol, count]) => {
    return sum + count * COIN_TYPES[symbol].usd;
  }, 0);
}

function buildWalletDom() {
  walletListEl.innerHTML = '';

  for (const [symbol, config] of Object.entries(COIN_TYPES)) {
    const li = document.createElement('li');
    li.className = 'wallet-item';
    li.dataset.symbol = symbol;
    li.innerHTML = `
      <div class="wallet-item__left">
        <img class="wallet-icon" src="${config.assetUrl}" alt="${config.label} logo" />
        <div>
          <strong>${symbol}</strong>
          <small>${config.label}</small>
        </div>
      </div>
      <div class="wallet-item__right">
        <div>
          <strong data-role="amount">${formatCoinAmount(symbol, wallet[symbol])}</strong>
          <small data-role="usd">${formatUsd(wallet[symbol] * config.usd)}</small>
        </div>
      </div>
    `;
    walletListEl.appendChild(li);
    walletDomBySymbol[symbol] = li;
  }
}

function flashWalletCard(symbol) {
  const el = walletDomBySymbol[symbol];
  if (!el) return;
  el.classList.remove('wallet-flash');
  void el.offsetWidth;
  el.classList.add('wallet-flash');
}

function renderWallet() {
  if (!walletListEl.children.length) {
    buildWalletDom();
  }

  for (const [symbol, config] of Object.entries(COIN_TYPES)) {
    const row = walletDomBySymbol[symbol];
    if (!row) continue;
    row.querySelector('[data-role="amount"]').textContent = formatCoinAmount(symbol, wallet[symbol]);
    row.querySelector('[data-role="usd"]').textContent = formatUsd(wallet[symbol] * config.usd);
  }

  walletTotalEl.textContent = formatUsd(getWalletTotalUsd());
}

function resetWallet() {
  for (const symbol of Object.keys(wallet)) {
    wallet[symbol] = 0;
  }
  renderWallet();
}

function weightedCoinPick() {
  const entries = Object.entries(COIN_TYPES);
  const totalWeight = entries.reduce((sum, [, config]) => sum + config.spawnWeight, 0);
  let roll = Phaser.Math.Between(1, totalWeight);

  for (const [symbol, config] of entries) {
    roll -= config.spawnWeight;
    if (roll <= 0) {
      return [symbol, config];
    }
  }

  return entries[0];
}

class SoundSynth {
  constructor(scene) {
    this.scene = scene;
    this.ctx = null;
    this.masterGain = null;
    this.enabled = false;
  }

  ensureReady() {
    if (this.enabled) return true;
    const BaseAudioContext = window.AudioContext || window.webkitAudioContext;
    if (!BaseAudioContext) return false;
    this.ctx = this.ctx || new BaseAudioContext();
    this.masterGain = this.masterGain || this.ctx.createGain();
    this.masterGain.gain.value = MASTER_VOLUME;
    this.masterGain.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.enabled = true;
    return true;
  }

  connectNode(node) {
    node.connect(this.masterGain);
  }

  playShoot() {
    if (!this.ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(SHOOT_VOLUME, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    osc.connect(gain);
    this.connectNode(gain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playCoinHit(isFinal = false) {
    if (!this.ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const startFreq = isFinal ? 460 : 320;
    const endFreq = isFinal ? 920 : 520;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    const peakVolume = isFinal ? COIN_FINAL_VOLUME : COIN_VOLUME;
    gain.gain.exponentialRampToValueAtTime(peakVolume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    this.connectNode(gain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playPlayerHit() {
    if (!this.ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(HIT_VOLUME, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(filter);
    filter.connect(gain);
    this.connectNode(gain);
    osc.start(now);
    osc.stop(now + 0.21);
  }
}

class CoinroidsScene extends Phaser.Scene {
  constructor() {
    super('coinroids');
    this.lastShotAt = 0;
    this.gameEnded = false;
    this.coinSpawnEvent = null;
    this.endTime = 0;
    this.coinsCollected = 0;
    this.shipLives = 3;
    this.soundSynth = null;
  }

  preload() {
    this.createTextures();
    for (const [symbol, config] of Object.entries(COIN_TYPES)) {
      this.load.image(`coin-${symbol}`, config.assetUrl);
    }
  }

  create() {
    this.gameEnded = false;
    this.lastShotAt = 0;
    this.coinsCollected = 0;
    this.shipLives = 3;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.soundSynth = new SoundSynth(this);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050914);
    this.createStarfield();

    this.ship = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ship');
    this.ship.setDamping(false);
    this.ship.setCircle(18);
    this.ship.setCollideWorldBounds(false);
    this.ship.setDrag(0, 0);
    this.ship.setAngularDrag(0);
    this.ship.setMaxVelocity(MAX_SPEED, MAX_SPEED);
    this.ship.setDepth(3);

    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 40,
      runChildUpdate: false
    });

    this.coins = this.physics.add.group();

    this.physics.add.overlap(this.bullets, this.coins, this.handleBulletCoinCollision, null, this);
    this.physics.add.overlap(this.ship, this.coins, this.handleShipCoinCollision, null, this);

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT
    });

    this.input.once('pointerdown', () => this.soundSynth.ensureReady());
    this.input.keyboard.once('keydown', () => this.soundSynth.ensureReady());

    this.createHud();
    this.time.delayedCall(800, () => this.spawnCoinWave(5));
    this.coinSpawnEvent = this.time.addEvent({
      delay: 1200,
      loop: true,
      callback: () => this.spawnCoinWave(Phaser.Math.Between(2, 4))
    });

    this.endTime = this.time.now + ROUND_DURATION_MS;
    resetWallet();
    this.hideOverlay();
  }

  createTextures() {
    if (!this.textures.exists('ship')) {
      const ship = this.make.graphics({ x: 0, y: 0, add: false });
      ship.fillStyle(0x9efcff, 1);
      ship.lineStyle(3, 0xe6fbff, 1);
      ship.beginPath();
      ship.moveTo(26, 16);
      ship.lineTo(4, 30);
      ship.lineTo(10, 16);
      ship.lineTo(4, 2);
      ship.closePath();
      ship.fillPath();
      ship.strokePath();
      ship.generateTexture('ship', 32, 32);
      ship.destroy();
    }

    if (!this.textures.exists('bullet')) {
      const bullet = this.make.graphics({ x: 0, y: 0, add: false });
      bullet.fillStyle(0xffffff, 1);
      bullet.fillCircle(4, 4, 4);
      bullet.generateTexture('bullet', 8, 8);
      bullet.destroy();
    }
  }

  createStarfield() {
    const stars = this.add.graphics();
    for (let i = 0; i < 150; i += 1) {
      const alpha = Phaser.Math.FloatBetween(0.25, 0.9);
      const radius = Phaser.Math.FloatBetween(0.8, 2.2);
      stars.fillStyle(0xffffff, alpha);
      stars.fillCircle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        radius
      );
    }
  }

  createHud() {
    this.timerText = this.add.text(24, 18, 'Time: 60.0', {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#e8eeff'
    }).setDepth(4);

    this.livesText = this.add.text(24, 52, 'Hull: 3', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#a3b8ff'
    }).setDepth(4);

    this.tipText = this.add.text(GAME_WIDTH - 24, 18, 'Collect value, avoid collisions', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d7e3ff'
    }).setOrigin(1, 0).setDepth(4);
  }

  update(time, delta) {
    if (this.gameEnded) return;

    const dt = delta / 1000;
    const turnSpeed = 210;
    const thrustPower = 210;
    const rotationInput = (this.keys.left.isDown || this.keys.a.isDown ? -1 : 0) + (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0);

    this.ship.setAngularVelocity(rotationInput * turnSpeed);

    if (this.keys.up.isDown || this.keys.w.isDown) {
      this.physics.velocityFromRotation(this.ship.rotation, thrustPower, this.ship.body.acceleration);
      this.emitThruster();
    } else {
      this.ship.setAcceleration(0, 0);
    }

    if (this.keys.shift.isDown) {
      this.ship.body.velocity.scale(BRAKE_DRAG);
    } else {
      this.ship.body.velocity.scale(DRAG);
    }

    this.ship.body.velocity.limit(MAX_SPEED);

    if (Phaser.Input.Keyboard.JustDown(this.keys.space) || (this.keys.space.isDown && time - this.lastShotAt > SHOOT_DELAY_MS)) {
      this.fireBullet(time);
    }

    this.wrapObject(this.ship);

    this.bullets.children.iterate((bullet) => {
      if (!bullet?.active) return;
      this.wrapObject(bullet, 12);
      bullet.lifeMs -= delta;
      if (bullet.lifeMs <= 0) {
        bullet.destroy();
      }
    });

    this.coins.children.iterate((coin) => {
      if (!coin?.active) return;
      this.wrapObject(coin, 38);
      coin.rotation += coin.spinSpeed * dt;
    });

    const remaining = Math.max(0, (this.endTime - time) / 1000);
    this.timerText.setText(`Time: ${remaining.toFixed(1)}`);

    if (remaining <= 0) {
      this.endRun('Time is up!');
    }
  }

  fireBullet(time) {
    this.lastShotAt = time;
    const bullet = this.bullets.get(this.ship.x, this.ship.y, 'bullet');
    if (!bullet) return;

    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.setDepth(3);
    bullet.body.reset(this.ship.x, this.ship.y);
    bullet.setCircle(4);

    const bulletSpeed = 460;
    const inheritedVelocityX = this.ship.body.velocity.x * 0.45;
    const inheritedVelocityY = this.ship.body.velocity.y * 0.45;

    this.physics.velocityFromRotation(this.ship.rotation, bulletSpeed, bullet.body.velocity);
    bullet.body.velocity.x += inheritedVelocityX;
    bullet.body.velocity.y += inheritedVelocityY;
    bullet.lifeMs = 1200;
    this.soundSynth.playShoot();
  }

  spawnCoinWave(count) {
    for (let i = 0; i < count; i += 1) {
      this.spawnCoin();
    }
  }

  spawnCoin() {
    const [symbol, config] = weightedCoinPick();
    const spawnFromHorizontal = Math.random() > 0.5;
    let x;
    let y;

    if (spawnFromHorizontal) {
      x = Math.random() > 0.5 ? -50 : GAME_WIDTH + 50;
      y = Phaser.Math.Between(20, GAME_HEIGHT - 20);
    } else {
      x = Phaser.Math.Between(20, GAME_WIDTH - 20);
      y = Math.random() > 0.5 ? -50 : GAME_HEIGHT + 50;
    }

    const coin = this.coins.create(x, y, `coin-${symbol}`);
    coin.symbol = symbol;
    coin.config = config;
    coin.hp = config.hp;
    coin.spinSpeed = Phaser.Math.FloatBetween(-2.4, 2.4);
    coin.setScale(config.scale);
    coin.setCircle(28);
    coin.setBounce(1, 1);
    coin.setDepth(2);

    const ring = this.add.circle(x, y, 34, config.ring, 0.12).setDepth(1.5);
    ring.setStrokeStyle(2, config.ring, 0.35);
    coin.glowRing = ring;

    const targetAngle = Phaser.Math.Angle.Between(x, y, this.ship.x, this.ship.y) + Phaser.Math.FloatBetween(-0.5, 0.5);
    this.physics.velocityFromRotation(targetAngle, config.speed + Phaser.Math.Between(-10, 20), coin.body.velocity);
  }

  handleBulletCoinCollision(bullet, coin) {
    if (!bullet.active || !coin.active) return;

    bullet.destroy();
    coin.hp -= 1;
    this.soundSynth.playCoinHit(coin.hp <= 0);
    this.coinFlash(coin.x, coin.y, coin.config.ring, 6);

    if (coin.hp <= 0) {
      wallet[coin.symbol] += coin.config.amount;
      this.coinsCollected += 1;
      renderWallet();
      flashWalletCard(coin.symbol);
      this.coinFlash(coin.x, coin.y, coin.config.ring, 18);
      coin.glowRing?.destroy();
      coin.destroy();
    }
  }

  handleShipCoinCollision(ship, coin) {
    if (this.gameEnded || !coin.active) return;

    coin.glowRing?.destroy();
    coin.destroy();
    this.shipLives -= 1;
    this.livesText.setText(`Hull: ${this.shipLives}`);
    this.cameras.main.shake(150, 0.008);
    this.coinFlash(ship.x, ship.y, 0xff5577, 16);
    this.soundSynth.playPlayerHit();

    if (this.shipLives <= 0) {
      this.endRun('Hull breach!');
    }
  }

  emitThruster() {
    if (Math.random() > 0.35) return;
    const angle = this.ship.rotation + Math.PI;
    const x = this.ship.x - Math.cos(this.ship.rotation) * 16;
    const y = this.ship.y - Math.sin(this.ship.rotation) * 16;
    const particle = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0x74f0cf, 0.9).setDepth(1);

    this.tweens.add({
      targets: particle,
      x: x + Math.cos(angle) * Phaser.Math.Between(12, 24),
      y: y + Math.sin(angle) * Phaser.Math.Between(12, 24),
      alpha: 0,
      scale: 0.3,
      duration: 220,
      onComplete: () => particle.destroy()
    });
  }

  coinFlash(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 5), color, 0.9).setDepth(3);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(16, 56);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(260, 420),
        onComplete: () => particle.destroy()
      });
    }
  }

  wrapObject(gameObject, padding = 24) {
    if (gameObject.x < -padding) gameObject.x = GAME_WIDTH + padding;
    else if (gameObject.x > GAME_WIDTH + padding) gameObject.x = -padding;

    if (gameObject.y < -padding) gameObject.y = GAME_HEIGHT + padding;
    else if (gameObject.y > GAME_HEIGHT + padding) gameObject.y = -padding;

    if (gameObject.glowRing) {
      gameObject.glowRing.x = gameObject.x;
      gameObject.glowRing.y = gameObject.y;
    }
  }

  endRun(reason) {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.ship.setAcceleration(0, 0);
    this.ship.setAngularVelocity(0);
    this.ship.setVelocity(0, 0);
    this.coinSpawnEvent?.remove(false);

    this.coins.children.iterate((coin) => {
      if (!coin?.active) return;
      coin.glowRing?.destroy();
    });

    const totalUsd = getWalletTotalUsd();
    const topRun = maybeUpdateTopRun(totalUsd);
    renderTopRun();
    const survivedSeconds = ((ROUND_DURATION_MS - Math.max(0, this.endTime - this.time.now)) / 1000).toFixed(1);

    modalTitleEl.textContent = reason === 'Time is up!' ? 'Wallet secured 🎉' : 'Run over 💥';
    modalSummaryEl.textContent = `${reason} You survived ${survivedSeconds} seconds and captured ${this.coinsCollected} coins worth ${formatUsd(totalUsd)}. Top run: ${formatUsd(topRun)}.`;
    modalBreakdownEl.innerHTML = Object.entries(COIN_TYPES)
      .map(([symbol, config]) => {
        return `
          <div class="breakdown-row">
            <span>${symbol} · ${config.label}</span>
            <strong>${formatCoinAmount(symbol, wallet[symbol])}</strong>
          </div>
        `;
      })
      .join('');

    this.showOverlay();
  }

  restartRun() {
    this.scene.restart();
  }

  showOverlay() {
    overlayEl.classList.remove('hidden');
    overlayEl.setAttribute('aria-hidden', 'false');
  }

  hideOverlay() {
    overlayEl.classList.add('hidden');
    overlayEl.setAttribute('aria-hidden', 'true');
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#030712',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [CoinroidsScene]
});

function restartGame() {
  const scene = game.scene.getScene('coinroids');
  scene.restartRun();
}

restartButtonEl.addEventListener('click', restartGame);
playAgainButtonEl.addEventListener('click', restartGame);

renderWallet();
renderTopRun();