import './style.css';

// --- Interactive Title Logic ---
interface IState {
  count: number;
  stage1Timeout: number | undefined;
  stage2Timeout: number | undefined;
  isGold: boolean;
  lockedUntil: number;
  element: HTMLSpanElement;
}

const mightyState: IState = {
  count: 0,
  stage1Timeout: undefined,
  stage2Timeout: undefined,
  isGold: false,
  lockedUntil: 0,
  element: document.getElementById('mighty-i') as HTMLSpanElement
};

const atriaState: IState = {
  count: 0,
  stage1Timeout: undefined,
  stage2Timeout: undefined,
  isGold: false,
  lockedUntil: 0,
  element: document.getElementById('atria-i') as HTMLSpanElement
};

const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;

const clearTimeouts = (state: IState) => {
  if (state.stage1Timeout) clearTimeout(state.stage1Timeout);
  if (state.stage2Timeout) clearTimeout(state.stage2Timeout);
  state.stage1Timeout = undefined;
  state.stage2Timeout = undefined;
};

const updateTextSmoothly = (element: HTMLSpanElement, newText: string) => {
  if (element.innerText === newText) return;

  const prevWidth = element.offsetWidth;
  element.style.transition = 'none';
  element.style.width = prevWidth + 'px';

  element.innerText = newText;
  
  element.style.width = 'auto';
  const newWidth = element.offsetWidth;

  element.style.width = prevWidth + 'px';
  void element.offsetWidth; // Force reflow

  element.style.transition = '';
  element.style.width = newWidth + 'px';

  setTimeout(() => {
    if (element.style.width === newWidth + 'px') {
      element.style.width = '';
    }
  }, 150);
};

const handleClick = (state: IState) => {
  if (!state.element) return;
  const now = Date.now();
  if (now < state.lockedUntil) return;
  
  clearTimeouts(state);
  
  if (state.count === 0) {
    state.count = 1;
  } else {
    state.count += 1;
  }
  
  updateTextSmoothly(state.element, state.count.toString());
  state.element.classList.remove('inflating');
  
  if (state.count >= 100) {
    if (!state.isGold) {
      state.isGold = true;
      state.lockedUntil = now + 600; // 0.6s unclickable
      state.element.classList.add('gold');
      
      const rect = state.element.getBoundingClientRect();
      triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2, '#FFD700', true);
      
      checkShowReset();
    }
  } else {
    state.stage1Timeout = window.setTimeout(() => {
      state.element.classList.add('inflating');
      
      state.stage2Timeout = window.setTimeout(() => {
        const rect = state.element.getBoundingClientRect();
        triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2, '#ff7e67');
        
        state.element.classList.remove('inflating');
        state.count = 0;
        updateTextSmoothly(state.element, 'i');
      }, 2000);
    }, 3000);
  }
};

const checkShowReset = () => {
  if (mightyState.isGold || atriaState.isGold) {
    resetBtn.classList.remove('hidden');
  }
};

const forceExplodeReset = (state: IState) => {
  if (state.count === 0 && !state.isGold) return;
  if (state.element.classList.contains('inflating')) return;

  clearTimeouts(state);
  state.isGold = false;
  state.lockedUntil = 0;
  state.element.classList.remove('gold');
  state.element.classList.add('inflating');
  
  state.stage2Timeout = window.setTimeout(() => {
    const rect = state.element.getBoundingClientRect();
    triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2, '#ff7e67');
    
    state.element.classList.remove('inflating');
    state.count = 0;
    updateTextSmoothly(state.element, 'i');
  }, 2000);
};

resetBtn.addEventListener('click', () => {
  forceExplodeReset(mightyState);
  forceExplodeReset(atriaState);
});

if (mightyState.element) mightyState.element.addEventListener('click', () => handleClick(mightyState));
if (atriaState.element) atriaState.element.addEventListener('click', () => handleClick(atriaState));


// --- Canvas Animation Logic ---
const canvas = document.getElementById('bg-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let width: number;
let height: number;

const resizeCanvas = () => {
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  
  initParticles();
};

const colors = ['#FF9EBB', '#9EE0FF', '#FFCE9E'];

const interpolateColor = (color1: string, color2: string, factor: number) => {
  const hex = (c: string) => parseInt(c.slice(1), 16);
  const r1 = hex(color1) >> 16, g1 = (hex(color1) >> 8) & 0xff, b1 = hex(color1) & 0xff;
  const r2 = hex(color2) >> 16, g2 = (hex(color2) >> 8) & 0xff, b2 = hex(color2) & 0xff;
  
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
};

const getSunsetGradientColor = (y: number, height: number) => {
  const normY = Math.max(0, Math.min(1, y / height));
  const topColor = colors[1];    // Light blue
  const midColor = colors[0];    // Pink
  const bottomColor = colors[2]; // Light orange

  if (normY < 0.5) {
    return interpolateColor(topColor, midColor, normY * 2);
  } else {
    return interpolateColor(midColor, bottomColor, (normY - 0.5) * 2);
  }
};

const particles: Particle[] = [];
const explosionParticles: ExplosionParticle[] = [];

let mouse = { x: -1000, y: -1000, radius: 260 };

window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mouseout', () => { mouse.x = -1000; mouse.y = -1000; });

class Particle {
  x: number; y: number; originX: number; originY: number; color: string; size: number; vx: number; vy: number; friction: number; ease: number;

  constructor(x: number, y: number, color: string, size: number) {
    this.x = x; this.y = y; this.originX = x; this.originY = y; this.color = color; this.size = size;
    this.vx = 0; this.vy = 0; this.friction = 0.85; this.ease = 0.02;
  }

  draw() {
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); ctx.closePath();
  }

  update() {
    const dx = mouse.x - this.x; const dy = mouse.y - this.y; const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < mouse.radius) {
      const normDist = distance / mouse.radius;
      let force = 0;
      if (normDist < 0.2) {
        // 内圈 20% 的距离范围承担 80% 的衰减 (即斥力从 1.0 快速掉到 0.2)
        force = 1.0 - (normDist * 4);
      } else {
        // 外围 80% 的距离范围承担剩下 20% 的衰减 (即斥力平缓地从 0.2 掉到 0)
        force = 0.2 - (normDist - 0.2) * 0.25;
      }
      this.vx += -(dx / distance) * force * 4;
      this.vy += -(dy / distance) * force * 4;
    }
    this.vx += (this.originX - this.x) * this.ease;
    this.vy += (this.originY - this.y) * this.ease;
    this.vx *= this.friction; this.vy *= this.friction;

    // 限速，减少突变感和闪烁
    const maxSpeed = 2;
    const speedSq = this.vx * this.vx + this.vy * this.vy;
    if (speedSq > maxSpeed * maxSpeed) {
      const speed = Math.sqrt(speedSq);
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx; this.y += this.vy;
    this.draw();
  }
}

class ExplosionParticle {
  x: number; y: number; color: string; size: number; vx: number; vy: number; friction: number; life: number; maxLife: number;

  constructor(x: number, y: number, color: string, isSlow: boolean = false) {
    this.x = x; this.y = y; this.color = color;
    this.size = Math.random() * 3 + 2;
    const angle = Math.random() * Math.PI * 2;
    const speed = isSlow ? (Math.random() * 3 + 1) : (Math.random() * 8 + 4);
    this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
    this.friction = isSlow ? 0.96 : 0.92; 
    this.life = 0; 
    // Extend maxLife so the visual effect clearly lasts ~0.6s before fading out
    this.maxLife = isSlow ? (Math.random() * 10 + 55) : (Math.random() * 20 + 30);
  }

  update() {
    this.vx *= this.friction; this.vy *= this.friction;
    this.x += this.vx; this.y += this.vy;
    this.life++;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); 
    ctx.fillStyle = this.color; 
    ctx.globalAlpha = Math.max(0, 1 - (this.life / this.maxLife));
    ctx.fill(); ctx.closePath();
    ctx.globalAlpha = 1;
  }
}

const triggerExplosion = (x: number, y: number, specificColor?: string, isSlow: boolean = false) => {
  const explodeColors = specificColor ? [specificColor] : colors;
  for (let i = 0; i < 40; i++) {
    const color = explodeColors[Math.floor(Math.random() * explodeColors.length)];
    explosionParticles.push(new ExplosionParticle(x, y, color, isSlow));
  }
};

const initParticles = () => {
  particles.length = 0;
  const spacing = 50; 
  const cols = Math.floor(width / spacing);
  const rows = Math.floor(height / spacing);
  const offsetX = (width - (cols - 1) * spacing) / 2;
  const offsetY = (height - (rows - 1) * spacing) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offsetX + c * spacing;
      const y = offsetY + r * spacing;
      const color = getSunsetGradientColor(y, height);
      const size = 4; 
      particles.push(new Particle(x, y, color, size));
    }
  }
};

const animate = () => {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < particles.length; i++) { particles[i].update(); }
  for (let i = explosionParticles.length - 1; i >= 0; i--) {
    explosionParticles[i].update();
    if (explosionParticles[i].life >= explosionParticles[i].maxLife) { explosionParticles.splice(i, 1); }
  }
  requestAnimationFrame(animate);
};

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
animate();
