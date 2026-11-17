(function () {
  "use strict";

  // ============================================================================
  // 1. PAYLOAD DECODER (UTF-8 & URL-Safe Base64)
  // ============================================================================
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
    console.error("Scene payload parse error:", err);
  }

  // UI Bindings (Matches docs/index.html)
  const uiTitle = document.getElementById("uiTitle");
  const uiBadge = document.getElementById("uiBadge");
  const uiStatus = document.getElementById("uiStatus");
  const uiProgress = document.getElementById("uiProgress");
  const uiTimer = document.getElementById("uiTimer");
  const uiDownloadBtn = document.getElementById("uiDownloadBtn");
  const previewContainer = document.getElementById("previewContainer");

  if (uiTitle) uiTitle.textContent = sceneData.title || "Kinetra3D Studio";

  // ============================================================================
  // 2. MATHEMATICAL EASING & KINEMATIC INTERPOLATION LOGIC (Cycles-Inspired)
  // ============================================================================
  const MathLogic = {
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    smoothstep: (edge0, edge1, x) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    },
    easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    elasticOut: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    },
    beat: (t, start, end) => MathLogic.smoothstep(start, end, t)
  };

  // ============================================================================
  // 3. WEBGL RENDERER & PHOTOMETRIC COLOR MANAGEMENT LOGIC
  // ============================================================================
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(1280, 720);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputEncoding = THREE.sRGBEncoding;
  previewContainer.insertBefore(renderer.domElement, previewContainer.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 250);
  camera.position.set(0, 2.2, 6.5);

  const ATMOSPHERES = {
    cyber_neon:     { bg: 0x070b18, key: 0x60a5fa, rim: 0xf43f5e, ground: 0x0f172a },
    magical_forest: { bg: 0x071a12, key: 0x34d399, rim: 0xfbbf24, ground: 0x064e3b },
    sunset_golden:  { bg: 0x230f07, key: 0xfbbf24, rim: 0xf97316, ground: 0x451a03 },
    space_cosmos:   { bg: 0x04040d, key: 0xa78bfa, rim: 0x38bdf8, ground: 0x090d16 },
    studio_clean:   { bg: 0x161923, key: 0xfff8eb, rim: 0x818cf8, ground: 0x1e2230 }
  };
  const theme = ATMOSPHERES[sceneData.atmosphere] || ATMOSPHERES.studio_clean;
  scene.background = new THREE.Color(theme.bg);

  // Base Studio Light Rig (Kept separate so AI lights can blend or replace cleanly)
  const studioRig = new THREE.Group();
  studioRig.name = "StudioBaseRig";
  const hemiLight = new THREE.HemisphereLight(0xffffff, theme.ground, 0.75);
  const keyLight = new THREE.DirectionalLight(theme.key, 1.35);
  keyLight.position.set(6, 12, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.0005;
  const rimLight = new THREE.PointLight(theme.rim, 1.8, 28, 2);
  rimLight.position.set(-5, 4.5, -4);
  studioRig.add(hemiLight, keyLight, rimLight);
  scene.add(studioRig);

  // Photometric Energy Conservation & Color Calibration Pass
  // Prevents whiteout by conserving PBR albedo reflectance and balancing total scene lux
  function calibratePhotometricScene() {
    let customDirectionalEnergy = 0;
    let customAmbientEnergy = 0;

    scene.traverse((node) => {
      if (node.isLight && node.parent !== studioRig) {
        if (node.isDirectionalLight) customDirectionalEnergy += node.intensity;
        if (node.isAmbientLight || node.isHemisphereLight) customAmbientEnergy += node.intensity;
      }

      // Enforce Blender Principled BSDF Albedo Energy Conservation (Max reflectance <= 0.85)
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          if (m.color) {
            const lum = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
            if (lum > 0.85) m.color.multiplyScalar(0.85 / lum);
          }
          if (m.emissive && m.emissiveIntensity > 1.2) {
            m.emissiveIntensity = 1.2;
          }
          if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
            if (m.roughness === undefined) m.roughness = 0.45;
          }
        });
      }
    });

    // If AI added its own lighting, proportionally scale down base rig instead of blinding the scene
    if (customDirectionalEnergy > 0 || customAmbientEnergy > 0) {
      const totalDir = customDirectionalEnergy + keyLight.intensity;
      if (totalDir > 2.2) {
        const scale = 2.0 / totalDir;
        keyLight.intensity *= scale;
        hemiLight.intensity *= 0.45;
      }
      if (customAmbientEnergy > 1.0) {
        hemiLight.intensity = 0.15;
      }
    }
  }

  // ============================================================================
  // 4. BLENDER-STYLE PROCEDURAL BUILDER, TEXTURE & CHARACTER RIGGING ENGINE
  // ============================================================================
  const animatedCharacters = [];
  const secondaryAnimators = [];

  const Studio = {
    Math: MathLogic,

    // Procedural PBR Material Generator (Matte, Glossy, Metal, Glass, Neon)
    paint(colorHex, finish = "standard") {
      const c = new THREE.Color(colorHex);
      switch (finish) {
        case "glossy":
          return new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.1 });
        case "metal":
          return new THREE.MeshStandardMaterial({ color: c, roughness: 0.22, metalness: 0.88 });
        case "matte":
          return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.02 });
        case "glass":
          return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.55 });
        case "neon":
          return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.3 });
        default:
          return new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.12 });
      }
    },

    // Procedural Canvas Texture (Chalkboard, Wood, Label/Name Tag on any object)
    createTextTexture(text, opts = {}) {
      const canvas = document.createElement("canvas");
      canvas.width = opts.width || 512;
      canvas.height = opts.height || 256;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = opts.bg || "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (opts.border) {
        ctx.strokeStyle = opts.border;
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
      }

      ctx.fillStyle = opts.color || "#ffffff";
      ctx.font = `bold ${opts.fontSize || 48}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const lines = String(text).split("\n");
      const lineHeight = (opts.fontSize || 48) * 1.25;
      const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, startY + i * lineHeight));

      const tex = new THREE.CanvasTexture(canvas);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    },

    // Attach Custom Name/Label Plate to any 3D Character or Object
    label(targetMesh, text, opts = {}) {
      const tex = Studio.createTextTexture(text, opts);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(opts.w || 1.2, opts.h || 0.5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      plane.position.set(opts.x || 0, opts.y || 0, opts.z || 0.52);
      targetMesh.add(plane);
      return plane;
    },

    // Blender Lathe Modifier (Creates smooth revolved 3D shapes: cups, vases, domes, pawns)
    lathe(profilePoints, segments = 48, material = null) {
      const pts = profilePoints.map(([x, y]) => new THREE.Vector2(x, y));
      const geo = new THREE.LatheGeometry(pts, segments);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material || Studio.paint(0x6366f1, "glossy"));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    },

    // Kinematic Character Rig Builder (Body + Expressive Eyes + Audio-Synced Mouth + Name Tag)
    character(opts = {}) {
      const root = new THREE.Group();
      const bodyGroup = new THREE.Group();
      root.add(bodyGroup);

      const color = opts.color || 0x3b82f6;
      const mat = Studio.paint(color, opts.finish || "glossy");

      let bodyMesh;
      if (opts.shape === "cup") {
        bodyMesh = Studio.lathe([[0, 0], [0.42, 0], [0.55, 0.95], [0.48, 0.95], [0.36, 0.12], [0, 0.12]], 48, mat);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 16, 32, Math.PI), mat);
        handle.position.set(0.48, 0.5, 0);
        handle.rotation.z = -Math.PI / 2;
        bodyGroup.add(handle);
      } else if (opts.shape === "biscuit" || opts.shape === "disc") {
        bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.22, 36), mat);
        bodyMesh.rotation.x = Math.PI / 2;
        bodyMesh.position.y = 0.55;
      } else {
        bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 32), mat);
        bodyMesh.scale.set(1, opts.tall ? 1.35 : 1.05, 0.92);
        bodyMesh.position.y = 0.55;
      }
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      bodyGroup.add(bodyMesh);

      // Expressive Eyes + Pupils + Brows
      const faceZ = opts.shape === "disc" ? 0.13 : 0.46;
      const eyeY = 0.65;
      const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });

      const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), eyeWhiteMat);
      leftEye.position.set(-0.18, eyeY, faceZ);
      const rightEye = leftEye.clone();
      rightEye.position.x = 0.18;

      const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), pupilMat);
      leftPupil.position.set(0, 0, 0.08);
      leftEye.add(leftPupil);

      const rightPupil = leftPupil.clone();
      rightEye.add(rightPupil);

      bodyGroup.add(leftEye, rightEye);

      // Audio-Driven Lip-Sync Mouth Rig
      const mouthPivot = new THREE.Group();
      mouthPivot.position.set(0, 0.42, faceZ + 0.03);
      const mouthMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.06, 0.05),
        new THREE.MeshBasicMaterial({ color: 0x1e1b4b })
      );
      mouthPivot.add(mouthMesh);
      bodyGroup.add(mouthPivot);

      // Optional Custom Name Printed on Character
      if (opts.name) {
        Studio.label(bodyGroup, opts.name, {
          w: 0.75, h: 0.26, y: 0.2, z: faceZ + 0.04,
          bg: "rgba(0,0,0,0.65)", color: "#ffffff", fontSize: 44
        });
      }

      const rig = {
        root,
        bodyGroup,
        leftEye,
        rightEye,
        mouthPivot,
        speaking: opts.speaking !== false,
        phase: Math.random() * Math.PI * 2,
        bounce(t, speed = 4, height = 0.12) {
          const s = Math.abs(Math.sin(t * speed + rig.phase));
          bodyGroup.position.y = s * height;
          bodyGroup.scale.set(1 + (1 - s) * 0.06, 1 - (1 - s) * 0.06, 1 + (1 - s) * 0.06);
        }
      };

      animatedCharacters.push(rig);
      scene.add(root);
      return rig;
    }
  };

  // Expose Studio globally so AI code can use Studio.* directly
  window.Studio = Studio;

  // ============================================================================
  // 5. FALLBACK STUDIO STAGE (Only if AI sends no custom 3D code)
  // ============================================================================
  function buildDefaultStudioShowcase() {
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.5, 0.25, 64),
      Studio.paint(0x1e2230, "metal")
    );
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    scene.add(floor);

    const hero = Studio.character({
      shape: "cup",
      color: 0xf59e0b,
      finish: "glossy",
      name: sceneData.title.slice(0, 14) || "KINETRA 3D"
    });
    hero.root.position.set(0, 0, 0);

    window.animateScene = function (t, p) {
      hero.bounce(t, 3.2, 0.1);
      hero.root.rotation.y = Math.sin(t * 1.1) * 0.45;
      const angle = p * Math.PI * 1.2 - 0.6;
      camera.position.set(Math.sin(angle) * 4.8, 1.8, Math.cos(angle) * 4.8);
      camera.lookAt(0, 0.6, 0);
    };
  }

  // ============================================================================
  // 6. STUDIO VOICE ENGINE + REAL-TIME WAVEFORM LIP-SYNC ANALYSER
  // ============================================================================
  let voiceAnalyser = null;
  let voiceTimeData = null;

  function getLiveVoiceEnergy() {
    if (!voiceAnalyser || !voiceTimeData) return 0;
    voiceAnalyser.getByteTimeDomainData(voiceTimeData);
    let sum = 0;
    for (let i = 0; i < voiceTimeData.length; i++) {
      const v = (voiceTimeData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / voiceTimeData.length) * 6.5);
  }

  function createStudioVoiceBus(ctx, dest) {
    const warmthEQ = ctx.createBiquadFilter();
    warmthEQ.type = "lowshelf";
    warmthEQ.frequency.value = 165;
    warmthEQ.gain.value = 5.0;

    const clarityEQ = ctx.createBiquadFilter();
    clarityEQ.type = "peaking";
    clarityEQ.frequency.value = 3100;
    clarityEQ.Q.value = 1.1;
    clarityEQ.gain.value = 3.5;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;

    voiceAnalyser = ctx.createAnalyser();
    voiceAnalyser.fftSize = 256;
    voiceTimeData = new Uint8Array(voiceAnalyser.frequencyBinCount);

    const masterGain = ctx.createGain();
    masterGain.gain.value = 1.3;

    warmthEQ.connect(clarityEQ);
    clarityEQ.connect(compressor);
    compressor.connect(voiceAnalyser);
    voiceAnalyser.connect(masterGain);
    masterGain.connect(dest);
    try { masterGain.connect(ctx.destination); } catch (e) {}

    return warmthEQ;
  }

  function parseEmotionalBeats(text) {
    const clean = text.replace(/\[.*?\]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const sentences = clean.match(/[^।!?…]+(?:[।!?…]+|$)/g) || [clean];
    return sentences.map((s) => {
      const trimmed = s.trim();
      let rate = 1.0, detune = 0, pauseAfter = 0.32;
      if (trimmed.endsWith("?")) { rate = 1.03; detune = 35; pauseAfter = 0.4; }
      else if (trimmed.endsWith("!")) { rate = 1.05; detune = 20; pauseAfter = 0.36; }
      else if (trimmed.includes("...") || trimmed.endsWith("…")) { rate = 0.93; detune = -30; pauseAfter = 0.45; }
      return { text: trimmed, rate, detune, pauseAfter };
    }).filter((b) => b.text.length > 0).slice(0, 8);
  }

  async function fetchNeuralVoice(ctx, text) {
    const isHindi = /[\u0900-\u097F]/.test(text);
    const voice = isHindi ? "Aditi" : "Matthew";
    const endpoints = [
      `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`,
      `https://text.pollinations.ai/${encodeURIComponent("Read aloud naturally in " + (isHindi ? "Hindi" : "English") + ": " + text)}?model=openai-audio&voice=onyx`
    ];
    for (const url of endpoints) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 3500);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        if (arr.byteLength < 500) continue;
        return await ctx.decodeAudioData(arr);
      } catch (e) {}
    }
    return null;
  }

  // ============================================================================
  // 7. MASTER EXECUTION & RECORDING PIPELINE
  // ============================================================================
  async function startStudioEngine() {
    if (uiStatus) uiStatus.textContent = "Building 3D Scene...";
    let customBuilt = false;

    if (sceneData.code && sceneData.code.trim().length > 20) {
      try {
        const runSceneBuilder = new Function("scene", "camera", "renderer", "THREE", "Studio", sceneData.code);
        runSceneBuilder(scene, camera, renderer, THREE, Studio);
        customBuilt = true;
      } catch (err) {
        console.error("Custom scene script error:", err);
      }
    }

    if (!customBuilt) {
      buildDefaultStudioShowcase();
    }

    // Apply Photometric Color & Lighting Calibration after scene construction
    calibratePhotometricScene();
    renderer.render(scene, camera);

    if (uiStatus) uiStatus.textContent = "Rendering 3D Video & Studio Voice...";

    let audioCtx = null;
    let audioDest = null;
    let osc1 = null;
    let osc2 = null;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
        const unlock = () => { if (audioCtx) audioCtx.resume().catch(() => {}); };
        document.addEventListener("touchstart", unlock, { once: true });
        document.addEventListener("click", unlock, { once: true });
      }
      audioDest = audioCtx.createMediaStreamDestination();

      // Subtle Ambient Bed
      const padFilter = audioCtx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.value = 260;
      const padGain = audioCtx.createGain();
      padGain.gain.value = 0.015;
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

      // Parallel Neural Voice Loading & Scheduling
      const beats = parseEmotionalBeats(sceneData.narration || "");
      if (beats.length > 0) {
        const voiceBus = createStudioVoiceBus(audioCtx, audioDest);
        const clips = await Promise.all(beats.map((b) => fetchNeuralVoice(audioCtx, b.text)));
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
      console.warn("Audio pipeline warning:", audioErr);
    }

    const DURATION = 15000;
    const canvas = renderer.domElement;
    const videoStream = canvas.captureStream(30);
    const tracks = [...videoStream.getVideoTracks()];
    if (audioDest && audioDest.stream) tracks.push(...audioDest.stream.getAudioTracks());
    const fullStream = new MediaStream(tracks);

    let recorder = null;
    const chunks = [];
    try {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : (MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "");
      recorder = mime
        ? new MediaRecorder(fullStream, { mimeType: mime, videoBitsPerSecond: 5500000 })
        : new MediaRecorder(fullStream);

      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        try { if (osc1) osc1.stop(); if (osc2) osc2.stop(); } catch (e) {}
        const blob = new Blob(chunks, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(blob);

        const hud = document.getElementById("renderHud");
        if (hud) hud.style.display = "none";
        canvas.style.display = "none";

        const player = document.getElementById("finalPlayer");
        if (player) {
          player.src = videoUrl;
          player.style.display = "block";
          player.play().catch(() => {});
        }

        if (uiBadge) {
          uiBadge.textContent = "READY";
          uiBadge.classList.add("ready");
        }
        if (uiDownloadBtn) {
          uiDownloadBtn.href = videoUrl;
          uiDownloadBtn.download = (sceneData.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "kinetra3d") + ".webm";
          uiDownloadBtn.textContent = "Download Video";
          uiDownloadBtn.classList.remove("locked");
        }
      };
      recorder.start();
    } catch (recErr) {
      console.error("MediaRecorder error:", recErr);
    }

    const startTime = performance.now();

    function renderLoop(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / DURATION);
      const t = elapsed / 1000;

      // Secondary Motion: Idle Breathing, Blinking & Real-Time Audio Lip-Sync
      const voiceEnergy = getLiveVoiceEnergy();
      const blink = Math.sin(t * 1.9) > 0.985 ? 0.12 : 1.0;

      animatedCharacters.forEach((rig) => {
        rig.leftEye.scale.y = blink;
        rig.rightEye.scale.y = blink;
        if (rig.speaking) {
          rig.mouthPivot.scale.y = 0.6 + voiceEnergy * 3.2;
        }
      });

      secondaryAnimators.forEach((fn) => { try { fn(t, progress); } catch (e) {} });

      if (typeof window.animateScene === "function") {
        try { window.animateScene(t, progress); } catch (e) {}
      }

      renderer.render(scene, camera);

      if (uiProgress) uiProgress.style.width = Math.floor(progress * 100) + "%";
      if (uiTimer) uiTimer.textContent = Math.max(0, Math.ceil((DURATION - elapsed) / 1000)) + "s";

      if (progress < 1) {
        requestAnimationFrame(renderLoop);
      } else if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    }

    requestAnimationFrame(renderLoop);
  }

  startStudioEngine();
})();
