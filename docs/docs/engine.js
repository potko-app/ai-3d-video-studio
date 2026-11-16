(function () {
  // 1. Safe UTF-8 & URL-Safe Base64 Decoder
  function decodePayload(raw) {
    let clean = raw.trim();
    try { clean = decodeURIComponent(clean); } catch (e) {}
    clean = clean.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
    while (clean.length % 4 !== 0) clean += "=";
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder("utf-8").decode(bytes));
  }

  let sceneData = {
    title: "Kinetra3D Cinema",
    narration: "",
    atmosphere: "studio_clean",
    code: ""
  };

  try {
    const href = window.location.href;
    const idx = href.indexOf("#scene=");
    if (idx !== -1) {
      const parsed = decodePayload(href.slice(idx + 7));
      if (parsed) sceneData = { ...sceneData, ...parsed };
    }
  } catch (err) {
    console.error("Scene parse fallback:", err);
  }

  // UI Elements Reference
  const uiTitle = document.getElementById("uiTitle");
  const uiBadge = document.getElementById("uiBadge");
  const uiStatus = document.getElementById("uiStatus");
  const uiProgress = document.getElementById("uiProgress");
  const uiTimer = document.getElementById("uiTimer");
  const uiDownloadBtn = document.getElementById("uiDownloadBtn");
  const previewContainer = document.getElementById("previewContainer");

  uiTitle.textContent = sceneData.title || "Kinetra3D Studio";

  // 2. Three.js High-Detail WebGL Setup
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1280, 720);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  previewContainer.insertBefore(renderer.domElement, previewContainer.firstChild);

  const scene = new THREE.Scene();
  const themes = {
    cyber_neon: { bg: 0x060918, fog: 0x060918, key: 0x60a5fa, rim: 0xf43f5e },
    magical_forest: { bg: 0x061712, fog: 0x061712, key: 0x34d399, rim: 0x38bdf8 },
    sunset_golden: { bg: 0x1f0e06, fog: 0x1f0e06, key: 0xfbbf24, rim: 0xf97316 },
    space_cosmos: { bg: 0x04040c, fog: 0x04040c, key: 0xa78bfa, rim: 0x38bdf8 },
    studio_clean: { bg: 0x14161f, fog: 0x14161f, key: 0xfff7ed, rim: 0x818cf8 }
  };
  const activeTheme = themes[sceneData.atmosphere] || themes.studio_clean;
  scene.background = new THREE.Color(activeTheme.bg);
  scene.fog = new THREE.FogExp2(activeTheme.fog, 0.016);

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 250);
  camera.position.set(0, 2.4, 7.2);

  // Studio 3-Point Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.35));
  const keyLight = new THREE.DirectionalLight(activeTheme.key, 2.3);
  keyLight.position.set(6, 12, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(activeTheme.rim, 3.8, 28);
  rimLight.position.set(-5, 4, -4);
  scene.add(rimLight);

  // Default Rich Scene (Used only if AI didn't pass custom code)
  function buildDefaultCinemaScene() {
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.8, 0.25, 64),
      new THREE.MeshStandardMaterial({ color: 0x18181f, metalness: 0.8, roughness: 0.2 })
    );
    stage.position.y = -1.2;
    stage.receiveShadow = true;
    scene.add(stage);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.55, 0.04, 16, 100),
      new THREE.MeshBasicMaterial({ color: activeTheme.key })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.06;
    scene.add(ring);

    const core = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.95, 0.3, 140, 32),
      new THREE.MeshStandardMaterial({ color: activeTheme.key, metalness: 0.85, roughness: 0.12 })
    );
    core.position.y = 0.35;
    core.castShadow = true;
    scene.add(core);

    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(240 * 3);
    for (let i = 0; i < 720; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 26;
      pPos[i + 1] = -1 + Math.random() * 14;
      pPos[i + 2] = (Math.random() - 0.5) * 26;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const stars = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 }));
    scene.add(stars);

    window.animateScene = function (t, p) {
      core.rotation.y = t * 0.9;
      core.rotation.x = Math.sin(t * 0.6) * 0.35;
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.02);
      stars.rotation.y = t * 0.08;
      const angle = p * Math.PI * 1.6 - 0.8;
      camera.position.set(Math.sin(angle) * 5.8, 1.8 + Math.sin(t) * 0.25, Math.cos(angle) * 5.8);
      camera.lookAt(0, 0.3, 0);
    };
  }

  // 3. Natural Human Breath/Cough SFX + Fast Neural Voiceover Engine
  function triggerNaturalBreath(ctx, dest, time, isCough) {
    const dur = isCough ? 0.32 : 0.45;
    const size = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < size; i++) {
      const t = i / size;
      const env = isCough ? Math.sin(Math.min(1, t * 4) * Math.PI) * Math.exp(-t * 6) : Math.sin(t * Math.PI) * 0.4;
      out[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = isCough ? 650 : 950;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isCough ? 0.45 : 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    gain.connect(ctx.destination);
    src.start(time);
  }

  async function loadVoiceClip(ctx, text) {
    const clean = text.replace(/\[breath\]|\[cough\]|\[sigh\]/gi, "").trim();
    if (!clean) return null;
    const isHindi = /[\u0900-\u097F]/.test(clean);
    const voice = isHindi ? "Aditi" : "Matthew";
    const endpoints = [
      `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(clean)}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${isHindi ? "hi" : "en"}&q=${encodeURIComponent(clean.slice(0, 200))}`
    ];
    for (const url of endpoints) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 2800);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        return await ctx.decodeAudioData(arr);
      } catch (e) {}
    }
    return null;
  }

  // 4. Master Production & Live Preview Loop
  async function runEngine() {
    let customLoaded = false;
    if (sceneData.code && sceneData.code.trim().length > 20) {
      try {
        const buildCustom = new Function("scene", "camera", "renderer", "THREE", sceneData.code);
        buildCustom(scene, camera, renderer, THREE);
        customLoaded = true;
      } catch (err) {
        console.error("Custom scene error, using default:", err);
      }
    }
    if (!customLoaded) buildDefaultCinemaScene();

    // Setup Mixed Audio Stream (Voice + Breath SFX + Subtle Ambient Pad)
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const audioDest = audioCtx.createMediaStreamDestination();

    const osc = audioCtx.createOscillator();
    const padGain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 110;
    padGain.gain.value = 0.02;
    osc.connect(padGain);
    padGain.connect(audioDest);
    osc.start();

    const rawText = (sceneData.narration || "").trim();
    if (rawText) {
      const chunks = rawText.split(/(\[breath\]|\[cough\]|\[sigh\]|[।!?.,]+)/i).filter(s => s && s.trim());
      let cursor = audioCtx.currentTime + 0.2;
      for (const part of chunks.slice(0, 14)) {
        const low = part.toLowerCase().trim();
        if (low === "[cough]") {
          triggerNaturalBreath(audioCtx, audioDest, cursor, true);
          cursor += 0.4;
        } else if (low === "[breath]" || low === "[sigh]" || /^[।!?.,]+$/.test(low)) {
          triggerNaturalBreath(audioCtx, audioDest, cursor, false);
          cursor += 0.35;
        } else {
          const clip = await loadVoiceClip(audioCtx, part);
          if (clip) {
            const src = audioCtx.createBufferSource();
            src.buffer = clip;
            src.connect(audioDest);
            src.connect(audioCtx.destination);
            src.start(cursor);
            cursor += clip.duration + 0.08;
          }
        }
      }
    }

    const DURATION = 15000;
    const canvas = renderer.domElement;
    const videoStream = canvas.captureStream(30);
    const fullStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks()
    ]);

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(fullStream, { mimeType: mime, videoBitsPerSecond: 5000000 });
    const recordedChunks = [];

    recorder.ondataavailable = e => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
    recorder.onstop = () => {
      osc.stop();
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const videoUrl = URL.createObjectURL(blob);

      document.getElementById("renderHud").style.display = "none";
      canvas.style.display = "none";

      const player = document.getElementById("finalPlayer");
      player.src = videoUrl;
      player.style.display = "block";
      player.play().catch(() => {});

      uiBadge.textContent = "READY";
      uiBadge.classList.add("ready");

      uiDownloadBtn.href = videoUrl;
      uiDownloadBtn.download = (sceneData.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "kinetra3d") + ".webm";
      uiDownloadBtn.textContent = "Download Video";
      uiDownloadBtn.classList.remove("locked");
    };

    const startTime = performance.now();
    recorder.start();

    function frameStep(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / DURATION);
      const t = elapsed / 1000;

      if (typeof window.animateScene === "function") {
        try { window.animateScene(t, progress); } catch (e) {}
      }
      renderer.render(scene, camera);

      uiProgress.style.width = Math.floor(progress * 100) + "%";
      uiTimer.textContent = Math.max(0, Math.ceil((DURATION - elapsed) / 1000)) + "s";

      if (progress < 1) {
        requestAnimationFrame(frameStep);
      } else {
        recorder.stop();
      }
    }

    requestAnimationFrame(frameStep);
  }

  runEngine();
})();
