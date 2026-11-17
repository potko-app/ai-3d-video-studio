(function () {
  "use strict";

  // ============================================================================
  // 1. UNIVERSAL THREE.JS COMPATIBILITY LAYER (Prevents AI Code Crashes)
  // ============================================================================
  if (typeof THREE !== "undefined") {
    if (!THREE.CapsuleGeometry) {
      THREE.CapsuleGeometry = function (radius = 0.5, length = 1, capSegments = 8, radialSegments = 16) {
        const points = [];
        const halfLen = length * 0.5;
        for (let i = 0; i <= capSegments; i++) {
          const a = (i / capSegments) * (Math.PI * 0.5);
          points.push(new THREE.Vector2(Math.sin(a) * radius, -halfLen - Math.cos(a) * radius));
        }
        for (let i = 0; i <= capSegments; i++) {
          const a = (i / capSegments) * (Math.PI * 0.5);
          points.push(new THREE.Vector2(Math.cos(a) * radius, halfLen + Math.sin(a) * radius));
        }
        const geo = new THREE.LatheGeometry(points, radialSegments);
        geo.computeVertexNormals();
        return geo;
      }
    }
  }

  // ============================================================================
  // 2. PAYLOAD DECODER
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

  let sceneData = { title: "Kinetra3D Cinema", narration: "", atmosphere: "studio_clean", code: "" };
  try {
    const idx = window.location.href.indexOf("#scene=");
    if (idx !== -1) {
      const parsed = decodePayload(window.location.href.slice(idx + 7));
      if (parsed) sceneData = { ...sceneData, ...parsed };
    }
  } catch (err) {}

  const uiTitle = document.getElementById("uiTitle");
  if (uiTitle) uiTitle.textContent = sceneData.title || "Kinetra3D Studio";

  // ============================================================================
  // 3. CORE RENDERING ENGINE & AUTO-CAMERA FRAMING
  // ============================================================================
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setSize(1280, 720);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById("previewContainer").insertBefore(renderer.domElement, document.getElementById("previewContainer").firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 300);
  camera.position.set(0, 2.2, 6.5);

  const ATMOSPHERES = {
    cyber_neon:     { bg: 0x090e1f, key: 0x60a5fa, rim: 0xf43f5e, ground: 0x1e293b },
    magical_forest: { bg: 0x0a2117, key: 0x34d399, rim: 0xfbbf24, ground: 0x064e3b },
    sunset_golden:  { bg: 0x29130a, key: 0xfbbf24, rim: 0xf97316, ground: 0x451a03 },
    space_cosmos:   { bg: 0x060612, key: 0xa78bfa, rim: 0x38bdf8, ground: 0x0f172a },
    studio_clean:   { bg: 0x171c2b, key: 0xfff8eb, rim: 0x818cf8, ground: 0x1e2536 }
  };
  const theme = ATMOSPHERES[sceneData.atmosphere] || ATMOSPHERES.studio_clean;
  scene.background = new THREE.Color(theme.bg);

  const studioRig = new THREE.Group();
  const hemiLight = new THREE.HemisphereLight(0xffffff, theme.ground, 0.9);
  const keyLight = new THREE.DirectionalLight(theme.key, 1.45);
  keyLight.position.set(6, 12, 8);
  keyLight.castShadow = true;
  const rimLight = new THREE.PointLight(theme.rim, 1.8, 30, 2);
  rimLight.position.set(-5, 4.5, -4);
  studioRig.add(hemiLight, keyLight, rimLight);
  scene.add(studioRig);

  function sanitizeAICode(rawCode) {
    return rawCode
      .replace(/(?:const|let|var)\s+scene\s*=\s*new\s+THREE\.Scene\s*\([^)]*\)\s*;?/g, "")
      .replace(/(?:const|let|var)\s+camera\s*=\s*new\s+THREE\.PerspectiveCamera\s*\([^)]*\)\s*;?/g, "")
      .replace(/(?:const|let|var)\s+renderer\s*=\s*new\s+THREE\.WebGLRenderer\s*\([^)]*\)\s*;?/g, "")
      .replace(/document\.body\.appendChild\s*\(\s*renderer\.domElement\s*\)\s*;?/g, "")
      .replace(/requestAnimationFrame\s*\([^)]*\)\s*;?/g, "");
  }

  function calibrateSceneAndCamera(hasCustomAnimation) {
    let customLights = 0;
    let meshCount = 0;
    const worldBox = new THREE.Box3();

    if (scene.background && scene.background.isColor && (0.2126 * scene.background.r + 0.7152 * scene.background.g + 0.0722 * scene.background.b > 0.5)) {
      scene.background.setHex(theme.bg);
    }

    scene.traverse((node) => {
      if (node.isLight && node.parent !== studioRig) {
        customLights++;
        if (node.intensity > 1.4) node.intensity = 1.25;
      }
      if (node.isMesh) {
        meshCount++;
        worldBox.expandByObject(node);
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(m => {
            if (m.color && (0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b > 0.84)) m.color.multiplyScalar(0.8);
            if (m.isMeshBasicMaterial && !m.map) {
              const shaded = new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.45, metalness: 0.1 });
              node.material = shaded;
            }
          });
        }
      }
    });

    if (customLights > 0) { keyLight.intensity = 0.6; hemiLight.intensity = 0.4; }

    if (!hasCustomAnimation && meshCount > 0 && !worldBox.isEmpty()) {
      const center = worldBox.getCenter(new THREE.Vector3());
      const size = worldBox.getSize(new THREE.Vector3()).length();
      const dist = Math.max(4.5, Math.min(15, size * 1.3));
      window.animateScene = function (t, p) {
        const angle = p * Math.PI * 1.1 - 0.55;
        camera.position.set(center.x + Math.sin(angle) * dist, center.y + dist * 0.3 + Math.sin(t * 1.2) * 0.2, center.z + Math.cos(angle) * dist);
        camera.lookAt(center);
      };
    }
    return meshCount;
  }

  // ============================================================================
  // 4. STUDIO TOOLKIT (Robust & AI-Proof)
  // ============================================================================
  const animatedCharacters = [];
  const Studio = {
    paint: (cHex, finish = "standard") => {
      const c = new THREE.Color(cHex);
      if (finish === "glossy") return new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.1 });
      if (finish === "metal") return new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, metalness: 0.85 });
      if (finish === "neon") return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.3 });
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.12 });
    },
    createTextTexture(text, opts = {}) {
      const cvs = document.createElement("canvas");
      cvs.width = opts.width || 512; cvs.height = opts.height || 256;
      const ctx = cvs.getContext("2d");
      ctx.fillStyle = opts.bg || "#1e293b"; ctx.fillRect(0, 0, cvs.width, cvs.height);
      ctx.fillStyle = opts.color || "#ffffff";
      ctx.font = `bold ${opts.fontSize || 48}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const lines = String(text).split("\n");
      const lh = (opts.fontSize || 48) * 1.25;
      const startY = cvs.height / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((line, i) => ctx.fillText(line, cvs.width / 2, startY + i * lh));
      const tex = new THREE.CanvasTexture(cvs);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    },
    label: (target, text, opts = {}) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(opts.w || 1.2, opts.h || 0.5), new THREE.MeshBasicMaterial({ map: Studio.createTextTexture(text, opts), transparent: true }));
      p.position.set(opts.x || 0, opts.y || 0, opts.z || 0.52);
      target.add(p);
    },
    lathe(profilePoints, segments = 48, material = null) {
      const pts = profilePoints.map(([x, y]) => new THREE.Vector2(x, y));
      const geo = new THREE.LatheGeometry(pts, segments);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material || Studio.paint(0x6366f1, "glossy"));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    },
    character(opts = {}) {
      const root = new THREE.Group();
      const bodyGroup = new THREE.Group();
      root.add(bodyGroup);
      const mat = Studio.paint(opts.color || 0x3b82f6, opts.finish || "glossy");
      
      let body;
      // Handle different shapes safely
      if (opts.shape === "cup") {
        body = Studio.lathe([[0, 0], [0.4, 0], [0.5, 0.9], [0.4, 0.9], [0.3, 0.1], [0, 0.1]], 32, mat);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 16, 32, Math.PI), mat);
        handle.position.set(0.45, 0.5, 0); handle.rotation.z = -Math.PI / 2;
        bodyGroup.add(handle);
      } else if (opts.shape === "biscuit" || opts.shape === "disc") {
        body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32), mat);
        body.rotation.x = Math.PI / 2; body.position.y = 0.5;
      } else {
        // Default capsule shape
        body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.4, 8, 16), mat);
        body.position.y = 0.65;
      }
      body.castShadow = true;
      bodyGroup.add(body);

      const ew = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pw = new THREE.MeshBasicMaterial({ color: 0x000000 });
      // Adjust eye positions based on shape
      const eyeY = opts.shape === "biscuit" || opts.shape === "disc" ? 0.5 : (opts.shape === "cup" ? 0.6 : 0.8);
      const eyeZ = opts.shape === "biscuit" || opts.shape === "disc" ? 0.1 : (opts.shape === "cup" ? 0.5 : 0.4);
      
      const le = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), ew);
      le.position.set(-0.18, eyeY, eyeZ);
      const re = le.clone(); re.position.x = 0.18;
      const lp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), pw);
      lp.position.z = 0.1; le.add(lp); re.add(lp.clone());
      bodyGroup.add(le, re);

      const mouthPivot = new THREE.Group();
      mouthPivot.position.set(0, eyeY - 0.25, eyeZ + 0.05);
      mouthPivot.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x111111 })));
      bodyGroup.add(mouthPivot);

      if (opts.name) Studio.label(bodyGroup, opts.name, { w: 0.8, h: 0.25, y: eyeY - 0.5, z: eyeZ + 0.08, bg: "rgba(0,0,0,0.7)" });

      const rig = {
        root, leftEye: le, rightEye: re, mouthPivot,
        speaking: opts.speaking !== false,
        phase: Math.random() * Math.PI,
        bounce: (t, speed = 4, height = 0.12) => { bodyGroup.position.y = Math.abs(Math.sin(t * speed + rig.phase)) * height; }
      };
      animatedCharacters.push(rig);
      scene.add(root);
      return rig;
    }
  };
  window.Studio = Studio;

  // ============================================================================
  // 5. MASTER VOICE & LIP-SYNC ENGINE
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
    return Math.min(1, Math.sqrt(sum / voiceTimeData.length) * 8.5); 
  }

  function createPowerfulVoiceBus(ctx, dest) {
    const subPunch = ctx.createBiquadFilter();
    subPunch.type = "lowshelf";
    subPunch.frequency.value = 155;
    subPunch.gain.value = 7.5; 

    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 2900;
    presence.Q.value = 1.0;
    presence.gain.value = 5.0; 

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 5.0;

    voiceAnalyser = ctx.createAnalyser();
    voiceAnalyser.fftSize = 256;
    voiceTimeData = new Uint8Array(voiceAnalyser.frequencyBinCount);

    const boostGain = ctx.createGain();
    boostGain.gain.value = 2.5; 

    subPunch.connect(presence);
    presence.connect(compressor);
    compressor.connect(voiceAnalyser);
    voiceAnalyser.connect(boostGain);
    boostGain.connect(dest);
    try { boostGain.connect(ctx.destination); } catch(e){}
    return subPunch;
  }

  async function fetchEmotionalNeuralVoice(ctx, text) {
    const isHindi = /[\u0900-\u097F]/.test(text);
    const endpoints = [
      `https://text.pollinations.ai/${encodeURIComponent("Speak with strong, dramatic emotion and energy in " + (isHindi ? "Hindi" : "English") + ": " + text)}?model=openai-audio&voice=onyx`,
      `https://api.streamelements.com/kappa/v2/speech?voice=${isHindi ? "Aditi" : "Matthew"}&text=${encodeURIComponent(text)}`
    ];
    for (const url of endpoints) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          if (arr.byteLength > 600) return await ctx.decodeAudioData(arr);
        }
      } catch (e) {}
    }
    return null;
  }

  // ============================================================================
  // 6. RENDER LOOP & SAFE RECORDER
  // ============================================================================
  async function startEngine() {
    if (sceneData.code && sceneData.code.trim().length > 20) {
      try {
        const runSceneBuilder = new Function("scene", "camera", "renderer", "THREE", "Studio", sanitizeAICode(sceneData.code));
        runSceneBuilder(scene, camera, renderer, THREE, Studio);
      } catch (err) {
        console.error("AI Scene Error:", err);
      }
    }
    const meshCount = calibrateSceneAndCamera(typeof window.animateScene === "function");
    if (meshCount === 0) {
      const hero = Studio.character({ color: 0xf59e0b, name: sceneData.title || "KINETRA" });
      window.animateScene = (t, p) => { hero.bounce(t); camera.position.x = Math.sin(t) * 4; camera.lookAt(0,1,0); };
    }

    let audioCtx = null, audioDest = null, osc1 = null, audioActive = false;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const unlockAudio = () => { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(()=>{}); };
      unlockAudio();
      document.addEventListener("touchstart", unlockAudio, { passive: true });
      document.addEventListener("click", unlockAudio, { passive: true });

      audioDest = audioCtx.createMediaStreamDestination();
      
      const padF = audioCtx.createBiquadFilter(); padF.type="lowpass"; padF.frequency.value = 180;
      const padG = audioCtx.createGain(); padG.gain.value = 0.012;
      padF.connect(padG); padG.connect(audioDest);
      osc1 = audioCtx.createOscillator(); osc1.frequency.value = 98;
      osc1.connect(padF); osc1.start();

      const text = sceneData.narration.replace(/\[.*?\]/g, " ").trim();
      if (text) {
        const voiceBus = createPowerfulVoiceBus(audioCtx, audioDest);
        const clip = await fetchEmotionalNeuralVoice(audioCtx, text);
        if (clip) {
          const scheduleClip = () => {
            const src = audioCtx.createBufferSource();
            src.buffer = clip;
            src.connect(voiceBus);
            src.start(audioCtx.currentTime + 0.1);
          };
          if (audioCtx.state === "running") scheduleClip();
          else document.addEventListener("touchstart", () => audioCtx.resume().then(scheduleClip), { once: true });
        }
      }
      audioActive = (audioCtx.state === "running");
    } catch(e){}

    const DURATION = 15000;
    const canvas = renderer.domElement;
    const tracks = [...canvas.captureStream(30).getVideoTracks()];
    if (audioActive && audioDest) tracks.push(...audioDest.stream.getAudioTracks());
    
    let recorder = null;
    const chunks = [];
    try {
      const mime = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/mp4", "video/webm"].find(m => MediaRecorder.isTypeSupported(m)) || "";
      recorder = mime ? new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 4500000 }) : new MediaRecorder(new MediaStream(tracks));
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        try { if(osc1) osc1.stop(); } catch(e){}
        const blob = new Blob(chunks, { type: mime.includes("mp4") ? "video/mp4" : "video/webm" });
        if (blob.size > 1000) {
          const url = URL.createObjectURL(blob);
          const btn = document.getElementById("uiDownloadBtn");
          if (btn) { btn.href = url; btn.download = "kinetra3d_video." + (mime.includes("mp4") ? "mp4" : "webm"); btn.classList.remove("locked"); }
          const p = document.getElementById("finalPlayer");
          if (p) { p.src = url; p.style.display = "block"; canvas.style.display = "none"; p.play().catch(()=>{}); }
        }
        const hud = document.getElementById("renderHud");
        if (hud) hud.style.display = "none";
        const badge = document.getElementById("uiBadge");
        if (badge) { badge.textContent = "READY"; badge.classList.add("ready"); }
      };
      recorder.start(250); 
    } catch(e){}

    const startT = performance.now();
    let stopped = false;
    function renderLoop(now) {
      const el = now - startT;
      const p = Math.min(1, el / DURATION);
      const t = el / 1000;

      const vE = getLiveVoiceEnergy();
      const blink = Math.sin(t * 1.9) > 0.98 ? 0.1 : 1.0;
      animatedCharacters.forEach((r) => {
        r.leftEye.scale.y = blink; r.rightEye.scale.y = blink;
        if (r.speaking) r.mouthPivot.scale.y = 0.5 + vE;
      });

      if (typeof window.animateScene === "function") { try { window.animateScene(t, p); } catch(e){} }
      renderer.render(scene, camera);

      const prog = document.getElementById("uiProgress"), tim = document.getElementById("uiTimer");
      if (prog) prog.style.width = Math.floor(p * 100) + "%";
      if (tim) tim.textContent = Math.max(0, Math.ceil((DURATION - el)/1000)) + "s";

      if (p >= 1 && !stopped) { stopped = true; if (recorder && recorder.state !== "inactive") recorder.stop(); }
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
  }

  startEngine();
})();
