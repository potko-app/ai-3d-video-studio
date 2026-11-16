(function () {
  // 1. Safe UTF-8 & URL-Safe Base64 Payload Decoder
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
    console.error("Scene payload parse fallback:", err);
  }

  // UI Elements Reference
  const uiTitle = document.getElementById("uiTitle");
  const uiBadge = document.getElementById("uiBadge");
  const uiProgress = document.getElementById("uiProgress");
  const uiTimer = document.getElementById("uiTimer");
  const uiDownloadBtn = document.getElementById("uiDownloadBtn");
  const previewContainer = document.getElementById("previewContainer");

  uiTitle.textContent = sceneData.title || "Kinetra3D Studio";

  // 2. Three.js Cinema WebGL Renderer Setup
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

  // 3. Studio Voice Mastering Chain (Deep Bass Punch + Vocal Clarity + Compressor)
  function createStudioVoiceBus(ctx, dest) {
    // Low-shelf EQ for deep, powerful chest resonance ("दम")
    const warmthEQ = ctx.createBiquadFilter();
    warmthEQ.type = "lowshelf";
    warmthEQ.frequency.value = 160;
    warmthEQ.gain.value = 5.5;

    // Peaking EQ for crisp storytelling clarity
    const clarityEQ = ctx.createBiquadFilter();
    clarityEQ.type = "peaking";
    clarityEQ.frequency.value = 3200;
    clarityEQ.Q.value = 1.1;
    clarityEQ.gain.value = 3.5;

    // Broadcast Compressor so every word sounds rich and balanced
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 1.25;

    warmthEQ.connect(clarityEQ);
    clarityEQ.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(dest);
    masterGain.connect(ctx.destination);

    return warmthEQ;
  }

  // 4. Split Script into Emotional Sentences (No fake noise on punctuation!)
  function splitIntoEmotionalBeats(text) {
    const clean = text.replace(/\[.*?\]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const rawSentences = clean.match(/[^।!?…]+(?:[।!?…]+|$)/g) || [clean];
    return rawSentences.map(s => {
      const trimmed = s.trim();
      let rate = 1.0;
      let detune = 0;
      let pauseAfter = 0.34;

      if (trimmed.endsWith("?")) {
        rate = 1.03;
        detune = 35; // Natural questioning lift
        pauseAfter = 0.42;
      } else if (trimmed.endsWith("!")) {
        rate = 1.05;
        detune = 20; // Energetic dramatic punch
        pauseAfter = 0.38;
      } else if (trimmed.includes("...") || trimmed.endsWith("…")) {
        rate = 0.93;
        detune = -30; // Deep suspenseful slowdown
        pauseAfter = 0.48;
      }
      return { text: trimmed, rate, detune, pauseAfter };
    }).filter(b => b.text.length > 0);
  }

  async function loadNaturalVoiceClip(ctx, text) {
    const isHindi = /[\u0900-\u097F]/.test(text);
    const voice = isHindi ? "Aditi" : "Matthew";
    const endpoints = [
      `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${isHindi ? "hi" : "en"}&q=${encodeURIComponent(text.slice(0, 200))}`
    ];
    for (const url of endpoints) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        return await ctx.decodeAudioData(arr);
      } catch (e) {}
    }
    return null;
  }

  // 5. Master Production & Live Preview Loop
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

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const audioDest = audioCtx.createMediaStreamDestination();

    // Warm Soft Ambient Cinema Bed (Low-pass filtered so it never buzzes)
    const padFilter = audioCtx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 280;
    const padGain = audioCtx.createGain();
    padGain.gain.value = 0.015;
    padFilter.connect(padGain);
    padGain.connect(audioDest);

    const osc1 = audioCtx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.value = 130.81; // C3 warm root
    const osc2 = audioCtx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 196.00; // G3 soft fifth
    osc1.connect(padFilter);
    osc2.connect(padFilter);
    osc1.start();
    osc2.start();

    const voiceBus = createStudioVoiceBus(audioCtx, audioDest);
    const beats = splitIntoEmotionalBeats(sceneData.narration || "");
    let cursor = audioCtx.currentTime + 0.25;

    for (const beat of beats.slice(0, 10)) {
      const clip = await loadNaturalVoiceClip(audioCtx, beat.text);
      if (clip) {
        const src = audioCtx.createBufferSource();
        src.buffer = clip;
        src.playbackRate.value = beat.rate;
        if (src.detune) src.detune.value = beat.detune;
        src.connect(voiceBus);
        src.start(cursor);
        cursor += (clip.duration / beat.rate) + beat.pauseAfter;
      }
    }

    // Match video length smoothly to narration (15s to 22s max)
    const spokenDurationMs = (cursor - audioCtx.currentTime + 0.6) * 1000;
    const DURATION = beats.length > 0 ? Math.max(15000, Math.min(22000, spokenDurationMs)) : 15000;

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
      osc1.stop();
      osc2.stop();
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
