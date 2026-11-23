(() => {
  'use strict';
  const canvas = document.querySelector('#cosmos');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { document.querySelector('#scene-caption').textContent = '当前浏览器暂不支持星空绘制，请尝试其他浏览器。'; return; }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const modes = [
    { caption: '万物相遇，自有轨迹。', description: '环绕、相遇，再次出发。' },
    { caption: '每一束微光，都有去处。', description: '把想象，交还给无垠。' },
    { caption: '让时间，流成光。', description: '不设终点，自由流动。' }
  ];
  let width = 1, height = 1, pixelRatio = 1, mode = 0, time = 0, speed = 1;
  let paused = reducedMotion.matches, visible = true, lastFrame = 0, lastPaint = 0;
  let pointer = { x: 0, y: 0 }, tilt = { x: 0, y: 0 };
  let pulse = null, transition = null, toastTimer;
  let seed = 9321;
  function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  const points = Array.from({ length: 2600 }, (_, i) => ({
    u: random() * Math.PI * 2, v: random() * Math.PI * 2,
    r: Math.sqrt(random()), a: .22 + random() * .72,
    size: .4 + random() * 1.25, group: i % 4, phase: random() * Math.PI * 2
  }));
  const stars = Array.from({ length: 105 }, () => ({ x: random(), y: random(), a: .14 + random() * .38, s: .3 + random() * .8 }));
  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    draw();
  }
  function position(p, type, t) {
    const u = p.u + t * .12;
    if (type === 0) {
      const radius = 202 + Math.cos(p.v) * (20 + p.r * 38);
      return { x: Math.cos(u) * radius, y: Math.sin(p.v) * (17 + p.r * 26), z: Math.sin(u) * radius };
    }
    if (type === 1) {
      const radius = 18 + p.r * 242;
      const angle = p.u + radius * .012 + t * .09;
      return { x: Math.cos(angle) * radius, y: Math.sin(p.v + t * .12) * (12 + p.r * 29), z: Math.sin(angle) * radius * .84 };
    }
    const x = (p.u / (Math.PI * 2) - .5) * 540;
    const wave = x * .012 + t * .55 + p.group * .7;
    return { x, y: Math.sin(wave) * 72 + Math.sin(p.v) * (7 + 15 * p.r), z: Math.cos(wave) * 88 + Math.cos(p.v) * p.r * 45 + (p.group - 1.5) * 16 };
  }
  function project(p, scale, centerX, centerY) {
    const rx = .92 + tilt.y * .3;
    const ry = tilt.x * .35;
    const x = p.x * Math.cos(ry) + p.z * Math.sin(ry);
    const z0 = -p.x * Math.sin(ry) + p.z * Math.cos(ry);
    const y = p.y * Math.cos(rx) - z0 * Math.sin(rx);
    const z = p.y * Math.sin(rx) + z0 * Math.cos(rx);
    const rotation = -.39;
    const perspective = 800 / (800 + z);
    return { x: centerX + (x * Math.cos(rotation) - y * Math.sin(rotation)) * scale * perspective,
      y: centerY + (x * Math.sin(rotation) + y * Math.cos(rotation)) * scale * perspective,
      z, perspective };
  }
  function draw() {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = '#061323'; ctx.fillRect(0, 0, width, height);
    const centerX = width * .535, centerY = height * .46;
    const scale = Math.min(width / 660, height / 610) * 1.17;
    const halo = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 300 * scale);
    halo.addColorStop(0, '#113442'); halo.addColorStop(.5, '#0b2537'); halo.addColorStop(1, '#061323');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
    stars.forEach(s => { ctx.globalAlpha = s.a; ctx.fillStyle = '#a7ccde'; ctx.fillRect(s.x * width, s.y * height, s.s, s.s); });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(133, 184, 198, .10)'; ctx.lineWidth = .7;
    [275, 304].forEach(r => {
      ctx.beginPath(); ctx.ellipse(centerX, centerY, r * scale, r * scale * .66, -.39, 0, Math.PI * 2); ctx.stroke();
    });
    for (let j = 0; j < 64; j++) {
      const a = j / 64 * Math.PI * 2;
      const r = 303 * scale;
      const x = Math.cos(a) * r, y = Math.sin(a) * r * .66;
      const length = j % 8 === 0 ? 7 : 3;
      ctx.beginPath();
      ctx.moveTo(centerX + x * Math.cos(-.39) - y * Math.sin(-.39), centerY + x * Math.sin(-.39) + y * Math.cos(-.39));
      ctx.lineTo(centerX + (x + Math.cos(a) * length) * Math.cos(-.39) - (y + Math.sin(a) * length) * Math.sin(-.39), centerY + (x + Math.cos(a) * length) * Math.sin(-.39) + (y + Math.sin(a) * length) * Math.cos(-.39));
      ctx.stroke();
    }
    const blend = transition ? Math.min(1, (performance.now() - transition.started) / 1100) : 1;
    const ease = blend * blend * (3 - 2 * blend);
    const framePoints = points.map(p => {
      let pos = position(p, mode, time);
      if (transition) {
        const from = position(p, transition.from, time);
        pos = { x: from.x + (pos.x - from.x) * ease, y: from.y + (pos.y - from.y) * ease, z: from.z + (pos.z - from.z) * ease };
      }
      return { p, ...project(pos, scale, centerX, centerY) };
    });
    framePoints.sort((a, b) => b.z - a.z);
    ctx.globalCompositeOperation = 'lighter';
    framePoints.forEach(({ p, x, y, z, perspective }) => {
      const warm = Math.sin(p.u + time * .12) > .5;
      const hue = warm ? (mode === 1 ? '194,156,255' : '255,169,115') : '105,222,226';
      const depth = Math.max(.2, Math.min(1, (300 - z) / 500));
      let px = x, py = y;
      if (pulse) {
        const distance = Math.hypot(px - pulse.x, py - pulse.y);
        const age = (performance.now() - pulse.started) / 1000;
        const envelope = Math.max(0, 1 - Math.abs(distance - age * 270) / 75) * Math.max(0, 1 - age / 2.3);
        const force = envelope * 18;
        px += (px - pulse.x) / (distance || 1) * force;
        py += (py - pulse.y) / (distance || 1) * force;
      }
      const radius = Math.max(.35, p.size * scale * perspective * .85);
      ctx.fillStyle = `rgba(${hue},${p.a * depth})`;
      ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
      if (p.size > 1.5) {
        ctx.fillStyle = `rgba(${hue},${.045 * depth})`;
        ctx.beginPath(); ctx.arc(px, py, radius * 5, 0, Math.PI * 2); ctx.fill();
      }
    });
    if (pulse) {
      const age = (performance.now() - pulse.started) / 1000;
      if (age < 2.3) {
        ctx.strokeStyle = `rgba(103,223,220,${.3 * Math.max(0, 1 - age / 2.3)})`;
        ctx.lineWidth = 1;ctx.beginPath();ctx.arc(pulse.x, pulse.y, age * 270, 0, Math.PI * 2);ctx.stroke();
      } else pulse = null;
    }
    ctx.globalCompositeOperation = 'source-over';
    if (mode === 0 || (transition && transition.from === 0)) {
      const opacity = mode === 0 ? ease : 1 - ease;
      const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 41 * scale);
      core.addColorStop(0, `rgba(214,250,245,${.92 * opacity})`);
      core.addColorStop(.045, `rgba(168,241,230,${.7 * opacity})`);
      core.addColorStop(.15, `rgba(103,223,220,${.15 * opacity})`);
      core.addColorStop(1, 'rgba(103,223,220,0)');
      ctx.fillStyle = core;ctx.fillRect(centerX - 42 * scale, centerY - 42 * scale, 84 * scale, 84 * scale);
      ctx.strokeStyle = `rgba(151,223,219,${.35 * opacity})`;ctx.lineWidth = .5;
      ctx.beginPath();ctx.moveTo(centerX - 21 * scale, centerY);ctx.lineTo(centerX + 21 * scale, centerY);ctx.moveTo(centerX, centerY - 21 * scale);ctx.lineTo(centerX, centerY + 21 * scale);ctx.stroke();
    }
    if (blend === 1) transition = null;
  }
  function animate(now) {
    requestAnimationFrame(animate);
    if (!visible || document.hidden) { lastFrame = now; return; }
    const interval = width < 600 ? 32 : 20;
    if (now - lastPaint < interval) return;
    const delta = Math.min((now - (lastFrame || now)) / 1000, .07);
    lastFrame = now;lastPaint = now;
    const needsTilt = Math.abs(tilt.x - pointer.x) + Math.abs(tilt.y - pointer.y) > .001;
    tilt.x += (pointer.x - tilt.x) * .065;tilt.y += (pointer.y - tilt.y) * .065;
    if (!paused) time += delta * speed;
    if (!paused || transition || pulse || needsTilt) draw();
  }
  function setPaused(value) {
    paused = value;
    document.querySelector('#pause').setAttribute('aria-pressed', String(paused));
    document.querySelector('#pause-label').textContent = paused ? '播放' : '暂停';
    document.querySelector('.pause-icon').textContent = paused ? '▷' : 'Ⅱ';
    document.querySelector('#pause').setAttribute('aria-label', paused ? '播放动画' : '暂停动画');
  }
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => {
      const next = Number(button.dataset.mode);
      if (next === mode) return;
      transition = reducedMotion.matches ? null : { from: mode, started: performance.now() };
      mode = next;
      document.querySelectorAll('[data-mode]').forEach(item => {
        const selected = Number(item.dataset.mode) === mode;
        item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected));
      });
      document.querySelector('#scene-index').textContent = `形态 0${mode + 1} / 03`;
      document.querySelector('#scene-caption').textContent = modes[mode].caption;
      document.querySelector('#mode-description').textContent = modes[mode].description;
      draw();
    });
  });
  document.querySelector('#speed').addEventListener('input', event => {
    speed = Number(event.target.value);
    document.querySelector('#speed-value').textContent = `${speed.toFixed(1)}×`;
  });
  document.querySelector('#pause').addEventListener('click', () => setPaused(!paused));
  canvas.addEventListener('pointermove', event => {
    if (reducedMotion.matches) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    pointer.y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => { pointer = { x: 0, y: 0 }; });
  canvas.addEventListener('click', event => {
    if (reducedMotion.matches) return;
    const bounds = canvas.getBoundingClientRect();
    pulse = { x: event.clientX - bounds.left, y: event.clientY - bounds.top, started: performance.now() };
    draw();
  });
  function notify(message) {
    const toast = document.querySelector('#toast');toast.textContent = message;toast.classList.add('visible');
    clearTimeout(toastTimer);toastTimer = setTimeout(() => toast.classList.remove('visible'), 3300);
  }
  document.querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => {
    const exportCanvas = document.createElement('canvas');
    const exportWidth = 1800, exportHeight = Math.round(exportWidth * height / width) + 100;
    exportCanvas.width = exportWidth;exportCanvas.height = exportHeight;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) { notify('暂时无法保存，请尝试截图。'); return; }
    exportCtx.fillStyle = '#061323';exportCtx.fillRect(0, 0, exportWidth, exportHeight);
    exportCtx.drawImage(canvas, 0, 0, exportWidth, exportHeight - 100);
    exportCtx.fillStyle = '#eef6f4';exportCtx.font = '32px sans-serif';exportCtx.fillText('hui. / 引力场', 55, exportHeight - 48);
    exportCtx.fillStyle = '#a9c0cc';exportCtx.font = '21px sans-serif';exportCtx.textAlign = 'right';exportCtx.fillText(`hui.noxc.uk   ·   ${new Date().toLocaleDateString('zh-CN')}`, exportWidth - 55, exportHeight - 48);
    exportCanvas.toBlob(blob => {
      if (!blob) { notify('暂时无法保存，请重试。'); return; }
      const link = document.createElement('a');const url = URL.createObjectURL(blob);
      link.href = url;link.download = `hui-${['orbit','nebula','flow'][mode]}-${Date.now()}.png`;link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);notify('画面已生成，请查看浏览器下载。');
    }, 'image/png');
  }));
  function updateClock() {
    document.querySelector('#local-time').textContent = `北京时间 ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}`;
    document.querySelector('#year').textContent = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date());
  }
  document.addEventListener('visibilitychange', () => { lastFrame = 0; });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) setPaused(true); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting;lastFrame = 0; }, { threshold: 0 }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  setPaused(paused);updateClock();setInterval(updateClock, 30000);resize();requestAnimationFrame(animate);
})();
