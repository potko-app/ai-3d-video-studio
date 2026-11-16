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

  // UI Elements
  const uiTitle = document.getElementById("uiTitle");
  const uiBadge = document.getElementById("uiBadge");
  const uiStatus = document.getElementById("uiStatus");
  const uiProgress = document.getElementById("uiProgress");
  const uiTimer = document.getElementById("uiTimer");
  const uiDownloadBtn = document.getElementById("uiDownloadBtn");
  const previewContainer = document.getElementById("previewContainer");

  uiTitle.textContent = sceneData.title || "Kinetra3D Studio";

  // 2. Dynamically Load GLTFLoader for Real 3D .glb Studio Assets
  function loadGLTFLoaderScript() {
    return new Promise((resolve) => {
      if (THREE.GLTFLoader) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
      const t = setTimeout(() => resolve(false), 3000);
      s.onload = () => { clearTimeout(t); resolve(true); };
      s.onerror = () => { clearTimeout(t); resolve(false); };
      document.head.appendChild(s);
    });
  }

  // 3. Three.js Cinema WebGL Setup + Blender EEVEE-Style GLSL Rim Shader
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1280, 720);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  previewContainer.insertBefore(renderer.domElement, previewContainer.firstChild);

  const scene = new THREE.Scene();
  const themes = {
    cyber_neon: { bg: 0x060918, fog: 0x060918, key: 0x60a5fa, rim: 0xf43f5e },
    magical_forest: { bg: 0x061712, fog: 0x061712, key: 0x34d399, rim: 0x38bdf8 },
    sunset_golden: { bg: 0x1f0e06, fog: 0x1f0e06, key: 0xfbbf24, rim: 0xf97316 },
    space_cosmos: { bg: 0x04040c, fog: 0x04040c, key: 0xa78bfa, rim: 0x38bdf8 },
    studio_clean: { bg: 0x12141d, fog: 0x12141d, key: 0xfff7ed, rim: 0x818cf8 }
  };
  const activeTheme = themes[sceneData.atmosphere] || themes.studio_clean;
  scene.background = new THREE.Color(activeTheme.bg);
  scene.fog = new THREE.FogExp2(activeTheme.fog, 0.016);

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 250);
  camera.position.set(0, 2.2, 6.5);

  // Blender-Style 3-Point Studio Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.4));
  const keyLight = new THREE.DirectionalLight(activeTheme.key, 2.4);
  keyLight.position.set(6, 12, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(activeTheme.rim, 4.0, 28);
  rimLight.position.set(-5, 4, -4);
  scene.add(rimLight);

  // Blender EEVEE-Inspired Custom GLSL Fresnel Atmosphere Dome
  const glslDome = new THREE.Mesh(
    new THREE.SphereGeometry(45, 32, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(activeTheme.key).multiplyScalar(0.18) },
        bottomColor: { value: new THREE.Color(activeTheme.bg) }
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
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y * 0.5 + 0.5;
          gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 1.5)), 1.0);
        }
      `
    })
  );
  scene.add(glslDome);

  // 4. Built-in Open-Source .GLB Studio Asset Library
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

  function pickBestGLBModel() {
    const query = `${sceneData.title} ${sceneData.narration}`.toLowerCase();
    for (const item of GLB_LIBRARY) {
      if (item.keywords.some(k => query.includes(k))) return item;
    }
    return GLB_LIBRARY[GLB_LIBRARY.length - 1];
  }

  let mixer = null;
  let loadedModel = null;

  async function buildStudioGLBScene() {
    // Reflective Studio Pedestal
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.7, 0.25, 64),
      new THREE.MeshStandardMaterial({ color: 0x181820, metalness: 0.85, roughness: 0.18 })
    );
    stage.position.y = -1.2;
    stage.receiveShadow = true;
    scene.add(stage);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.45, 0.035, 16, 100),
      new THREE.MeshBasicMaterial({ color: activeTheme.key })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.06;
    scene.add(ring);

    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(220 * 3);
    for (let i = 0; i < 660; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 24;
      pPos[i + 1] = -1 + Math.random() * 12;
      pPos[i + 2] = (Math.random() - 0.5) * 24;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const stars = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09 }));
    scene.add(stars);

    const hasLoader = await loadGLTFLoaderScript();
    const chosen = pickBestGLBModel();

    await new Promise((resolve) => {
      if (!hasLoader || !THREE.GLTFLoader) return resolve();
      let finished = false;
      const done = () => { if (!finished) { finished = true; resolve(); } };
      setTimeout(done, 3500); // Hard 3.5s safety limit so it never hangs

      const loader = new THREE.GLTFLoader();
      loader.load(
        chosen.url,
        (gltf) => {
          if (finished) return;
          loadedModel = gltf.scene;
          const box = new THREE.Box3().setFromObject(loadedModel);
          const size = box.getSize(new THREE.Vector3()).length();
          const scale = 2.6 / (size || 1);
          loadedModel.scale.setScalar(scale);

          const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
          loadedModel.position.set(-center.x, -box.min.y * scale - 1.05, -center.z);

          loadedModel.traverse(c => {
            if (c.isMesh) {
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
          scene.add(loadedModel);

          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(loadedModel);
            const clip = (chosen.clip && THREE.AnimationClip.findByName(gltf.animations, chosen.clip)) || gltf.animations[0];
            mixer.clipAction(clip).play();
          }
          done();
        },
        undefined,
        () => done()
      );
    });

    if (!loadedModel) {
      loadedModel = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.9, 0.28, 140, 32),
        new THREE.MeshStandardMaterial({ color: activeTheme.key, metalness: 0.88, roughness: 0.12 })
      );
      loadedModel.position.y = 0.35;
      scene.add(loadedModel);
    }

    window.animateScene = function (t, p) {
      if (!mixer && loadedModel) {
        loadedModel.rotation.y = t * 0.7;
      }
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.02);
      stars.rotation.y = t * 0.08;
      const angle = p * Math.PI * 1.5 - 0.75;
      camera.position.set(Math.sin(angle) * 5.2, 1.65 + Math.sin(t * 0.9) * 0.25, Math.cos(angle) * 5.2);
      camera.lookAt(0, 0.3, 0);
    };
  }

  // 5. Studio Voice Mastering Chain (Deep Bass Punch + Vocal Clarity + Compressor)
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
    masterGain.connect(ctx.destination);

    return warmthEQ;
  }

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
        detune = 35;
        pauseAfter = 0.42;
      } else if (trimmed.endsWith("!")) {
        rate = 1.05;
        detune = 20;
        pauseAfter = 0.38;
      } else if (trimmed.includes("...") || trimmed.endsWith("…")) {
        rate = 0.93;
        detune = -30;
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

  // 6. Master Production & Live Preview Loop
  async function runEngine() {
    uiStatus.textContent = "Loading 3D Studio Assets & Voice...";
    let customLoaded = false;
    if (sceneData.code && sceneData.code.trim().length > 20) {
      try {
        const buildCustom = new Function("scene", "camera", "renderer", "THREE", sceneData.code);
        buildCustom(scene, camera, renderer, THREE);
        customLoaded = true;
      } catch (err) {
        console.error("Custom scene error, loading studio GLB asset:", err);
      }
    }
    if (!customLoaded) {
      await buildStudioGLBScene();
    }

    uiStatus.textContent = "Rendering 3D Cinema & Studio Voice...";

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const audioDest = audioCtx.createMediaStreamDestination();

    const padFilter = audioCtx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 280;
    const padGain = audioCtx.createGain();
    padGain.gain.value = 0.015;
    padFilter.connect(padGain);
    padGain.connect(audioDest);

    const osc1 = audioCtx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.value = 130.81;
    const osc2 = audioCtx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 196.00;
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
    let lastTime = startTime;
    recorder.start();

    function frameStep(now) {
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
        requestAnimationFrame(frameStep);
      } else {
        recorder.stop();
      }
    }

    requestAnimationFrame(frameStep);
  }

  runEngine();
})();
