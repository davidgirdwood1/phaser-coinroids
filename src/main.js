import Phaser from 'phaser';
import './style.css';
import btcUrl from './assets/coins/btc.svg';
import ethUrl from './assets/coins/eth.svg';
import solUrl from './assets/coins/sol.svg';
import dogeUrl from './assets/coins/doge.svg';
import xrpUrl from './assets/coins/xrp.svg';

const GAME_WIDTH = 1100;
const GAME_HEIGHT = 700;
const ROUND_DURATION_MS = 60000;
const SHOOT_DELAY_MS = 180;
const MAX_SPEED = 360;
const DRAG = 0.992;
const BRAKE_DRAG = 0.965;

const MASTER_VOLUME = 0.8;
const SHOOT_VOLUME = 0.35;
const COIN_VOLUME = 0.45;
const COIN_FINAL_VOLUME = 0.6;
const HIT_VOLUME = 0.7;
const SHIELD_COLOR = 0x7c8cff;

// Price snapshot frozen on 2026-04-16 for arcade balance.
const PRICE_SNAPSHOT_LABEL = 'Price snapshot · Apr 16, 2026';
const TOP_RUN_STORAGE_KEY = 'coinroidsTopRun_priceSnapshot_v1';

const COIN_SCALES = {
  XXL: 1.28,
  XL: 1.14,
  L: 1.0,
  M: 0.88,
  S: 0.78
};

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const integerFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const amountFormatters = {
  BTC: integerFormatter,
  ETH: integerFormatter,
  SOL: integerFormatter,
  DOGE: integerFormatter,
  XRP: integerFormatter
};

const COIN_TYPES = {
  BTC: {
    label: 'Bitcoin',
    amount: 1,
    usd: 74928.79,
    sizeClass: 'XXL',
    scale: COIN_SCALES.XXL,
    shieldMax: 10,
    speed: 34,
    spawnWeight: 2,
    assetUrl: btcUrl,
    ring: SHIELD_COLOR,
    shieldColor: SHIELD_COLOR
  },
  ETH: {
    label: 'Ethereum',
    amount: 1,
    usd: 2350.53,
    sizeClass: 'XL',
    scale: COIN_SCALES.XL,
    shieldMax: 6,
    speed: 46,
    spawnWeight: 5,
    assetUrl: ethUrl,
    ring: SHIELD_COLOR,
    shieldColor: SHIELD_COLOR
  },
  SOL: {
    label: 'Solana',
    amount: 1,
    usd: 90.08,
    sizeClass: 'L',
    scale: COIN_SCALES.L,
    shieldMax: 3,
    speed: 62,
    spawnWeight: 9,
    assetUrl: solUrl,
    ring: SHIELD_COLOR,
    shieldColor: SHIELD_COLOR
  },
  XRP: {
    label: 'XRP',
    amount: 1,
    usd: 1.45,
    sizeClass: 'M',
    scale: COIN_SCALES.M,
    shieldMax: 2,
    speed: 86,
    spawnWeight: 13,
    assetUrl: xrpUrl,
    ring: SHIELD_COLOR,
    shieldColor: SHIELD_COLOR
  },
  DOGE: {
    label: 'Dogecoin',
    amount: 1,
    usd: 0.09901,
    sizeClass: 'S',
    scale: COIN_SCALES.S,
    shieldMax: 1,
    speed: 108,
    spawnWeight: 17,
    assetUrl: dogeUrl,
    ring: SHIELD_COLOR,
    shieldColor: SHIELD_COLOR
  }
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
const walletSnapshotEl = document.getElementById('wallet-snapshot');

function formatCoinAmount(symbol, amount) {
  return (amountFormatters[symbol] ?? integerFormatter).format(amount);
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

function renderPriceSnapshotLabel() {
  if (!walletSnapshotEl) return;
  walletSnapshotEl.textContent = `${PRICE_SNAPSHOT_LABEL} · 1 pickup = 1 full coin`;
}

function getWalletTotalUsd(walletState = wallet) {
  return Object.entries(walletState).reduce((sum, [symbol, count]) => {
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
          <small>${config.label} · ${config.sizeClass}</small>
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

function renderWallet(walletState = wallet) {
  if (!walletListEl.children.length) {
    buildWalletDom();
  }

  for (const [symbol, config] of Object.entries(COIN_TYPES)) {
    const row = walletDomBySymbol[symbol];
    if (!row) continue;
    row.querySelector('[data-role="amount"]').textContent = formatCoinAmount(symbol, walletState[symbol]);
    row.querySelector('[data-role="usd"]').textContent = formatUsd(walletState[symbol] * config.usd);
  }

  walletTotalEl.textContent = formatUsd(getWalletTotalUsd(walletState));
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

    // --- LOW BASS THUMP ---
    const bass = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(140, now);
    bass.frequency.exponentialRampToValueAtTime(60, now + 0.12);

    bassGain.gain.setValueAtTime(0.0001, now);
    bassGain.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    bass.connect(bassGain);
    this.connectNode(bassGain);

    // --- LASER SNAP ---
    const laser = this.ctx.createOscillator();
    const laserGain = this.ctx.createGain();

    laser.type = 'square';
    laser.frequency.setValueAtTime(900, now);
    laser.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    laserGain.gain.setValueAtTime(0.0001, now);
    laserGain.gain.exponentialRampToValueAtTime(0.25, now + 0.005);
    laserGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    laser.connect(laserGain);
    this.connectNode(laserGain);

    // --- slight filter for punch ---
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);

    laserGain.connect(filter);
    filter.connect(this.masterGain);

    bass.start(now);
    bass.stop(now + 0.15);

    laser.start(now);
    laser.stop(now + 0.12);
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

  playShieldHit() {
    if (!this.ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    this.connectNode(gain);
    osc.start(now);
    osc.stop(now + 0.1);
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
    this.physics.world.resume();
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
      maxSize: 50,
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
    this.time.delayedCall(800, () => this.spawnCoinWave(3));
    this.coinSpawnEvent = this.time.addEvent({
      delay: 1800, // was 1200
      loop: true,
      callback: () => this.spawnCoinWave(Phaser.Math.Between(1, 3)) // was 2–4
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

    if (!this.textures.exists('bullet-core')) {
      const core = this.make.graphics({ x: 0, y: 0, add: false });
      core.fillStyle(0xc8fdff, 1);
      core.fillRoundedRect(10, 3, 28, 6, 3);
      core.generateTexture('bullet-core', 48, 12);
      core.destroy();
    }

    if (!this.textures.exists('bullet-glow')) {
      const glow = this.make.graphics({ x: 0, y: 0, add: false });
      glow.fillStyle(0x74f0ff, 0.25);
      glow.fillRoundedRect(4, 1, 40, 10, 5);
      glow.generateTexture('bullet-glow', 48, 12);
      glow.destroy();
    }
  }

  createStarfield() {
    const stars = this.add.graphics();
    for (let i = 0; i < 150; i += 1) {
      const alpha = Phaser.Math.FloatBetween(0.18, 0.68);
      const radius = Phaser.Math.FloatBetween(0.8, 2.2);
      stars.fillStyle(0xdce8ff, alpha);
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

    this.livesText = this.add.text(24, 52, 'Lives: 3', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#a3b8ff'
    }).setDepth(4);

    this.tipText = this.add.text(GAME_WIDTH - 24, 18, 'Collect coins, avoid collisions', {
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
    const rotationInput =
      (this.keys.left.isDown || this.keys.a.isDown ? -1 : 0) +
      (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0);

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

    if (
      Phaser.Input.Keyboard.JustDown(this.keys.space) ||
      (this.keys.space.isDown && time - this.lastShotAt > SHOOT_DELAY_MS)
    ) {
      this.fireBullet(time);
    }

    this.wrapObject(this.ship);

    this.bullets.children.iterate((bullet) => {
      if (!bullet?.active) return;

      if (
        bullet.x < -50 || bullet.x > GAME_WIDTH + 50 ||
        bullet.y < -50 || bullet.y > GAME_HEIGHT + 50
      ) {
        this.destroyBulletPair(bullet);
        return;
      }

      bullet.lifeMs -= delta;
      bullet.rotation = bullet.fireRotation;
      bullet.body.setVelocity(
        bullet.body.velocity.x * 1.001,
        bullet.body.velocity.y * 1.001
      );

      if (bullet.lifeMs <= 0) {
        bullet.destroy();
      }
    });

    this.coins.children.iterate((coin) => {
      if (!coin?.active) return;
      this.wrapObject(coin, 38);
      coin.rotation += coin.spinSpeed * dt;
      coin.damagePulse = Math.max(0, coin.damagePulse - dt * 4);
      this.updateCoinShieldVisual(coin);
    });

    const remaining = Math.max(0, (this.endTime - time) / 1000);
    this.timerText.setText(`Time: ${remaining.toFixed(1)}`);

    if (remaining <= 0) {
      this.endRun('Time is up!');
    }
  }

  fireBullet(time) {
    this.lastShotAt = time;

    const glow = this.bullets.get(this.ship.x, this.ship.y, 'bullet-glow');
    const core = this.bullets.get(this.ship.x, this.ship.y, 'bullet-core');
    if (!glow || !core) return;

    const bulletSpeed = 520;
    const inheritedVelocityX = this.ship.body.velocity.x * 0.45;
    const inheritedVelocityY = this.ship.body.velocity.y * 0.45;

    for (const bullet of [glow, core]) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.setDepth(3);
      bullet.body.reset(this.ship.x, this.ship.y);
      bullet.setCircle(4, 10, 2);
      bullet.fireRotation = this.ship.rotation;
      bullet.rotation = this.ship.rotation;
      this.physics.velocityFromRotation(this.ship.rotation, bulletSpeed, bullet.body.velocity);
      bullet.body.velocity.x += inheritedVelocityX;
      bullet.body.velocity.y += inheritedVelocityY;
      bullet.lifeMs = 800;
      bullet.setData('pairedBullet', bullet === glow ? core : glow);
    }

    this.emitMuzzleFlash();
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
    coin.shieldMax = config.shieldMax;
    coin.shield = config.shieldMax;
    coin.coreHp = 1;
    coin.spinSpeed = Phaser.Math.FloatBetween(-2.4, 2.4);
    coin.damagePulse = 0;
    coin.setScale(config.scale);
    coin.setCircle(28);
    coin.setBounce(1, 1);

    coin.setDepth(2);
    coin.shieldAura = this.add.circle(x, y, 38, config.ring, 0.04).setDepth(1.7);
    coin.shieldRing = this.add.graphics().setDepth(1.85);
    coin.coreRing = this.add.circle(x, y, 34, 0xffffff, 0).setDepth(1.8);
    coin.coreRing.setStrokeStyle(2, 0xffffff, 0.1);

    this.updateCoinShieldVisual(coin, true);

    const targetAngle =
      Phaser.Math.Angle.Between(x, y, this.ship.x, this.ship.y) +
      Phaser.Math.FloatBetween(-0.5, 0.5);
    this.physics.velocityFromRotation(
      targetAngle,
      config.speed + Phaser.Math.Between(-10, 20),
      coin.body.velocity
    );
  }

  updateCoinShieldVisual(coin, force = false) {
    if (!coin?.active && !force) return;

    const x = coin.x;
    const y = coin.y;
    const outerRadius = Math.max(coin.displayWidth, coin.displayHeight) * 0.5;
    const glowRadius = outerRadius + 3;
    const shieldPercent =
      coin.shieldMax > 0 ? Phaser.Math.Clamp(coin.shield / coin.shieldMax, 0, 1) : 0;
    const pulseAlpha = 0.18 + coin.damagePulse * 0.28;

    if (coin.shieldAura) {
      coin.shieldAura.x = x;
      coin.shieldAura.y = y;
      coin.shieldAura.setRadius(outerRadius + 2);
      coin.shieldAura.setFillStyle(
        coin.config.ring,
        shieldPercent > 0 ? 0.025 + pulseAlpha * 0.06 : 0.01
      );
      coin.shieldAura.setStrokeStyle(
        1,
        coin.config.ring,
        shieldPercent > 0 ? 0.08 + pulseAlpha * 0.08 : 0.03
      );
      coin.shieldAura.setScale(1 + coin.damagePulse * 0.05);
    }

    if (coin.coreRing) {
      coin.coreRing.x = x;
      coin.coreRing.y = y;
      coin.coreRing.setRadius(outerRadius - 6);
      coin.coreRing.setStrokeStyle(
        2,
        shieldPercent > 0 ? 0xffffff : coin.config.shieldColor,
        shieldPercent > 0 ? 0.08 : 0.22
      );
    }

    if (!coin.shieldRing) return;

    coin.shieldRing.clear();
    coin.shieldRing.lineStyle(2, coin.config.shieldColor, 0.08);
    coin.shieldRing.strokeCircle(x, y, outerRadius);

    if (shieldPercent > 0) {
      coin.shieldRing.lineStyle(8, coin.config.shieldColor, 0.38);
      coin.shieldRing.beginPath();
      coin.shieldRing.arc(
        x,
        y,
        outerRadius,
        -Math.PI / 2,
        (-Math.PI / 2) + (Math.PI * 2 * shieldPercent),
        false
      );
      coin.shieldRing.strokePath();

      coin.shieldRing.lineStyle(2, 0xffffff, 0.16);
      coin.shieldRing.beginPath();
      coin.shieldRing.arc(
        x,
        y,
        glowRadius,
        -Math.PI / 2,
        (-Math.PI / 2) + (Math.PI * 2 * shieldPercent),
        false
      );
      coin.shieldRing.strokePath();
    }
  }

  handleBulletCoinCollision(bullet, coin) {
    if (!bullet.active || !coin.active || this.gameEnded) return;

    this.destroyBulletPair(bullet);
    coin.damagePulse = 1;

    this.tweens.add({
      targets: coin,
      x: coin.x + Phaser.Math.Between(-4, 4),
      y: coin.y + Phaser.Math.Between(-4, 4),
      duration: 40,
      yoyo: true,
      repeat: 2
    });

    this.tweens.add({
      targets: coin,
      scale: coin.scale * 1.08,
      duration: 60,
      yoyo: true
    });

    if (coin.shield > 0) {
      coin.shield -= 1;
      this.soundSynth.playShieldHit();
      this.coinFlash(coin.x, coin.y, coin.config.shieldColor, 8);
      this.updateCoinShieldVisual(coin, true);
      return;
    }

    coin.coreHp -= 1;
    this.soundSynth.playCoinHit(coin.coreHp <= 0);
    this.coinFlash(coin.x, coin.y, coin.config.ring, 10);

    if (coin.coreHp <= 0) {
      wallet[coin.symbol] += coin.config.amount;
      this.coinsCollected += 1;
      renderWallet();
      flashWalletCard(coin.symbol);
      this.coinFlash(coin.x, coin.y, coin.config.ring, 20);
      coin.shieldAura?.destroy();
      coin.shieldRing?.destroy();
      coin.coreRing?.destroy();
      coin.destroy();
    }
  }

  destroyBulletPair(bullet) {
    if (!bullet || !bullet.active) return;
    const pairedBullet = bullet.getData('pairedBullet');
    bullet.destroy();
    if (pairedBullet?.active) {
      pairedBullet.destroy();
    }
  }

  handleShipCoinCollision(ship, coin) {
    if (this.gameEnded || !coin.active) return;

    coin.shieldAura?.destroy();
    coin.shieldRing?.destroy();
    coin.coreRing?.destroy();
    coin.destroy();
    this.shipLives -= 1;
    this.livesText.setText(`Lives: ${this.shipLives}`);
    this.cameras.main.shake(150, 0.008);
    this.coinFlash(ship.x, ship.y, 0xff5577, 16);
    this.soundSynth.playPlayerHit();

    if (this.shipLives <= 0) {
      this.endRun('Lives breach!');
    }
  }

  emitMuzzleFlash() {
    const x = this.ship.x + Math.cos(this.ship.rotation) * 20;
    const y = this.ship.y + Math.sin(this.ship.rotation) * 20;
    const flash = this.add.circle(x, y, 10, 0x9ffcff, 0.85).setDepth(3.4);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: 90,
      onComplete: () => flash.destroy()
    });
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

    if (gameObject.shieldAura) {
      gameObject.shieldAura.x = gameObject.x;
      gameObject.shieldAura.y = gameObject.y;
    }

    if (gameObject.shieldRing || gameObject.coreRing) {
      this.updateCoinShieldVisual(gameObject, true);
    }
  }

  endRun(reason) {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.physics.world.pause();
    this.ship.setAcceleration(0, 0);
    this.ship.setAngularVelocity(0);
    this.ship.setVelocity(0, 0);
    this.coinSpawnEvent?.remove(false);

    this.coins.children.iterate((coin) => {
      if (!coin?.active) return;
      coin.shieldAura?.destroy();
      coin.shieldRing?.destroy();
      coin.coreRing?.destroy();
    });

    this.bullets.children.iterate((bullet) => {
      if (!bullet?.active) return;
      bullet.destroy();
    });

    const walletSnapshot = { ...wallet };
    renderWallet(walletSnapshot);

    const totalUsd = getWalletTotalUsd(walletSnapshot);
    const topRun = maybeUpdateTopRun(totalUsd);
    renderTopRun();
    const survivedSeconds = (
      (ROUND_DURATION_MS - Math.max(0, this.endTime - this.time.now)) / 1000
    ).toFixed(1);

    modalTitleEl.textContent = reason === 'Time is up!' ? 'Wallet secured 🎉' : 'Run over 💥';
    modalSummaryEl.textContent =
      `${reason} You survived ${survivedSeconds} seconds and captured ${this.coinsCollected} coins ` +
      `worth ${formatUsd(totalUsd)}. Top run: ${formatUsd(topRun)}.`;

    modalBreakdownEl.innerHTML = Object.entries(COIN_TYPES)
      .map(([symbol, config]) => {
        const count = walletSnapshot[symbol];
        return `
          <div class="breakdown-row">
            <span>${symbol} · ${config.label}</span>
            <strong>${formatCoinAmount(symbol, count)} · ${formatUsd(count * config.usd)}</strong>
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

renderPriceSnapshotLabel();
renderWallet();
renderTopRun();
