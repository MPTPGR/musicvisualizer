 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/script.js b/script.js
new file mode 100644
index 0000000000000000000000000000000000000000..0e3f228206415f93730f6ab46afee4ad394d0c7f
--- /dev/null
+++ b/script.js
@@ -0,0 +1,355 @@
+const fileInput = document.getElementById('fileInput');
+const visualMode = document.getElementById('visualMode');
+const intensityInput = document.getElementById('intensity');
+const playPauseBtn = document.getElementById('playPause');
+const stopBtn = document.getElementById('stopBtn');
+const fullscreenBtn = document.getElementById('fullscreenBtn');
+const statusText = document.getElementById('status');
+const canvas = document.getElementById('visualizerCanvas');
+const dropZone = document.getElementById('dropZone');
+const audio = document.getElementById('audio');
+
+const ctx = canvas.getContext('2d');
+
+let audioCtx;
+let analyser;
+let source;
+let animationId;
+let objectUrl;
+let intensity = Number(intensityInput.value);
+
+function resizeCanvas() {
+  const ratio = window.devicePixelRatio || 1;
+  const width = Math.max(1, Math.floor(canvas.clientWidth));
+  const height = Math.max(1, Math.floor(canvas.clientHeight));
+  canvas.width = Math.floor(width * ratio);
+  canvas.height = Math.floor(height * ratio);
+  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
+}
+
+function setStatus(message) {
+  statusText.textContent = message;
+}
+
+function createAudioNodes() {
+  if (audioCtx) return;
+
+  const AudioCtx = window.AudioContext || window.webkitAudioContext;
+  if (!AudioCtx) {
+    throw new Error('Web Audio API is not supported in this browser.');
+  }
+
+  audioCtx = new AudioCtx();
+  analyser = audioCtx.createAnalyser();
+  analyser.fftSize = 2048;
+  analyser.smoothingTimeConstant = 0.84;
+
+  source = audioCtx.createMediaElementSource(audio);
+  source.connect(analyser);
+  analyser.connect(audioCtx.destination);
+}
+
+function average(arr) {
+  if (!arr.length) return 0;
+  let sum = 0;
+  for (const item of arr) sum += item;
+  return sum / arr.length;
+}
+
+function getAudioMetrics() {
+  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
+  analyser.getByteFrequencyData(frequencyData);
+
+  const quarter = Math.floor(frequencyData.length / 4);
+  const bass = average(frequencyData.slice(0, quarter));
+  const mids = average(frequencyData.slice(quarter, quarter * 2));
+  const highs = average(frequencyData.slice(quarter * 2));
+  const energy = average(frequencyData);
+
+  const gain = intensity;
+
+  return {
+    bass: Math.min(1, (bass / 255) * gain),
+    mids: Math.min(1, (mids / 255) * gain),
+    highs: Math.min(1, (highs / 255) * gain),
+    energy: Math.min(1, (energy / 255) * gain)
+  };
+}
+
+function clearWithTrail(alpha = 0.08) {
+  ctx.fillStyle = `rgba(8, 7, 16, ${alpha})`;
+  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
+}
+
+function drawNebula(time, metrics) {
+  clearWithTrail(0.14 - metrics.energy * 0.08);
+  const w = canvas.clientWidth;
+  const h = canvas.clientHeight;
+  const pulse = 40 + metrics.bass * 150;
+
+  for (let i = 0; i < 12; i++) {
+    const angle = (time * 0.00018 + i * 0.52) * (1 + metrics.mids * 0.7);
+    const radius = 60 + i * 18 + pulse * Math.sin(time * 0.001 + i);
+    const x = w / 2 + Math.cos(angle) * radius;
+    const y = h / 2 + Math.sin(angle * 1.15) * radius;
+    const grad = ctx.createRadialGradient(x, y, 0, x, y, 90 + pulse * 0.45);
+    grad.addColorStop(0, `hsla(${(time * 0.02 + i * 42) % 360}, 95%, 70%, 0.55)`);
+    grad.addColorStop(1, 'rgba(0,0,0,0)');
+    ctx.fillStyle = grad;
+    ctx.beginPath();
+    ctx.arc(x, y, 90 + pulse * 0.45, 0, Math.PI * 2);
+    ctx.fill();
+  }
+}
+
+function drawLiquidBloom(time, metrics) {
+  clearWithTrail(0.1 - metrics.highs * 0.03);
+  const w = canvas.clientWidth;
+  const h = canvas.clientHeight;
+
+  ctx.save();
+  ctx.translate(w / 2, h / 2);
+
+  for (let i = 0; i < 7; i++) {
+    const base = 70 + i * 28;
+    const wobble = 24 + metrics.bass * 65;
+    ctx.beginPath();
+
+    for (let a = 0; a <= Math.PI * 2.03; a += 0.06) {
+      const ripple = Math.sin(a * (3 + i * 0.35) + time * 0.002 + i) * wobble;
+      const r = base + ripple + metrics.mids * 40;
+      const x = Math.cos(a) * r;
+      const y = Math.sin(a) * r;
+      if (a === 0) ctx.moveTo(x, y);
+      else ctx.lineTo(x, y);
+    }
+
+    const hue = (time * 0.04 + i * 30 + metrics.energy * 180) % 360;
+    ctx.strokeStyle = `hsla(${hue}, 95%, 62%, ${0.12 + metrics.energy * 0.35})`;
+    ctx.lineWidth = 1.6 + i * 0.4;
+    ctx.stroke();
+  }
+
+  ctx.restore();
+}
+
+function drawKaleidoTunnel(time, metrics) {
+  clearWithTrail(0.12 - metrics.mids * 0.05);
+  const w = canvas.clientWidth;
+  const h = canvas.clientHeight;
+  const spokes = 18;
+  const maxR = Math.hypot(w, h) * 0.5;
+
+  ctx.save();
+  ctx.translate(w / 2, h / 2);
+  ctx.rotate(time * 0.00025 * (1 + metrics.highs));
+
+  for (let i = 0; i < spokes; i++) {
+    const a = (Math.PI * 2 * i) / spokes;
+    const hue = (time * 0.05 + i * 20 + metrics.bass * 240) % 360;
+
+    ctx.save();
+    ctx.rotate(a);
+    ctx.beginPath();
+
+    for (let r = 0; r < maxR; r += 24) {
+      const warp = Math.sin(time * 0.002 + r * 0.03 + i) * (metrics.energy * 40 + 8);
+      const y = Math.sin(r * 0.05 + time * 0.0014) * (12 + metrics.mids * 24);
+      ctx.lineTo(r + warp, y);
+    }
+
+    ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${0.12 + metrics.highs * 0.4})`;
+    ctx.lineWidth = 1.1 + metrics.bass * 4;
+    ctx.stroke();
+    ctx.restore();
+  }
+
+  ctx.restore();
+}
+
+function drawPlasmaVeil(time, metrics) {
+  clearWithTrail(0.1 - metrics.energy * 0.04);
+  const w = canvas.clientWidth;
+  const h = canvas.clientHeight;
+  const cols = 32;
+  const rows = 20;
+  const cellW = w / cols;
+  const cellH = h / rows;
+
+  for (let y = 0; y < rows; y++) {
+    for (let x = 0; x < cols; x++) {
+      const nx = x / cols;
+      const ny = y / rows;
+      const wave =
+        Math.sin(nx * 11 + time * 0.001 + metrics.bass * 3) +
+        Math.cos(ny * 13 + time * 0.0013 + metrics.highs * 4);
+      const hue = (wave * 80 + time * 0.03 + metrics.energy * 180) % 360;
+      const alpha = 0.05 + Math.max(0, wave) * 0.11 + metrics.energy * 0.22;
+      ctx.fillStyle = `hsla(${hue}, 96%, 58%, ${alpha})`;
+      ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
+    }
+  }
+}
+
+function drawFrame(time) {
+  if (!analyser || audio.paused) return;
+
+  const metrics = getAudioMetrics();
+
+  switch (visualMode.value) {
+    case 'liquid':
+      drawLiquidBloom(time, metrics);
+      break;
+    case 'kaleido':
+      drawKaleidoTunnel(time, metrics);
+      break;
+    case 'plasma':
+      drawPlasmaVeil(time, metrics);
+      break;
+    case 'nebula':
+    default:
+      drawNebula(time, metrics);
+      break;
+  }
+
+  animationId = requestAnimationFrame(drawFrame);
+}
+
+function startVisualization() {
+  cancelAnimationFrame(animationId);
+  animationId = requestAnimationFrame(drawFrame);
+}
+
+function enablePlaybackControls(enabled) {
+  playPauseBtn.disabled = !enabled;
+  stopBtn.disabled = !enabled;
+}
+
+function stopVisualization(message = 'Stopped.') {
+  audio.pause();
+  audio.currentTime = 0;
+  playPauseBtn.textContent = 'Play';
+  setStatus(message);
+  cancelAnimationFrame(animationId);
+  clearWithTrail(1);
+}
+
+function loadAudioFile(file) {
+  if (!file || !file.type.startsWith('audio/')) {
+    setStatus('Please provide a valid audio file.');
+    return;
+  }
+
+  if (objectUrl) URL.revokeObjectURL(objectUrl);
+
+  objectUrl = URL.createObjectURL(file);
+  audio.src = objectUrl;
+  audio.load();
+
+  enablePlaybackControls(true);
+  playPauseBtn.textContent = 'Play';
+  setStatus(`Loaded: ${file.name}`);
+}
+
+async function onPlayPause() {
+  if (!audio.src) return;
+
+  try {
+    createAudioNodes();
+
+    if (audioCtx.state === 'suspended') {
+      await audioCtx.resume();
+    }
+
+    if (audio.paused) {
+      await audio.play();
+      playPauseBtn.textContent = 'Pause';
+      setStatus(`Now playing (${visualMode.options[visualMode.selectedIndex].text})`);
+      startVisualization();
+    } else {
+      audio.pause();
+      playPauseBtn.textContent = 'Play';
+      setStatus('Paused.');
+    }
+  } catch (error) {
+    setStatus(`Playback error: ${error.message}`);
+  }
+}
+
+function onDrop(event) {
+  event.preventDefault();
+  dropZone.classList.remove('drop-active');
+
+  const file = event.dataTransfer.files?.[0];
+  if (file) {
+    fileInput.files = event.dataTransfer.files;
+    loadAudioFile(file);
+  }
+}
+
+fileInput.addEventListener('change', (event) => {
+  const file = event.target.files?.[0];
+  loadAudioFile(file);
+});
+
+playPauseBtn.addEventListener('click', onPlayPause);
+
+stopBtn.addEventListener('click', () => {
+  stopVisualization('Stopped.');
+});
+
+fullscreenBtn.addEventListener('click', async () => {
+  if (document.fullscreenElement) {
+    await document.exitFullscreen();
+    return;
+  }
+
+  if (canvas.requestFullscreen) {
+    await canvas.requestFullscreen();
+  }
+});
+
+visualMode.addEventListener('change', () => {
+  const mode = visualMode.options[visualMode.selectedIndex].text;
+  setStatus(audio.paused ? `Visual mode: ${mode}` : `Now playing (${mode})`);
+});
+
+intensityInput.addEventListener('input', () => {
+  intensity = Number(intensityInput.value);
+  if (!audio.paused) {
+    setStatus(`Now playing (${visualMode.options[visualMode.selectedIndex].text}) — intensity ${intensity.toFixed(1)}x`);
+  }
+});
+
+audio.addEventListener('ended', () => {
+  playPauseBtn.textContent = 'Play';
+  setStatus('Track ended.');
+});
+
+audio.addEventListener('error', () => {
+  setStatus('Failed to read this audio file. Try another format (mp3/wav/m4a/ogg).');
+  enablePlaybackControls(false);
+});
+
+window.addEventListener('resize', resizeCanvas);
+
+['dragenter', 'dragover'].forEach((eventName) => {
+  window.addEventListener(eventName, (event) => {
+    event.preventDefault();
+    dropZone.classList.add('drop-active');
+  });
+});
+
+['dragleave', 'drop'].forEach((eventName) => {
+  window.addEventListener(eventName, (event) => {
+    event.preventDefault();
+    if (eventName === 'drop') return;
+    dropZone.classList.remove('drop-active');
+  });
+});
+
+window.addEventListener('drop', onDrop);
+
+resizeCanvas();
+clearWithTrail(1);
+enablePlaybackControls(false);
 
EOF
)
