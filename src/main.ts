import Phaser from 'phaser';
import './style.css';
import btcUrl from './assets/coins/btc.svg';
import ethUrl from './assets/coins/eth.svg';
import solUrl from './assets/coins/sol.svg';
import dogeUrl from './assets/coins/doge.svg';
import xrpUrl from './assets/coins/xrp.svg';

const GAME_WIDTH = 1100;
const GAME_HEIGHT = 700;
const ROUND_DURATION_MS = 60_000;
const SHOOT_DELAY_MS = 180;
const MAX_SPEED = 360;
const DRAG = 0.992;
const BRAKE_DRAG = 0.965;

const MASTER_VOLUME = 0.8;
const COIN_VOLUME = 0.45;
const COIN_FINAL_VOLUME = 0.6;
const HIT_VOLUME = 0.7;
const SHIELD_COLOR = 0x7c8cff;

const PRICE_SNAPSHOT_LABEL = 'Prices 4/16/26';
const TOP_RUN_STORAGE_KEY = 'coinroidsTopRun_priceSnapshot_v1';

const COIN_SCALES = {
  XXL: 1.28,
  XL: 1.14,
  L: 1.0,
  M: 0.88,
  S: 0.78
} as const;

type CoinSizeClass = keyof typeof COIN_SCALES;

type CoinSymbol = 'BTC' | 'ETH' | 'SOL' | 'XRP' | 'DOGE';
type WalletState = Record<CoinSymbol, number>;

type OverlapObject =
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Tilemaps.Tile;

interface CoinConfig {
  label: string;
  amount: number;
  usd: number;
  sizeClass: CoinSizeClass;
  scale: number;
  shieldMax: number;
  speed: number;
  spawnWeight: number;
  assetUrl: string;
  ring: number;
  shieldColor: number;
}

interface Controls {
  up: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  shift: Phaser.Input.Keyboard.Key;
}

interface WrappableObject {
  x: number;
  y: number;
  active?: boolean;
  shieldAura?: Phaser.GameObjects.Arc;
  shieldRing?: Phaser.GameObjects.Graphics;
  coreRing?: Phaser.GameObjects.Arc;
}

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

const amountFormatters: Record<CoinSymbol, Intl.NumberFormat> = {
  BTC: integerFormatter,
  ETH: integerFormatter,
  SOL: integerFormatter,
  DOGE: integerFormatter,
  XRP: integerFormatter
};

const COIN_TYPES: Record<CoinSymbol, CoinConfig> = {
  BTC: {
    label: 'Bitcoin',
    amount: 1,
    usd: 74_928.79,
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
    usd: 2_350.53,
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

const COIN_SYMBOLS = Object.keys(COIN_TYPES) as CoinSymbol[];

const wallet: WalletState = {
  BTC: 0,
  ETH: 0,
  SOL: 0,
  XRP: 0,
  DOGE: 0
};

const walletDomBySymbol: Partial<Record<CoinSymbol, HTMLLIElement>> = {};

function requireElementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
}

const walletListEl = requireElementById<HTMLUListElement>('wallet-list');
const walletTotalEl = requireElementById<HTMLElement>('wallet-total');
const topRunEl = requireElementById<HTMLElement>('top-run');
const overlayEl = requireElementById<HTMLDivElement>('overlay');
const modalTitleEl = requireElementById<HTMLElement>('modal-title');
const modalSummaryEl = requireElementById<HTMLElement>('modal-summary');
const modalBreakdownEl = requireElementById<HTMLDivElement>('modal-breakdown');
const playAgainButtonEl = requireElementById<HTMLButtonElement>('play-again-button');
const walletSnapshotEl = requireElementById<HTMLElement>('wallet-snapshot');

function formatCoinAmount(symbol: CoinSymbol, amount: number): string {
  return (amountFormatters[symbol] ?? integerFormatter).format(amount);
}

function formatUsd(value: number): string {
  return usdFormatter.format(value);
}

function getTopRun(): number {
  try {
    const raw = localStorage.getItem(TOP_RUN_STORAGE_KEY);
    if (!raw) {
      return 0;
    }

    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function setTopRun(value: number): void {
  localStorage.setItem(TOP_RUN_STORAGE_KEY, JSON.stringify(value));
}

function maybeUpdateTopRun(value: number): number {
  const currentTopRun = getTopRun();
  if (value > currentTopRun) {
    setTopRun(value);
    return value;
  }
  return currentTopRun;
}

function renderTopRun(): void {
  topRunEl.textContent = formatUsd(getTopRun());
}

function renderPriceSnapshotLabel(): void {
  walletSnapshotEl.textContent = `${PRICE_SNAPSHOT_LABEL} · 1 pickup = 1 full coin`;
}

function getWalletTotalUsd(walletState: WalletState = wallet): number {
  return COIN_SYMBOLS.reduce((sum, symbol) => sum + walletState[symbol] * COIN_TYPES[symbol].usd, 0);
}

function buildWalletDom(): void {
  walletListEl.innerHTML = '';

  for (const symbol of COIN_SYMBOLS) {
    const config = COIN_TYPES[symbol];
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

function flashWalletCard(symbol: CoinSymbol): void {
  const el = walletDomBySymbol[symbol];
  if (!el) {
    return;
  }
  el.classList.remove('wallet-flash');
  void el.offsetWidth;
  el.classList.add('wallet-flash');
}

function renderWallet(walletState: WalletState = wallet): void {
  if (walletListEl.children.length === 0) {
    buildWalletDom();
  }

  for (const symbol of COIN_SYMBOLS) {
    const config = COIN_TYPES[symbol];
    const row = walletDomBySymbol[symbol];
    if (!row) {
      continue;
    }

    const amountEl = row.querySelector<HTMLElement>('[data-role="amount"]');
    const usdEl = row.querySelector<HTMLElement>('[data-role="usd"]');

    if (amountEl) {
      amountEl.textContent = formatCoinAmount(symbol, walletState[symbol]);
    }

    if (usdEl) {
      usdEl.textContent = formatUsd(walletState[symbol] * config.usd);
    }
  }

  walletTotalEl.textContent = formatUsd(getWalletTotalUsd(walletState));
}

function resetWallet(): void {
  for (const symbol of COIN_SYMBOLS) {
    wallet[symbol] = 0;
  }
  renderWallet();
}

function weightedCoinPick(): [CoinSymbol, CoinConfig] {
  const entries: Array<[CoinSymbol, CoinConfig]> = COIN_SYMBOLS.map((symbol) => [symbol, COIN_TYPES[symbol]]);
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

class BulletSprite extends Phaser.Physics.Arcade.Image {
  fireRotation = 0;
  lifeMs = 0;
}

class CoinSprite extends Phaser.Physics.Arcade.Image implements WrappableObject {
  symbol!: CoinSymbol;
  config!: CoinConfig;
  shieldMax = 0;
  shield = 0;
  coreHp = 1;
  spinSpeed = 0;
  damagePulse = 0;
  shieldAura?: Phaser.GameObjects.Arc;
  shieldRing?: Phaser.GameObjects.Graphics;
  coreRing?: Phaser.GameObjects.Arc;
}

class SoundSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = false;

  public ensureReady(): boolean {
    if (this.enabled && this.ctx && this.masterGain) {
      return true;
    }

    const BaseAudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!BaseAudioContext) {
      return false;
    }

    this.ctx ??= new BaseAudioContext();
    this.masterGain ??= this.ctx.createGain();
    this.masterGain.gain.value = MASTER_VOLUME;

    if (this.masterGain.numberOfOutputs > 0) {
      this.masterGain.disconnect();
    }
    this.masterGain.connect(this.ctx.destination);

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.enabled = true;
    return true;
  }

  private get audio(): { ctx: AudioContext; masterGain: GainNode } | null {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) {
      return null;
    }
    return { ctx: this.ctx, masterGain: this.masterGain };
  }

  private connectNode(node: AudioNode): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }
    node.connect(audio.masterGain);
  }

  public playShoot(): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }

    const { ctx, masterGain } = audio;
    const now = ctx.currentTime;

    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(140, now);
    bass.frequency.exponentialRampToValueAtTime(60, now + 0.12);

    bassGain.gain.setValueAtTime(0.0001, now);
    bassGain.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    bass.connect(bassGain);
    bassGain.connect(masterGain);

    const laser = ctx.createOscillator();
    const laserGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    laser.type = 'square';
    laser.frequency.setValueAtTime(900, now);
    laser.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    laserGain.gain.setValueAtTime(0.0001, now);
    laserGain.gain.exponentialRampToValueAtTime(0.25, now + 0.005);
    laserGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);

    laser.connect(laserGain);
    laserGain.connect(filter);
    filter.connect(masterGain);

    bass.start(now);
    bass.stop(now + 0.15);
    laser.start(now);
    laser.stop(now + 0.12);
  }

  public playCoinHit(isFinal = false): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }

    const { ctx } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isFinal ? 460 : 320, now);
    osc.frequency.exponentialRampToValueAtTime(isFinal ? 920 : 520, now + 0.09);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(isFinal ? COIN_FINAL_VOLUME : COIN_VOLUME, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    this.connectNode(gain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playShieldHit(): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }

    const { ctx } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

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

  public playPlayerHit(): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }

    const { ctx } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

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
  private lastShotAt = 0;
  private gameEnded = false;
  private coinSpawnEvent: Phaser.Time.TimerEvent | null = null;
  private endTime = 0;
  private coinsCollected = 0;
  private shipLives = 3;
  private soundSynth = new SoundSynth();

  private ship!: Phaser.Physics.Arcade.Image;
  private bullets!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private keys!: Controls;
  private timerText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private tipText!: Phaser.GameObjects.Text;

  public constructor() {
    super('coinroids');
  }

  public preload(): void {
    this.createTextures();

    for (const symbol of COIN_SYMBOLS) {
      this.load.image(`coin-${symbol}`, COIN_TYPES[symbol].assetUrl);
    }
  }

  public create(): void {
    this.gameEnded = false;
    this.lastShotAt = 0;
    this.coinsCollected = 0;
    this.shipLives = 3;

    this.physics.world.resume();
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

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
      classType: BulletSprite,
      maxSize: 50,
      runChildUpdate: false
    });

    this.coins = this.physics.add.group({
      classType: CoinSprite,
      runChildUpdate: false
    });

    this.physics.add.overlap(this.bullets, this.coins, this.handleBulletCoinCollision, undefined, this);
    this.physics.add.overlap(this.ship, this.coins, this.handleShipCoinCollision, undefined, this);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available for Coinroids.');
    }

    this.keys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT
    }) as Controls;

    this.input.once('pointerdown', () => this.soundSynth.ensureReady());
    keyboard.once('keydown', () => this.soundSynth.ensureReady());

    this.createHud();
    this.time.delayedCall(800, () => this.spawnCoinWave(3));
    this.coinSpawnEvent = this.time.addEvent({
      delay: 1800,
      loop: true,
      callback: () => this.spawnCoinWave(Phaser.Math.Between(1, 3))
    });

    this.endTime = this.time.now + ROUND_DURATION_MS;
    resetWallet();
    this.hideOverlay();
  }

  public update(time: number, delta: number): void {
    if (this.gameEnded) {
      return;
    }

    const dt = delta / 1000;
    const turnSpeed = 210;
    const thrustPower = 210;
    const shipBody = this.ship.body as Phaser.Physics.Arcade.Body;
    const rotationInput =
      (this.keys.left.isDown || this.keys.a.isDown ? -1 : 0) +
      (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0);

    this.ship.setAngularVelocity(rotationInput * turnSpeed);

    if (this.keys.up.isDown || this.keys.w.isDown) {
      this.physics.velocityFromRotation(this.ship.rotation, thrustPower, shipBody.acceleration);
      this.emitThruster();
    } else {
      this.ship.setAcceleration(0, 0);
    }

    shipBody.velocity.scale(this.keys.shift.isDown ? BRAKE_DRAG : DRAG);
    shipBody.velocity.limit(MAX_SPEED);

    if (
      Phaser.Input.Keyboard.JustDown(this.keys.space) ||
      (this.keys.space.isDown && time - this.lastShotAt > SHOOT_DELAY_MS)
    ) {
      this.fireBullet(time);
    }

    this.wrapObject(this.ship);

    for (const child of this.bullets.getChildren()) {
      const bullet = child as BulletSprite | null;
      if (!bullet?.active) {
        continue;
      }

      if (
        bullet.x < -50 ||
        bullet.x > GAME_WIDTH + 50 ||
        bullet.y < -50 ||
        bullet.y > GAME_HEIGHT + 50
      ) {
        this.destroyBulletPair(bullet);
        continue;
      }

      bullet.lifeMs -= delta;
      bullet.rotation = bullet.fireRotation;

      const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;
      bulletBody.setVelocity(bulletBody.velocity.x * 1.001, bulletBody.velocity.y * 1.001);

      if (bullet.lifeMs <= 0) {
        bullet.destroy();
      }
    }

    for (const child of this.coins.getChildren()) {
      const coin = child as CoinSprite | null;
      if (!coin?.active) {
        continue;
      }
      this.wrapObject(coin, 38);
      coin.rotation += coin.spinSpeed * dt;
      coin.damagePulse = Math.max(0, coin.damagePulse - dt * 4);
      this.updateCoinShieldVisual(coin);
    }

    const remaining = Math.max(0, (this.endTime - time) / 1000);
    this.timerText.setText(`Time: ${remaining.toFixed(1)}`);

    if (remaining <= 0) {
      this.endRun('Time is up!');
    }
  }

  public restartRun(): void {
    this.scene.restart();
  }

  private createTextures(): void {
    if (!this.textures.exists('ship')) {
      const ship = this.make.graphics({ x: 0, y: 0 }, false);
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
      const core = this.make.graphics({ x: 0, y: 0 }, false);
      core.fillStyle(0xc8fdff, 1);
      core.fillRoundedRect(10, 3, 28, 6, 3);
      core.generateTexture('bullet-core', 48, 12);
      core.destroy();
    }

    if (!this.textures.exists('bullet-glow')) {
      const glow = this.make.graphics({ x: 0, y: 0 }, false);
      glow.fillStyle(0x74f0ff, 0.25);
      glow.fillRoundedRect(4, 1, 40, 10, 5);
      glow.generateTexture('bullet-glow', 48, 12);
      glow.destroy();
    }
  }

  private createStarfield(): void {
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

  private createHud(): void {
    this.timerText = this.add
      .text(24, 18, 'Time: 60.0', {
        fontFamily: 'Arial',
        fontSize: '26px',
        color: '#e8eeff'
      })
      .setDepth(4);

    this.livesText = this.add
      .text(24, 52, 'Lives: 3', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#a3b8ff'
      })
      .setDepth(4);

    /* (optional text on top right)
    this.tipText = this.add
      .text(GAME_WIDTH - 24, 18, 'Collect coins, avoid collisions', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#d7e3ff'
      })
      .setOrigin(1, 0)
      .setDepth(4);
    */
  }
      

  private fireBullet(time: number): void {
    this.lastShotAt = time;

    const glow = this.bullets.get(this.ship.x, this.ship.y, 'bullet-glow') as BulletSprite | null;
    const core = this.bullets.get(this.ship.x, this.ship.y, 'bullet-core') as BulletSprite | null;
    if (!glow || !core) {
      return;
    }

    const bulletSpeed = 520;
    const shipBody = this.ship.body as Phaser.Physics.Arcade.Body;
    const inheritedVelocityX = shipBody.velocity.x * 0.45;
    const inheritedVelocityY = shipBody.velocity.y * 0.45;

    for (const bullet of [glow, core]) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.setDepth(3);
      (bullet.body as Phaser.Physics.Arcade.Body).reset(this.ship.x, this.ship.y);
      bullet.setCircle(4, 10, 2);
      bullet.fireRotation = this.ship.rotation;
      bullet.rotation = this.ship.rotation;

      const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;
      this.physics.velocityFromRotation(this.ship.rotation, bulletSpeed, bulletBody.velocity);
      bulletBody.velocity.x += inheritedVelocityX;
      bulletBody.velocity.y += inheritedVelocityY;
      bullet.lifeMs = 800;
      bullet.setData('pairedBullet', bullet === glow ? core : glow);
    }

    this.emitMuzzleFlash();
    this.soundSynth.playShoot();
  }

  private spawnCoinWave(count: number): void {
    for (let i = 0; i < count; i += 1) {
      this.spawnCoin();
    }
  }

  private spawnCoin(): void {
    const [symbol, config] = weightedCoinPick();
    const spawnFromHorizontal = Math.random() > 0.5;
    let x: number;
    let y: number;

    if (spawnFromHorizontal) {
      x = Math.random() > 0.5 ? -50 : GAME_WIDTH + 50;
      y = Phaser.Math.Between(20, GAME_HEIGHT - 20);
    } else {
      x = Phaser.Math.Between(20, GAME_WIDTH - 20);
      y = Math.random() > 0.5 ? -50 : GAME_HEIGHT + 50;
    }

    const coin = this.coins.get(x, y, `coin-${symbol}`) as CoinSprite | null;
    if (!coin) {
      return;
    }

    coin.setActive(true);
    coin.setVisible(true);
    const coinBody = coin.body as Phaser.Physics.Arcade.Body;
    coinBody.reset(x, y);

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

    coin.shieldAura?.destroy();
    coin.shieldRing?.destroy();
    coin.coreRing?.destroy();

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
      coinBody.velocity
    );
  }

  private updateCoinShieldVisual(coin: CoinSprite, force = false): void {
    if (!coin.active && !force) {
      return;
    }

    const x = coin.x;
    const y = coin.y;
    const outerRadius = Math.max(coin.displayWidth, coin.displayHeight) * 0.5;
    const glowRadius = outerRadius + 3;
    const shieldPercent = coin.shieldMax > 0 ? Phaser.Math.Clamp(coin.shield / coin.shieldMax, 0, 1) : 0;
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

    if (!coin.shieldRing) {
      return;
    }

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
        -Math.PI / 2 + Math.PI * 2 * shieldPercent,
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
        -Math.PI / 2 + Math.PI * 2 * shieldPercent,
        false
      );
      coin.shieldRing.strokePath();
    }
  }

  private handleBulletCoinCollision(bulletObject: OverlapObject, coinObject: OverlapObject): void {
    const bullet = bulletObject as BulletSprite;
    const coin = coinObject as CoinSprite;

    if (!bullet.active || !coin.active || this.gameEnded) {
      return;
    }

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

  private destroyBulletPair(bullet: BulletSprite | null): void {
    if (!bullet?.active) {
      return;
    }
    const pairedBullet = bullet.getData('pairedBullet') as BulletSprite | undefined;
    bullet.destroy();
    if (pairedBullet?.active) {
      pairedBullet.destroy();
    }
  }

  private handleShipCoinCollision(
    shipGameObject: OverlapObject,
    coinGameObject: OverlapObject
  ): void {
    const ship = shipGameObject as Phaser.Physics.Arcade.Image;
    const coin = coinGameObject as CoinSprite;

    if (this.gameEnded || !coin.active) {
      return;
    }

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

  private emitMuzzleFlash(): void {
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

  private emitThruster(): void {
    if (Math.random() > 0.35) {
      return;
    }

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

  private coinFlash(x: number, y: number, color: number, count: number): void {
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

  private wrapObject(gameObject: WrappableObject, padding = 24): void {
    if (gameObject.x < -padding) {
      gameObject.x = GAME_WIDTH + padding;
    } else if (gameObject.x > GAME_WIDTH + padding) {
      gameObject.x = -padding;
    }

    if (gameObject.y < -padding) {
      gameObject.y = GAME_HEIGHT + padding;
    } else if (gameObject.y > GAME_HEIGHT + padding) {
      gameObject.y = -padding;
    }

    if (gameObject.shieldAura) {
      gameObject.shieldAura.x = gameObject.x;
      gameObject.shieldAura.y = gameObject.y;
    }

    if (gameObject instanceof CoinSprite && (gameObject.shieldRing || gameObject.coreRing)) {
      this.updateCoinShieldVisual(gameObject, true);
    }
  }

  private endRun(reason: string): void {
    if (this.gameEnded) {
      return;
    }

    this.gameEnded = true;
    this.physics.world.pause();
    this.ship.setAcceleration(0, 0);
    this.ship.setAngularVelocity(0);
    this.ship.setVelocity(0, 0);
    this.coinSpawnEvent?.remove(false);

    for (const child of this.coins.getChildren()) {
      const coin = child as CoinSprite | null;
      if (!coin?.active) {
        continue;
      }
      coin.shieldAura?.destroy();
      coin.shieldRing?.destroy();
      coin.coreRing?.destroy();
    }

    for (const child of this.bullets.getChildren()) {
      const bullet = child as BulletSprite | null;
      if (!bullet?.active) {
        continue;
      }
      bullet.destroy();
    }

    const walletSnapshot: WalletState = { ...wallet };
    renderWallet(walletSnapshot);

    const totalUsd = getWalletTotalUsd(walletSnapshot);
    const topRun = maybeUpdateTopRun(totalUsd);
    renderTopRun();
    const survivedSeconds = ((ROUND_DURATION_MS - Math.max(0, this.endTime - this.time.now)) / 1000).toFixed(1);

    modalTitleEl.textContent = reason === 'Time is up!' ? 'Wallet secured 🎉' : 'Run over 💥';
    modalSummaryEl.textContent =
      `${reason} You survived ${survivedSeconds} seconds and captured ${this.coinsCollected} coins ` +
      `worth ${formatUsd(totalUsd)}. Top run: ${formatUsd(topRun)}.`;

    modalBreakdownEl.innerHTML = COIN_SYMBOLS.map((symbol) => {
      const config = COIN_TYPES[symbol];
      const count = walletSnapshot[symbol];
      return `
        <div class="breakdown-row">
          <span>${symbol} · ${config.label}</span>
          <strong>${formatCoinAmount(symbol, count)} · ${formatUsd(count * config.usd)}</strong>
        </div>
      `;
    }).join('');

    this.showOverlay();
  }

  private showOverlay(): void {
    overlayEl.classList.remove('hidden');
    overlayEl.setAttribute('aria-hidden', 'false');
  }

  private hideOverlay(): void {
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

function restartGame(): void {
  const scene = game.scene.getScene('coinroids') as CoinroidsScene;
  scene.restartRun();
}

playAgainButtonEl.addEventListener('click', restartGame);

renderPriceSnapshotLabel();
renderWallet();
renderTopRun();
