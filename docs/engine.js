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
    console.error("Payload parse fallback:", err);
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

  // 2. Load GLTFLoader Dynamically (With 2.5s Hard Timeout)
  function loadGLTFLoaderScript() {
    return new Promise((resolve) => {
      if (THREE.GLTFLoader) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
      const t = setTimeout(() => resolve(false), 2500);
      s.onload = () => { clearTimeout(t); resolve(true); };
      s.onerror = () => { clearTimeout(t); resolve(false); };
      document.head.appendChild(s);
    });
  }

  // 3. Cinema WebGL Renderer & Studio Lighting
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1280, 720);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputEncoding = THREE.sRGBEncoding;
  previewContainer.insertBefore(renderer.domElement, previewContainer.firstChild);

  const scene = new THREE.Scene();
  const themes = {
    cyber_neon: { bg: 0x050814, fog: 0x050814, key: 0x60a5fa, rim: 0xf43f5e, fill: 0x38bdf8 },
    magical_forest: { bg: 0x05140f, fog: 0x05140f, key: 0x34d399, rim: 0xfbbf24, fill: 0x2dd4bf },
    sunset_golden: { bg: 0x1a0b05, fog: 0x1a0b05, key: 0xfbbf24, rim: 0xf97316, fill: 0xfb7185 },
    space_cosmos: { bg: 0x03030a, fog: 0x03030a, key: 0xa78bfa, rim: 0x38bdf8, fill: 0xe879f9 },
    studio_clean: { bg: 0x10121a, fog: 0x10121a, key: 0xfff7ed, rim: 0x818cf8, fill: 0x93c5fd }
  };
  const activeTheme = themes[sceneData.atmosphere] || themes.studio_clean;
  scene.background = new THREE.Color(activeTheme.bg);
  scene.fog = new THREE.FogExp2(activeTheme.fog, 0.015);

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 250);
  camera.position.set(0, 2.2, 6.4);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.35));
  const keyLight = new THREE.DirectionalLight(activeTheme.key, 2.5);
  keyLight.position.set(6, 12, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(activeTheme.rim, 4.2, 26);
  rimLight.position.set(-5, 4.5, -4);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(activeTheme.fill, 2.4, 22);
  fillLight.position.set(5, 2.5, -3);
  scene.add(fillLight);

  // Custom GLSL Sky-Dome
  const worldDome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        zenithColor: { value: new THREE.Color(activeTheme.key).multiplyScalar(0.22) },
        horizonColor: { value: new THREE.Color(activeTheme.rim).multiplyScalar(0.12) },
        nadirColor: { value: new THREE.Color(activeTheme.bg) }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 zenithColor;
        uniform vec3 horizonColor;
        uniform vec3 nadirColor;
        varying vec3 vWorldPos;
        void main() {
          float y = normalize(vWorldPos).y;
          vec3 col = y >= 0.0
            ? mix(horizonColor, zenithColor, pow(y, 0.75))
            : mix(horizonColor, nadirColor, pow(-y, 0.6));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    })
  );
  scene.add(worldDome);

  // 4. Open-Source Studio .GLB Asset Library
  const GLB_LIBRARY = [
    {
      keywords: ["fox", "लोमड़ी", "animal", "jungle", "forest", "जंगल", "dog", "wolf"],
      url: "https://threejs.org/examples/models/gltf/Fox/glTF-Binary/Fox.glb",
      clip: "Run"
    },
    {
      keywords: ["horse", "घोड़ा", "race", "desert", "cowboy", "western"],
      url: "https://threejs.org/examples/models/gltf/Horse.glb",
      clip: ""
    },
    {
      keywords: ["bird", "पक्षी", "sky", "fly", "आसमान", "flamingo"],
      url: "https://threejs.org/examples/models/gltf/Flamingo.glb",
      clip: ""
    },
    {
      keywords: ["helmet", "space", "अंतरिक्ष", "sci-fi", "astronaut", "cyber"],
      url: "https://threejs.org/examples/models/gltf/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
      clip: ""
    },
    {
      keywords: ["robot", "रोबोट", "boy", "character", "dance", "walk", "default"],
      url: "https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb",
      clip: "Walking"
    }
  ];

  function selectBestModel() {
    const q = `${sceneData.title} ${sceneData.narration}`.toLowerCase();
    for (const item of GLB_LIBRARY) {
      if (item.keywords.some(k => q.includes(k))) return item;
    }
    return GLB_LIBRARY[GLB_LIBRARY.length - 1];
  }

  let mixer = null;
  let heroAsset = null;

  async function buildStudioStage() {
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.7, 0.24, 64),
      new THREE.MeshStandardMaterial({ color: 0x14151c, metalness: 0.88, roughness: 0.16 })
    );
    stage.position.y = -1.2;
    stage.receiveShadow = true;
    scene.add(stage);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.45, 0.035, 16, 100),
      new THREE.MeshBasicMaterial({ color: activeTheme.key })
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = -1.07;
    scene.add(glowRing);

    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(220 * 3);
    for (let i = 0; i < 660; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 24;
      pPos[i + 1] = -1 + Math.random() * 12;
      pPos[i + 2] = (Math.random() - 0.5) * 24;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const dustMotes = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.085, transparent: true, opacity: 0.75 }));
    scene.add(dustMotes);

    const loaderReady = await loadGLTFLoaderScript();
    const chosen = selectBestModel();

    await new Promise((resolve) => {
      if (!loaderReady || !THREE.GLTFLoader) return resolve();
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      setTimeout(finish, 2800);

      const loader = new THREE.GLTFLoader();
      loader.load(
        chosen.url,
        (gltf) => {
          if (settled) return;
          heroAsset = gltf.scene;
          const box = new THREE.Box3().setFromObject(heroAsset);
          const size = box.getSize(new THREE.Vector3()).length();
          const scale = 2.65 / (size || 1);
          heroAsset.scale.setScalar(scale);

          const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
          heroAsset.position.set(-center.x, -box.min.y * scale - 1.06, -center.z);

          heroAsset.traverse(node => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              if (node.material) node.material.envMapIntensity = 1.4;
            }
          });
          scene.add(heroAsset);

          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(heroAsset);
            const clip = (chosen.clip && THREE.AnimationClip.findByName(gltf.animations, chosen.clip)) || gltf.animations[0];
            mixer.clipAction(clip).play();
          }
          finish();
        },
        undefined,
        () => finish()
      );
    });

    if (!heroAsset) {
      heroAsset = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.92, 0.28, 160, 32),
        new THREE.MeshStandardMaterial({ color: activeTheme.key, metalness: 0.9, roughness: 0.1 })
      );
      heroAsset.position.y = 0.35;
      heroAsset.castShadow = true;
      scene.add(heroAsset);
    }

    const targetCamPos = new THREE.Vector3();
    const lookTarget = new THREE.Vector3(0, 0.35, 0);

    window.animateScene = function (t, p) {
      if (!mixer && heroAsset) heroAsset.rotation.y = t * 0.65;
      glowRing.scale.setScalar(1 + Math.sin(t * 2.8) * 0.018);
      dustMotes.rotation.y = t * 0.07;

      const angle = p * Math.PI * 1.55 - 0.78;
      const radius = 5.3 - Math.sin(p * Math.PI) * 0.65;
      targetCamPos.set(
        Math.sin(angle) * radius,
        1.65 + Math.sin(t * 0.85) * 0.25,
        Math.cos(angle) * radius
      );
      camera.position.lerp(targetCamPos, 0.08);
      camera.lookAt(lookTarget);
    };
  }

  // 5. Non-Blocking Studio Voice Mastering & Parallel Loader
  function createStudioVoiceBus(ctx, dest) {
    const warmthEQ = ctx.createBiquadFilter();
    warmthEQ.type = "lowshelf";
    warmthEQ.frequency.value = 160;
    warmthEQ.gain.value = 5.5;

    const clarityEQ = ctx.createBiquadFilter();
    clarityEQ.type = "peaking";
    clarityEQ.frequency.value = 3200;
    clarityEQ.Q.value = 1.1;
    clarityEQ.gain.value = 3.5;

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
    try { masterGain.connect(ctx.destination); } catch (e) {}

    return warmthEQ;
  }

  function parseEmotionalBeats(text) {
    const clean = text.replace(/\[.*?\]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const sentences = clean.match(/[^।!?…]+(?:[।!?…]+|$)/g) || [clean];
    return sentences.map(s => {
      const trimmed = s.trim();
      let rate = 1.0, detune = 0, pauseAfter = 0.32;
      if (trimmed.endsWith("?")) { rate = 1.03; detune = 35; pauseAfter = 0.4; }
      else if (trimmed.endsWith("!")) { rate = 1.05; detune = 20; pauseAfter = 0.36; }
      else if (trimmed.includes("...") || trimmed.endsWith("…")) { rate = 0.93; detune = -30; pauseAfter = 0.45; }
      return { text: trimmed, rate, detune, pauseAfter };
    }).filter(b => b.text.length > 0).slice(0, 8);
  }

  async function fetchNeuralVoice(ctx, text) {
    const isHindi = /[\u0900-\u097F]/.test(text);
    const voice = isHindi ? "Aditi" : "Matthew";
    const endpoints = [
      `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${isHindi ? "hi" : "en"}&q=${encodeURIComponent(text.slice(0, 200))}`
    ];
    for (const url of endpoints) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 2200);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        return await ctx.decodeAudioData(arr);
      } catch (e) {}
    }
    return null;
  }

  // 6. Master Production Loop (Never Blocks on AudioContext!)
  async function startStudioEngine() {
    uiStatus.textContent = "Loading 3D Scene...";
    let customActive = false;

    if (sceneData.code && sceneData.code.trim().length > 20) {
      try {
        const buildCustom = new Function("scene", "camera", "renderer", "THREE", sceneData.code);
        buildCustom(scene, camera, renderer, THREE);
        customActive = true;
      } catch (err) {
        console.error("Custom scene fallback to studio GLB:", err);
      }
    }

    if (!customActive) {
      await buildStudioStage();
    }

    // Render first frame immediately so screen is never black
    renderer.render(scene, camera);
    uiStatus.textContent = "Rendering 3D Video & Voice...";

    let audioCtx = null;
    let audioDest = null;
    let osc1 = null;
    let osc2 = null;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
      // NEVER await resume() — mobile WebViews hang forever without tap!
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
        const unlock = () => { if (audioCtx) audioCtx.resume().catch(() => {}); };
        document.addEventListener("touchstart", unlock, { once: true });
        document.addEventListener("click", unlock, { once: true });
      }
      audioDest = audioCtx.createMediaStreamDestination();

      const padFilter = audioCtx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.value = 260;
      const padGain = audioCtx.createGain();
      padGain.gain.value = 0.014;
      padFilter.connect(padGain);
      padGain.connect(audioDest);

      osc1 = audioCtx.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.value = 130.81;
      osc2 = audioCtx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 196.00;
      osc1.connect(padFilter);
      osc2.connect(padFilter);
      osc1.start();
      osc2.start();

      // Load all voice beats in parallel (max ~2.2s total, never blocks!)
      const beats = parseEmotionalBeats(sceneData.narration || "");
      if (beats.length > 0) {
        const voiceBus = createStudioVoiceBus(audioCtx, audioDest);
        const clips = await Promise.all(beats.map(b => fetchNeuralVoice(audioCtx, b.text)));
        let cursor = audioCtx.currentTime + 0.15;
        clips.forEach((clip, i) => {
          if (!clip) return;
          const beat = beats[i];
          const src = audioCtx.createBufferSource();
          src.buffer = clip;
          src.playbackRate.value = beat.rate;
          if (src.detune) src.detune.value = beat.detune;
          src.connect(voiceBus);
          src.start(cursor);
          cursor += (clip.duration / beat.rate) + beat.pauseAfter;
        });
      }
    } catch (audioErr) {
      console.warn("Audio setup skipped:", audioErr);
    }

    const DURATION = 15000;
    const canvas = renderer.domElement;
    const videoStream = canvas.captureStream(30);
    const tracks = [...videoStream.getVideoTracks()];
    if (audioDest && audioDest.stream) {
      tracks.push(...audioDest.stream.getAudioTracks());
    }
    const fullStream = new MediaStream(tracks);

    let recorder = null;
    const chunks = [];
    try {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : (MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "");
      recorder = mime ? new MediaRecorder(fullStream, { mimeType: mime, videoBitsPerSecond: 5000000 }) : new MediaRecorder(fullStream);
      recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        try { if (osc1) osc1.stop(); if (osc2) osc2.stop(); } catch (e) {}
        const blob = new Blob(chunks, { type: "video/webm" });
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
      recorder.start();
    } catch (recErr) {
      console.error("Recorder fallback:", recErr);
    }

    const startTime = performance.now();
    let lastTime = startTime;

    function renderLoop(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / DURATION);
      const t = elapsed / 1000;

      if (mixer) mixer.update(dt);
      if (typeof window.animateScene === "function") {
        try { window.animateScene(t, progress); } catch (e) {}
      }
      renderer.render(scene, camera);

      uiProgress.style.width = Math.floor(progress * 100) + "%";
      uiTimer.textContent = Math.max(0, Math.ceil((DURATION - elapsed) / 1000)) + "s";

      if (progress < 1) {
        requestAnimationFrame(renderLoop);
      } else {
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        } else {
          document.getElementById("renderHud").style.display = "none";
          uiBadge.textContent = "READY";
          uiBadge.classList.add("ready");
          uiDownloadBtn.textContent = "Preview Complete";
        }
      }
    }

    requestAnimationFrame(renderLoop);
  }

  startStudioEngine();
})();
