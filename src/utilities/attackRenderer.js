import { Application, Graphics, Sprite, Texture } from 'pixi.js';

const colors = {
  fire: 0xff792a,
  lightning: 0x7ecaff,
  acid: 0x9aef49,
  orb: 0x58bfff,
};
const random = (min, max) => min + Math.random() * (max - min);

// A single soft texture is shared by a bounded sprite pool; no external art or
// per-frame filters/downloads. Coordinates follow the actual responsive portraits.
export async function createAttackRenderer(host) {
  const app = new Application();
  await app.init({
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    preference: 'webgl',
    powerPreference: 'low-power',
    autoStart: false,
  });
  host.appendChild(app.canvas);
  const source = document.createElement('canvas');
  source.width = source.height = 64;
  const ctx = source.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffffffff');
  gradient.addColorStop(0.18, '#ffffffee');
  gradient.addColorStop(0.48, '#ffffff66');
  gradient.addColorStop(1, '#ffffff00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = Texture.from(source);
  const cap = host.clientWidth < 500 ? 90 : 160;
  const particles = Array.from({ length: cap }, () => {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    sprite.visible = false;
    app.stage.addChild(sprite);
    return { sprite, life: 0 };
  });
  const halo = new Sprite(texture);
  const core = new Sprite(texture);
  for (const sprite of [halo, core]) {
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    sprite.visible = false;
    app.stage.addChild(sprite);
  }
  const lines = new Graphics();
  app.stage.addChild(lines);
  let currentSide;
  let phase = 'idle',
    kind = 'fire',
    age = 0,
    emission = 0;
  let start = { x: 0, y: 0 },
    end = { x: 0, y: 0 },
    direction = 1;
  let scale = 1;
  function anchors(side) {
    const bounds = host.getBoundingClientRect();
    app.renderer.resize(Math.max(1, bounds.width), Math.max(1, bounds.height));
    scale = Math.min(1, bounds.width / 700);
    const point = (key, launch) => {
      const rect = host.parentElement
        .querySelector(`.fighter.${key} .portrait-button`)
        .getBoundingClientRect();
      return {
        x:
          rect.left -
          bounds.left +
          rect.width * (launch ? (key === 'left' ? 0.78 : 0.22) : 0.5),
        y: rect.top - bounds.top + rect.height * 0.53,
      };
    };
    start = point(side, true);
    end = point(side === 'left' ? 'right' : 'left', false);
    direction = side === 'left' ? 1 : -1;
  }
  function spawn(x, y, burst = false) {
    const p = particles.find((p) => p.life <= 0);
    if (!p) return;
    const angle = random(0, Math.PI * 2);
    const speed = random(45, burst ? 290 : 110) * scale;
    p.life = p.total = random(0.25, kind === 'acid' ? 0.9 : 0.65);
    p.vx = burst ? Math.cos(angle) * speed : -direction * speed;
    p.vy = burst ? Math.sin(angle) * speed : random(-65, 65) * scale;
    p.gravity = (kind === 'acid' ? 340 : kind === 'fire' ? -100 : 0) * scale;
    p.size =
      random(kind === 'fire' ? 16 : 7, kind === 'fire' ? 42 : 22) * scale;
    p.sprite.position.set(x + random(-5, 5) * scale, y + random(-6, 6) * scale);
    p.sprite.tint = Math.random() < 0.2 ? 0xfff5d9 : colors[kind];
    p.sprite.visible = true;
    p.sprite.blendMode = kind === 'acid' ? 'normal' : 'add';
  }
  function glow(x, y, radius, alpha = 1) {
    for (const sprite of [halo, core]) {
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.alpha = alpha;
    }
    halo.tint = colors[kind];
    halo.width = halo.height = radius * 4;
    core.tint = kind === 'fire' ? 0xffdf9b : 0xf2fcff;
    core.width = core.height = radius * 1.2;
  }
  function bolt(a, b, strength = 1) {
    const points = [a];
    for (let i = 1; i < 14; i++)
      points.push({
        x: a.x + ((b.x - a.x) * i) / 14,
        y: a.y + ((b.y - a.y) * i) / 14 + random(-20, 20) * scale,
      });
    points.push(b);
    for (const [width, alpha, color] of [
      [12, 0.12, colors.lightning],
      [5, 0.4, colors.lightning],
      [1.5, 0.95, 0xeafaff],
    ]) {
      lines.moveTo(a.x, a.y);
      points.slice(1).forEach((p) => lines.lineTo(p.x, p.y));
      lines.stroke({ width: width * scale, color, alpha: alpha * strength });
    }
    for (let i = 3; i < 12; i += 4) {
      const p = points[i];
      lines
        .moveTo(p.x, p.y)
        .lineTo(p.x + direction * 12 * scale, p.y - 25 * scale)
        .lineTo(p.x + direction * 30 * scale, p.y - 35 * scale)
        .stroke({
          width: scale,
          color: colors.lightning,
          alpha: 0.65 * strength,
        });
    }
  }
  function clear() {
    app.stop();
    particles.forEach((p) => {
      p.life = 0;
      p.sprite.visible = false;
    });
    lines.clear();
    halo.visible = core.visible = false;
    app.render();
  }
  app.ticker.maxFPS = 60;
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.04);
    age += dt;
    lines.clear();
    halo.visible = core.visible = false;
    const travel = phase === 'travel' || (phase === 'finish' && age < 0.35);
    const progress = Math.min(1, age / (phase === 'finish' ? 0.35 : 0.25));
    const x = travel ? start.x + (end.x - start.x) * progress : end.x;
    const y = travel ? start.y + (end.y - start.y) * progress : end.y;
    if (phase === 'windup')
      glow(start.x, start.y, (12 + age * 90) * scale, 0.6);
    if (travel) {
      emission += dt * 170;
      while (emission >= 1) {
        spawn(x, y);
        emission--;
      }
      if (kind === 'lightning') bolt(start, { x, y });
      else {
        glow(x, y, (kind === 'orb' ? 29 : 21) * scale);
        if (kind === 'orb') {
          lines
            .ellipse(x, y, 30 * scale, 13 * scale)
            .stroke({ width: 2 * scale, color: 0xc7f0ff, alpha: 0.85 });
        }
      }
    }
    if (phase === 'impact' || phase === 'finish') {
      const t = phase === 'finish' ? Math.max(0, age - 0.35) : age;
      if (!travel && t < (phase === 'finish' ? 1.6 : 0.32)) {
        emission += dt * 140;
        while (emission >= 1) {
          spawn(end.x, end.y, true);
          emission--;
        }
        const fade = Math.max(0, 1 - t / (phase === 'finish' ? 1.9 : 0.5));
        glow(end.x, end.y, (45 + t * 35) * scale, fade);
        if (kind === 'lightning') {
          bolt(
            { x: end.x - 55 * scale, y: end.y - 95 * scale },
            { x: end.x + 20 * scale, y: end.y + 85 * scale },
            fade
          );
        }
        if (kind === 'orb') {
          lines
            .circle(end.x, end.y, (25 + t * 190) * scale)
            .stroke({ width: 3 * scale, color: 0xa8e6ff, alpha: fade });
        }
      }
    }
    let alive = false;
    particles.forEach((p) => {
      if (p.life <= 0) return;
      p.life -= dt;
      p.sprite.visible = p.life > 0;
      if (p.life <= 0) return;
      alive = true;
      p.vy += p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.alpha = Math.min(1, (p.life / p.total) * 1.4);
      p.sprite.width = p.size * (0.4 + p.life / p.total);
      p.sprite.height = p.sprite.width * (kind === 'acid' ? 1.5 : 1);
    });
    if ((phase === 'recover' && !alive) || age > 2.5) clear();
  });
  // Fonts and portraits can settle after initialization on a narrow viewport.
  // Re-anchor an active effect without dropping it when the layout settles.
  const observer = new ResizeObserver(() => {
    if (currentSide && phase !== 'idle') {
      anchors(currentSide);
      particles.forEach((p) => {
        p.life = 0;
        p.sprite.visible = false;
      });
    } else clear();
  });
  observer.observe(host);
  return {
    setPhase(next, attack, side) {
      if (next === 'idle' || !side) {
        phase = 'idle';
        clear();
        return;
      }
      if (next === 'windup' || next === 'finish') clear();
      currentSide = side;
      anchors(side);
      phase = next;
      kind = colors[attack] ? attack : 'fire';
      age = 0;
      emission = 0;
      app.start();
    },
    destroy() {
      observer.disconnect();
      app.destroy(true, { children: true });
      texture.destroy(true);
    },
  };
}
