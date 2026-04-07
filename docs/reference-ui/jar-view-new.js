/**
 * Jar View for Oryzae Web App
 * Three.js jar bottle with circular graphics for questions, zoom/detail UI
 */

// ============================================================================
// GLOBAL STATE
// ============================================================================

window.jarRenderer = null;
let jarRenderer = null;
let jarScene = null;
let jarCamera = null;
let jarClock = null;
let animationFrameId = null;
let jarIsAnimating = false;

const jarState = {
  currentZoomedQuestionId: null,
  currentDetailElementType: null, // 'snippet', 'keyword', 'letter'
  circleInstances: {}, // { questionId: CircleGraphic }
};

const textParticleWords = [
  '発酵','記憶','静寂','問い','秋','醸す','澱','季節',
  '時間','思考','沈殿','麹','息','熱','言葉','微生物',
  '風','心','光','闇','朝','夜','蔵','水','塩','米','土','菌'
];

// ============================================================================
// JAR BOTTLE (Three.js)
// ============================================================================

class JarBottle {
  constructor(container) {
    this.container = container;
    this.width = container.offsetWidth || 260;
    this.height = container.offsetHeight || 340;
    this.sprites = [];
    this.microbes = [];

    this.initRenderer();
    this.initScene();
    this.buildJar();
    this.createTextParticles();
    this.createMicrobes();
  }

  initRenderer() {
    const canvas = document.createElement('canvas');
    this.container.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = false;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 2.0, 16);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xfff5e6, 1.0));
    const topLight = new THREE.PointLight(0xffedd5, 2.5, 20);
    topLight.position.set(2, 6, 4);
    this.scene.add(topLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rimLight.position.set(-3, 2, -3);
    this.scene.add(rimLight);
    const internalLight = new THREE.PointLight(0xd97706, 2.5, 5);
    internalLight.position.set(0, -0.5, 0);
    this.scene.add(internalLight);
  }

  buildJar() {
    // Materials
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xfafffe,
      transmission: 0.92,
      roughness: 0.04,
      ior: 1.52,
      thickness: 0.12,
      side: THREE.DoubleSide,
      transparent: true
    });

    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x7a9e8e,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.65
    });

    const lidMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef6ff,
      transmission: 0.82,
      roughness: 0.06,
      ior: 1.52,
      thickness: 0.10,
      side: THREE.DoubleSide,
      transparent: true
    });

    this.jarGroup = new THREE.Group();
    this.scene.add(this.jarGroup);

    const jarBottomY = -3.64, jarTopY = 3.64;
    const profile = [
      [0.00, jarBottomY],       [2.288, jarBottomY],
      [2.340, jarBottomY+0.312],[2.444, jarBottomY+1.300],
      [2.652, jarBottomY+2.600],[2.704, jarBottomY+3.900],
      [2.548, jarBottomY+4.820],[2.132, jarBottomY+5.668],
      [1.612, jarBottomY+6.448],[1.508, jarBottomY+6.812],
      [1.560, jarBottomY+7.072],[1.768, jarTopY],
    ];

    const profilePoints = profile.map(([r,y]) => new THREE.Vector2(r,y));
    this.jarGroup.add(new THREE.Mesh(new THREE.LatheGeometry(profilePoints, 72), glassMat));

    const outlinePts = profile.map(([r,y]) => new THREE.Vector2(r*1.025, y));
    this.jarGroup.add(new THREE.Mesh(new THREE.LatheGeometry(outlinePts, 72), outlineMat));

    const baseDisc = new THREE.Mesh(new THREE.CircleGeometry(2.288, 64), glassMat);
    baseDisc.rotation.x = Math.PI/2;
    baseDisc.position.y = jarBottomY+0.01;
    this.jarGroup.add(baseDisc);

    const lidDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.04,2.04,0.21,64), lidMat);
    lidDisc.position.y = jarTopY+0.106;
    this.jarGroup.add(lidDisc);

    const lidOutline = new THREE.Mesh(new THREE.CylinderGeometry(2.11,2.11,0.25,64), outlineMat);
    lidOutline.position.y = jarTopY+0.106;
    this.jarGroup.add(lidOutline);

    // Liquid
    this.liqHeight = 4.42;
    this.liqBottomY = jarBottomY+0.34;
    this.liqTopY = this.liqBottomY + this.liqHeight;

    const liqPoints = [
      [0.00, this.liqBottomY],[2.132, this.liqBottomY],[2.236, this.liqBottomY+1.04],
      [2.444, this.liqBottomY+2.34],[2.470, this.liqBottomY+3.64],[2.288, this.liqTopY]
    ].map(([r,y]) => new THREE.Vector2(r,y));

    const liqVolMat = new THREE.MeshBasicMaterial({
      color: 0x5db85a,
      transparent: true,
      opacity: 0.15,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    });

    const liqVolMesh = new THREE.Mesh(new THREE.LatheGeometry(liqPoints, 64), liqVolMat);
    liqVolMesh.renderOrder = 2;
    this.scene.add(liqVolMesh);

    const liqCapMat = new THREE.MeshBasicMaterial({
      color: 0x5db85a,
      transparent: true,
      opacity: 0.15,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    });

    const liqCapMesh = new THREE.Mesh(new THREE.CircleGeometry(liqPoints[0].x * 0.98, 64), liqCapMat);
    liqCapMesh.rotation.x = Math.PI / 2;
    liqCapMesh.position.y = liqPoints[0].y + 0.01;
    liqCapMesh.renderOrder = 2;
    this.scene.add(liqCapMesh);

    const liqTopCapMat = new THREE.MeshBasicMaterial({
      color: 0x5db85a,
      transparent: true,
      opacity: 0.15,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    });

    const liqTopCapMesh = new THREE.Mesh(new THREE.CircleGeometry(2.288 * 0.98, 64), liqTopCapMat);
    liqTopCapMesh.rotation.x = -Math.PI / 2;
    liqTopCapMesh.position.y = this.liqTopY;
    liqTopCapMesh.renderOrder = 2;
    this.scene.add(liqTopCapMesh);

    this.jarRadiusBot = 2.132;
  }

  createTextParticles() {
    // Create sprite text particles (the main word set)
    const mainWords = textParticleWords.slice(0, 8);
    mainWords.forEach(word => {
      const sprite = this.mkSprite(word, {
        fontSize: 28,
        opacity: 0.72,
        weight: 500
      });
      sprite.scale.set(0.7, 0.35, 1);
      sprite.renderOrder = 3;

      const r = Math.random() * (this.jarRadiusBot - 0.2);
      const th = Math.random() * Math.PI * 2;
      const y = this.liqBottomY + 0.2 + Math.random() * (this.liqHeight - 0.4);

      sprite.position.set(r * Math.cos(th), y, r * Math.sin(th));
      sprite.userData = {
        baseY: y,
        baseX: sprite.position.x,
        baseZ: sprite.position.z,
        speed: 0.35 + Math.random() * 0.4,
        offset: Math.random() * Math.PI * 2,
        amplitude: 0.04 + Math.random() * 0.04,
        speedX: 0.22 + Math.random() * 0.3,
        offsetX: Math.random() * Math.PI * 2,
        amplitudeX: 0.03 + Math.random() * 0.03,
        speedZ: 0.18 + Math.random() * 0.28,
        offsetZ: Math.random() * Math.PI * 2,
        amplitudeZ: 0.03 + Math.random() * 0.03
      };

      this.scene.add(sprite);
      this.sprites.push(sprite);
    });

    // Additional filler particles
    const kana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
    for (let i = 0; i < 100; i++) {
      const isW = Math.random() > 0.55;
      const txt = isW ? textParticleWords[Math.floor(Math.random() * textParticleWords.length)] : kana[Math.floor(Math.random() * kana.length)];
      const fs = isW ? (10 + Math.random() * 8) : (7 + Math.random() * 5);
      const al = 0.18 + Math.random() * 0.38;

      const sprite = this.mkSprite(txt, {
        fontSize: Math.round(fs * 3.5),
        width: 128,
        height: 56,
        opacity: al,
        weight: 300
      });

      const sw = isW ? (0.38 + Math.random() * 0.28) : (0.16 + Math.random() * 0.14);
      sprite.scale.set(sw, sw * 0.5, 1);

      const an = Math.random() * Math.PI * 2;
      const rd = Math.random() * (this.jarRadiusBot - 0.08);
      const y = this.liqBottomY + 0.08 + Math.pow(Math.random(), 1.6) * (this.liqHeight - 0.12);

      sprite.position.set(Math.cos(an) * rd, y, Math.sin(an) * rd);
      sprite.userData = {
        baseY: y,
        baseX: sprite.position.x,
        baseZ: sprite.position.z,
        speed: 0.15 + Math.random() * 0.3,
        offset: Math.random() * Math.PI * 2,
        amplitude: 0.02 + Math.random() * 0.03,
        speedX: 0.10 + Math.random() * 0.2,
        offsetX: Math.random() * Math.PI * 2,
        amplitudeX: 0.015 + Math.random() * 0.02,
        speedZ: 0.08 + Math.random() * 0.18,
        offsetZ: Math.random() * Math.PI * 2,
        amplitudeZ: 0.015 + Math.random() * 0.02
      };

      this.scene.add(sprite);
      this.sprites.push(sprite);
    }
  }

  mkSprite(text, opts = {}) {
    const c = document.createElement('canvas');
    const fs = opts.fontSize || 28;
    c.width = opts.width || 192;
    c.height = opts.height || 80;

    const ctx = c.getContext('2d');
    ctx.font = `${opts.weight || 400} ${fs}px "Noto Serif JP"`;
    ctx.fillStyle = opts.color || '#4a3f35';
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;

    return new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: opts.opacity ?? 0.75,
        depthTest: false
      })
    );
  }

  createMicrobes() {
    // Load SVG files as sprite textures
    const svgFiles = [
      { file: 'lab.svg', count: 3 },
      { file: 'yeast.svg', count: 3 },
      { file: 'koji.svg', count: 3 },
    ];

    svgFiles.forEach(({ file, count }) => {
      const img = new Image();
      img.onload = () => {
        for (let i = 0; i < count; i++) {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 64, 64);

          const tex = new THREE.CanvasTexture(canvas);
          tex.needsUpdate = true;

          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: tex,
              transparent: true,
              opacity: 0.5 + Math.random() * 0.2,
              depthTest: false
            })
          );

          const scale = 0.25 + Math.random() * 0.15;
          sprite.scale.set(scale, scale, 1);
          sprite.renderOrder = 3;

          // Position near text particles within the liquid
          const ref = this.sprites[Math.floor(Math.random() * Math.min(8, this.sprites.length))];
          const offR = 0.12 + Math.random() * 0.25;
          const offTh = Math.random() * Math.PI * 2;

          sprite.position.set(
            ref.position.x + Math.cos(offTh) * offR,
            ref.position.y + (Math.random() - 0.5) * 0.15,
            ref.position.z + Math.sin(offTh) * offR
          );

          sprite.userData = {
            basePos: sprite.position.clone(),
            driftSpeed: 0.18 + Math.random() * 0.22,
            driftOffset: Math.random() * Math.PI * 2,
            driftAmpY: 0.04 + Math.random() * 0.04,
            driftAmpX: 0.025 + Math.random() * 0.025,
            rotSpeed: (Math.random() - 0.5) * 0.4,
            wobbleFreq: 0.8 + Math.random() * 0.6,
            wobbleAmp: 0.008 + Math.random() * 0.01,
          };

          this.scene.add(sprite);
          this.microbes.push(sprite);
        }
      };
      img.src = file;
    });
  }

  mkMicrobeMat(color, opacity) {
    return new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.25,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
  }

  makeLacto(scale = 1) {
    const g = new THREE.Group();
    const mat = this.mkMicrobeMat(0xd4e8c2, 0.4);

    const bodyGeo = new THREE.CylinderGeometry(0.045 * scale, 0.045 * scale, 0.24 * scale, 16);
    const capGeo = new THREE.SphereGeometry(0.045 * scale, 16, 8);

    const body = new THREE.Mesh(bodyGeo, mat);
    body.renderOrder = 3;

    const capTop = new THREE.Mesh(capGeo, mat);
    capTop.position.y = 0.12 * scale;
    capTop.renderOrder = 3;

    const capBot = new THREE.Mesh(capGeo, mat);
    capBot.position.y = -0.12 * scale;
    capBot.renderOrder = 3;

    g.add(body, capTop, capBot);
    g.rotation.z = (Math.random() - 0.5) * 0.6;
    g.rotation.x = (Math.random() - 0.5) * 0.3;

    return g;
  }

  makeYeast(scale = 1) {
    const g = new THREE.Group();
    const mat = this.mkMicrobeMat(0xf5d9a0, 0.4);

    const bodyGeo = new THREE.SphereGeometry(0.11 * scale, 20, 16);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.renderOrder = 3;
    body.scale.set(1, 1.22, 1);

    const budGeo = new THREE.SphereGeometry(0.055 * scale, 14, 10);
    const bud = new THREE.Mesh(budGeo, mat);
    bud.renderOrder = 3;
    bud.position.set(0.10 * scale, 0.10 * scale, 0);

    g.add(body, bud);
    return g;
  }

  makeKoji(scale = 1) {
    const g = new THREE.Group();
    const stalkMat = this.mkMicrobeMat(0xc8b4e0, 0.4);
    const headMat = this.mkMicrobeMat(0xe8d4f8, 0.4);

    const stalkGeo = new THREE.CylinderGeometry(0.018 * scale, 0.022 * scale, 0.28 * scale, 10);
    const stalk = new THREE.Mesh(stalkGeo, stalkMat);
    stalk.renderOrder = 3;
    stalk.position.y = 0.0;

    const headGeo = new THREE.SphereGeometry(0.075 * scale, 18, 12);
    const head = new THREE.Mesh(headGeo, headMat);
    head.renderOrder = 3;
    head.position.y = 0.17 * scale;

    const sporeCount = 10;
    for (let i = 0; i < sporeCount; i++) {
      const phi = (i / sporeCount) * Math.PI * 2;
      const sGeo = new THREE.SphereGeometry(0.018 * scale, 8, 6);
      const s = new THREE.Mesh(sGeo, headMat);
      s.renderOrder = 3;
      s.position.set(
        Math.cos(phi) * 0.105 * scale,
        0.17 * scale + Math.sin(phi) * 0.012 * scale,
        Math.sin(phi) * 0.105 * scale
      );
      g.add(s);
    }

    g.add(stalk, head);
    g.rotation.z = (Math.random() - 0.5) * 0.4;

    return g;
  }

  update(elapsedTime) {
    const speedMult = 2.0;
    const ampMult = 2.0;

    // Update sprites
    this.sprites.forEach(s => {
      const u = s.userData;
      s.position.y = u.baseY + Math.sin(elapsedTime * u.speed * speedMult + u.offset) * u.amplitude * ampMult;
      s.position.x = u.baseX + Math.sin(elapsedTime * u.speedX * speedMult + u.offsetX) * u.amplitudeX * ampMult;
      s.position.z = u.baseZ + Math.cos(elapsedTime * u.speedZ * speedMult + u.offsetZ) * u.amplitudeZ * ampMult;
      s.lookAt(this.camera.position);
    });

    // Update microbes
    this.microbes.forEach(m => {
      const u = m.userData;
      m.position.y = u.basePos.y + Math.sin(elapsedTime * u.driftSpeed + u.driftOffset) * u.driftAmpY;
      m.position.x = u.basePos.x + Math.sin(elapsedTime * u.driftSpeed * 0.7 + u.driftOffset + 1.3) * u.driftAmpX;
      m.rotation.y += 0.003 * u.rotSpeed;

      if (m.position.y > this.liqTopY - 0.1) m.position.y = this.liqTopY - 0.1;
      if (m.position.y < this.liqBottomY + 0.1) m.position.y = this.liqBottomY + 0.1;
    });

    this.renderer.render(this.scene, this.camera);
  }

  // Animate new words falling into the jar (漬け込む effect)
  feedWords(words) {
    if (!words || words.length === 0) return;

    words.forEach((word, i) => {
      const sprite = this.mkSprite(word, {
        fontSize: 24 + Math.random() * 8,
        opacity: 0,
        weight: 500
      });
      sprite.scale.set(0.5 + Math.random() * 0.3, 0.25 + Math.random() * 0.15, 1);
      sprite.renderOrder = 4;

      // Start above the jar opening
      const startX = (Math.random() - 0.5) * 1.5;
      const startY = this.liqTopY + 3 + Math.random() * 1.5;
      const startZ = (Math.random() - 0.5) * 0.5;
      sprite.position.set(startX, startY, startZ);

      // Target: random position within the liquid
      const targetAngle = Math.random() * Math.PI * 2;
      const targetR = Math.random() * (this.jarRadiusBot - 0.3);
      const targetY = this.liqBottomY + 0.2 + Math.random() * (this.liqHeight - 0.4);
      const targetX = Math.cos(targetAngle) * targetR;
      const targetZ = Math.sin(targetAngle) * targetR;

      this.scene.add(sprite);

      // Animate with delay per word
      const delay = i * 180;
      const duration = 1800 + Math.random() * 600;
      const startTime = performance.now() + delay;

      const animateEntry = () => {
        const now = performance.now();
        const elapsed = now - startTime;
        if (elapsed < 0) {
          requestAnimationFrame(animateEntry);
          return;
        }

        const t = Math.min(1, elapsed / duration);
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - t, 3);

        sprite.position.x = startX + (targetX - startX) * ease;
        sprite.position.y = startY + (targetY - startY) * ease;
        sprite.position.z = startZ + (targetZ - startZ) * ease;

        // Fade in during first half, then settle at final opacity
        const finalOpacity = 0.3 + Math.random() * 0.35;
        if (t < 0.3) {
          sprite.material.opacity = (t / 0.3) * finalOpacity;
        } else {
          sprite.material.opacity = finalOpacity;
        }

        if (t < 1) {
          requestAnimationFrame(animateEntry);
        } else {
          // Settled - add to sprites array for ongoing floating animation
          sprite.userData = {
            baseY: targetY,
            baseX: targetX,
            baseZ: targetZ,
            speed: 0.2 + Math.random() * 0.3,
            offset: Math.random() * Math.PI * 2,
            amplitude: 0.03 + Math.random() * 0.03,
            speedX: 0.15 + Math.random() * 0.2,
            offsetX: Math.random() * Math.PI * 2,
            amplitudeX: 0.02 + Math.random() * 0.02,
            speedZ: 0.12 + Math.random() * 0.18,
            offsetZ: Math.random() * Math.PI * 2,
            amplitudeZ: 0.02 + Math.random() * 0.02
          };
          this.sprites.push(sprite);
        }
      };
      requestAnimationFrame(animateEntry);
    });
  }

  dispose() {
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}

// ============================================================================
// CIRCLE GRAPHICS
// ============================================================================

class CircleGraphic {
  constructor(questionId, position, size = 200) {
    this.questionId = questionId;
    this.position = position;
    this.size = size;
    this.element = document.createElement('div');
    this.element.className = 'jar-circle';
    this.element.dataset.questionId = questionId;
    this.element.style.cssText = `
      position: absolute;
      left: ${position.x}px;
      top: ${position.y}px;
      width: ${size}px;
      height: ${size}px;
      transform: translateX(-50%) translateY(-50%);
      cursor: pointer;
    `;

    this.bobOffset = Math.random() * Math.PI * 2;
    this.floatingElements = [];
    this.render();
  }

  render() {
    const question = OryzaeData.getQuestionString(this.questionId);
    const fermentation = OryzaeData.getFermentationForQuestion(this.questionId);

    this.element.innerHTML = '';

    const svgNS = 'http://www.w3.org/2000/svg';

    // Circle border SVG (fits exactly in the element)
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${this.size} ${this.size}`);
    svg.setAttribute('class', 'jar-circle-svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';

    // Gradient definition
    const defs = document.createElementNS(svgNS, 'defs');
    const grad = document.createElementNS(svgNS, 'linearGradient');
    grad.setAttribute('id', `grad-${this.questionId}`);
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');
    const stop1 = document.createElementNS(svgNS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#d97706');
    stop1.setAttribute('stop-opacity', '0.6');
    const stop2 = document.createElementNS(svgNS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#f59e0b');
    stop2.setAttribute('stop-opacity', '0.3');
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    // Circle border
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', this.size / 2);
    circle.setAttribute('cy', this.size / 2);
    circle.setAttribute('r', this.size / 2 - 10);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', `url(#grad-${this.questionId})`);
    circle.setAttribute('stroke-width', '1');
    // Inner decorative circle
    const innerCircle = document.createElementNS(svgNS, 'circle');
    innerCircle.setAttribute('cx', this.size / 2);
    innerCircle.setAttribute('cy', this.size / 2);
    innerCircle.setAttribute('r', this.size / 2 - 18);
    innerCircle.setAttribute('fill', 'none');
    innerCircle.setAttribute('stroke', `url(#grad-${this.questionId})`);
    innerCircle.setAttribute('stroke-width', '0.5');
    innerCircle.setAttribute('stroke-opacity', '0.5');
    svg.appendChild(circle);
    svg.appendChild(innerCircle);
    this.element.appendChild(svg);

    // Separate OUTER SVG for question text (larger than circle, positioned outside)
    // Uses percentage-based sizing so it scales when circle zooms (width/height change)
    const marginPct = 25; // percentage overshoot on each side
    const textSvg = document.createElementNS(svgNS, 'svg');
    textSvg.setAttribute('class', 'jar-circle-text-svg');
    // viewBox is based on original circle size with margin
    const margin = this.size * marginPct / 100;
    const outerSvgSize = this.size + margin * 2;
    textSvg.setAttribute('viewBox', `-${margin} -${margin} ${outerSvgSize} ${outerSvgSize}`);
    textSvg.style.cssText = `position:absolute;top:-${marginPct}%;left:-${marginPct}%;width:${100 + marginPct * 2}%;height:${100 + marginPct * 2}%;pointer-events:none;z-index:5;overflow:visible;`;

    const textDefs = document.createElementNS(svgNS, 'defs');
    // Arc path OUTSIDE the circle border (radius larger than circle)
    const cx = this.size / 2;
    const cy = this.size / 2;
    const textR = this.size / 2 + 4; // outside the border
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('id', `path-${this.questionId}`);
    path.setAttribute('d', `M ${cx - textR},${cy} A ${textR},${textR} 0 0,1 ${cx + textR},${cy}`);
    path.setAttribute('fill', 'none');
    textDefs.appendChild(path);
    textSvg.appendChild(textDefs);

    const textEl = document.createElementNS(svgNS, 'text');
    textEl.setAttribute('fill', '#6b2c2c');
    textEl.setAttribute('font-size', '13');
    textEl.setAttribute('font-family', 'Noto Serif JP');
    textEl.setAttribute('font-weight', '500');
    textEl.setAttribute('letter-spacing', '0.12em');
    textEl.style.textShadow = '0 0 4px rgba(250,248,245,1), 0 0 8px rgba(250,248,245,1), 0 0 12px rgba(250,248,245,0.8)';
    const tpath = document.createElementNS(svgNS, 'textPath');
    tpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#path-${this.questionId}`);
    tpath.setAttribute('startOffset', '50%');
    tpath.setAttribute('text-anchor', 'middle');
    tpath.textContent = question || '未タイトル';
    textEl.appendChild(tpath);
    textSvg.appendChild(textEl);

    this.element.appendChild(textSvg);

    // Inner content container (no clipping - circle is just a visual SVG border)
    // Elements float freely within/around the circle like in circle-zoom.html
    const innerDiv = document.createElement('div');
    innerDiv.className = 'jar-circle-inner';
    innerDiv.style.cssText = `
      position: absolute;
      inset: 0;
    `;

    this.floatingElements = [];

    // Pre-defined scattered positions (as % of circle, relative to center)
    // Must stay within ~20-80% to avoid circular clipping
    // Order: 5 keywords, 3 snippets, 1 letter
    const scatteredPositions = [
      // Keyword positions - spread wide across circle for 2x scale
      { x: 50, y: 18 },  // top center
      { x: 78, y: 32 },  // top-right
      { x: 75, y: 65 },  // bottom-right
      { x: 24, y: 62 },  // bottom-left
      { x: 22, y: 32 },  // top-left
      // Snippet positions - spread in center with more spacing
      { x: 36, y: 42 },
      { x: 64, y: 46 },
      { x: 50, y: 58 },
      // Letter position - bottom center
      { x: 50, y: 76 },
    ];

    let posIdx = 0;

    if (fermentation) {
      const snippets = OryzaeData.getSnippetsForFermentation(fermentation.id);
      const keywords = OryzaeData.getKeywordsForFermentation(fermentation.id);
      const letter = OryzaeData.getLetterForFermentation(fermentation.id);

      // Yeast SVG inline (golden ellipse with bud)
      const yeastSvgStr = `<svg viewBox="0 0 40 40" class="microbe-icon-svg"><ellipse cx="20" cy="22" rx="12" ry="14" fill="#e8a020"/><ellipse cx="20" cy="20" rx="12" ry="14" fill="#f5d9a0"/><circle cx="28" cy="12" r="6" fill="#f5d9a0"/></svg>`;
      // Koji SVG inline (purple branching)
      const kojiSvgStr = `<svg viewBox="0 0 40 40" class="microbe-icon-svg"><path d="M 20 35 L 20 15" stroke="#9955cc" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="12" r="8" fill="#bb88ee"/><circle cx="12" cy="8" r="3" fill="#bb88ee"/><circle cx="28" cy="8" r="3" fill="#bb88ee"/><circle cx="20" cy="4" r="3" fill="#bb88ee"/></svg>`;
      // Lacto SVG inline (green ellipses)
      const lactoSvgStr = `<svg viewBox="0 0 40 40" class="microbe-icon-svg"><ellipse cx="20" cy="24" rx="8" ry="10" fill="#5db85a"/><ellipse cx="20" cy="22" rx="8" ry="10" fill="#7dd87a"/><ellipse cx="20" cy="20" rx="6" ry="8" fill="#9ee89a"/></svg>`;

      // Corner positions for microbe icon attachment
      const cornerPositions = [
        { cls: 'icon-top-right', style: 'right:-4px;top:-4px;' },
        { cls: 'icon-top-left', style: 'left:-4px;top:-4px;' },
        { cls: 'icon-bottom-right', style: 'right:-4px;bottom:-4px;' },
        { cls: 'icon-bottom-left', style: 'left:-4px;bottom:-4px;' },
      ];

      // Add keywords (first 5) - brown fill, white text, yeast icon
      keywords.slice(0, 5).forEach((keyword, idx) => {
        const pos = scatteredPositions[posIdx++] || { x: 10 + Math.random() * 60, y: 30 + Math.random() * 40 };
        const isVertical = idx % 3 === 1; // some vertical for shape variation
        const rotations = [-5, 8, -3, 6, -7];
        const tag = document.createElement('div');
        tag.className = 'jar-circle-keyword jar-circle-element';
        tag.dataset.type = 'keyword';
        tag.dataset.index = idx;
        // Yeast icon at random corner
        const corner = cornerPositions[idx % cornerPositions.length];
        tag.innerHTML = `<span class="kw-text" ${isVertical ? 'style="writing-mode:vertical-rl;"' : ''}>${keyword.keyword}</span><div class="microbe-attach" style="position:absolute;width:16px;height:16px;${corner.style}">${yeastSvgStr}</div>`;
        tag.style.cssText = `
          left: ${pos.x}%;
          top: ${pos.y}%;
          transform: translate(-50%, -50%) rotate(${rotations[idx]}deg) scale(var(--el-scale));
          cursor: pointer;
          user-select: none;
        `;
        tag._baseRotation = `rotate(${rotations[idx]}deg)`;
        innerDiv.appendChild(tag);
        this.floatingElements.push(tag);
      });

      // Add snippets (first 3) - white cards with koji icon
      snippets.slice(0, 3).forEach((snippet, idx) => {
        const pos = scatteredPositions[posIdx++] || { x: 30 + Math.random() * 40, y: 20 + Math.random() * 50 };
        const rotations = [-12, 8, -5];
        const card = document.createElement('div');
        card.className = 'jar-circle-snippet jar-circle-element';
        card.dataset.type = 'snippet';
        card.dataset.index = idx;
        // Koji icon at random corner
        const corner = cornerPositions[(idx + 2) % cornerPositions.length];
        card.innerHTML = `<span class="snippet-text-inner">${snippet.original_text.substring(0, 20)}...</span><div class="microbe-attach" style="position:absolute;width:12px;height:12px;${corner.style}">${kojiSvgStr}</div>`;
        card.style.cssText = `
          left: ${pos.x}%;
          top: ${pos.y}%;
          transform: translate(-50%, -50%) rotate(${rotations[idx]}deg) scale(var(--el-scale));
          cursor: pointer;
          user-select: none;
        `;
        card._baseRotation = `rotate(${rotations[idx]}deg)`;
        innerDiv.appendChild(card);
        this.floatingElements.push(card);
      });

      // Add letter icon - envelope SVG with lactobacillus icon
      if (letter) {
        const pos = scatteredPositions[posIdx++] || { x: 40, y: 75 };
        const letterEl = document.createElement('div');
        letterEl.className = 'jar-circle-letter jar-circle-element';
        letterEl.dataset.type = 'letter';
        letterEl.innerHTML = `
          <div class="letter-envelope-mini">
            <svg viewBox="0 0 100 80" class="w-full h-full"><rect x="5" y="20" width="90" height="55" rx="2" fill="#f5f0e8" stroke="#e6dec3" stroke-width="1"/><path d="M 5 20 L 50 55 L 95 20" fill="#e8e3d5" stroke="#d4c9b8" stroke-width="1"/><path d="M 5 75 L 50 40 L 95 75" fill="#faf8f5" stroke="#e6dec3" stroke-width="1"/><circle cx="50" cy="48" r="10" fill="#c855a0"/><circle cx="50" cy="48" r="7" fill="none" stroke="#a03070" stroke-width="1" opacity="0.5"/><path d="M 46 48 L 50 44 L 54 48 L 50 52 Z" fill="#f5f0e8"/></svg>
          </div>
          <div class="microbe-attach" style="position:absolute;width:18px;height:18px;left:-6px;top:-8px;">${lactoSvgStr}</div>
        `;
        letterEl.style.cssText = `
          left: ${pos.x}%;
          top: ${pos.y}%;
          transform: translate(-50%, -50%) rotate(3deg) scale(var(--el-scale));
          cursor: pointer;
          user-select: none;
        `;
        letterEl._baseRotation = 'rotate(3deg)';
        innerDiv.appendChild(letterEl);
        this.floatingElements.push(letterEl);
      }
    } else {
      // Empty state: floating microbe SVGs (lab, yeast, koji)
      const microbeSpecs = [
        { icon: 'lab.svg',   x: 35, y: 28, size: 36, rot: -10, opacity: 0.5 },
        { icon: 'yeast.svg', x: 62, y: 35, size: 32, rot: 15,  opacity: 0.45 },
        { icon: 'koji.svg',  x: 45, y: 52, size: 38, rot: -5,  opacity: 0.5 },
        { icon: 'lab.svg',   x: 28, y: 62, size: 28, rot: 20,  opacity: 0.35 },
        { icon: 'yeast.svg', x: 58, y: 65, size: 30, rot: -12, opacity: 0.4 },
        { icon: 'koji.svg',  x: 68, y: 48, size: 26, rot: 8,   opacity: 0.35 },
      ];
      microbeSpecs.forEach((spec, idx) => {
        const microbe = document.createElement('div');
        microbe.className = 'jar-circle-microbe jar-circle-element';
        microbe.innerHTML = `<img src="${spec.icon}" alt="" style="width:100%;height:100%;pointer-events:none;">`;
        microbe.style.cssText = `
          left: ${spec.x}%;
          top: ${spec.y}%;
          width: ${spec.size}px;
          height: ${spec.size}px;
          opacity: ${spec.opacity};
          transform: translate(-50%, -50%) rotate(${spec.rot}deg) scale(var(--el-scale));
          pointer-events: none;
        `;
        microbe._baseRotation = `rotate(${spec.rot}deg)`;
        innerDiv.appendChild(microbe);
        this.floatingElements.push(microbe);
      });
    }

    this.element.appendChild(innerDiv);
  }

  update(elapsedTime) {
    // Skip bobbing/floating animation when zoomed (would conflict with zoom CSS transition)
    if (this.element.classList.contains('zoomed')) return;

    // Circle container: bob up/down + subtle rotation (matching circle-zoom.html floatDrift)
    const bobY = Math.sin(elapsedTime * 0.25 + this.bobOffset) * 6;
    const bobX = Math.sin(elapsedTime * 0.18 + this.bobOffset + 1.5) * 3;
    const bobRotate = Math.sin(elapsedTime * 0.2 + this.bobOffset + 0.8) * 0.5;

    // Floating animation for inner elements (gentle drift + micro-rotation)
    this.floatingElements.forEach((el, idx) => {
      const phaseX = idx * Math.PI * 0.4 + 0.7;
      const phaseY = idx * Math.PI * 0.3;
      const offsetX = Math.sin(elapsedTime * (0.2 + idx * 0.03) + phaseX) * 4;
      const offsetY = Math.sin(elapsedTime * (0.3 + idx * 0.05) + phaseY) * 4;
      // Each element gets its own subtle rotation wobble
      const elRotate = Math.sin(elapsedTime * (0.15 + idx * 0.02) + idx * 2.1) * 1.5;
      const baseRotate = el._baseRotation || '';
      el.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) ${baseRotate} rotate(${elRotate}deg) scale(var(--el-scale))`;
    });

    this.element.style.transform = `translateX(calc(-50% + ${bobX}px)) translateY(calc(-50% + ${bobY}px)) rotate(${bobRotate}deg)`;
  }

  getContainerElement() {
    return document.getElementById('jar-circles-container');
  }

  mount() {
    this.getContainerElement().appendChild(this.element);
  }

  unmount() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  attachClickHandler(callback) {
    this.element.addEventListener('click', (e) => {
      // If already zoomed, don't re-trigger zoom; stop propagation to prevent backdrop close
      if (this.element.classList.contains('zoomed')) {
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      callback(this.questionId);
    });
  }
}

// ============================================================================
// CONNECTION LINES (SVG)
// ============================================================================

function updateConnectionLines() {
  const svg = document.getElementById('jar-connection-lines');
  if (!svg) return;

  svg.innerHTML = '';

  const viewJar = document.getElementById('view-jar');
  const jarContainer = document.getElementById('jar-bottle-container');
  const circlesContainer = document.getElementById('jar-circles-container');

  if (!viewJar || !jarContainer || !circlesContainer) return;

  const viewRect = viewJar.getBoundingClientRect();
  const jarRect = jarContainer.getBoundingClientRect();

  // Set SVG viewBox to match the view dimensions
  const vW = viewJar.offsetWidth;
  const vH = viewJar.offsetHeight;
  svg.setAttribute('viewBox', `0 0 ${vW} ${vH}`);

  // Jar center X relative to view-jar
  const jarCX = jarRect.left - viewRect.left + jarRect.width / 2;

  // Simple seeded random: generates a stable pseudo-random value from a string seed
  function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    }
    // Two separate hashes for x and y
    const h1 = Math.abs(((h * 2654435761) >>> 0) / 4294967296);
    const h2 = Math.abs(((h * 340573321) >>> 0) / 4294967296);
    return { rx: h1, ry: h2 };
  }

  // Liquid region constraints (as fractions of jar rect)
  // x: center ± 15% of jar width (stay inside the curved body)
  // y: 45%–65% of jar height (below liquid surface, above bottom curve)
  const liquidXRange = { min: -0.15, max: 0.15 };
  const liquidYRange = { min: 0.45, max: 0.65 };

  // Line segment intersection test (returns true if segments AB and CD intersect)
  function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const cross = (v1x, v1y, v2x, v2y) => v1x * v2y - v1y * v2x;
    const d1 = cross(dx - cx, dy - cy, ax - cx, ay - cy);
    const d2 = cross(dx - cx, dy - cy, bx - cx, by - cy);
    const d3 = cross(bx - ax, by - ay, cx - ax, cy - ay);
    const d4 = cross(bx - ax, by - ay, dx - ax, dy - ay);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    return false;
  }

  const circles = circlesContainer.querySelectorAll('.jar-circle');

  // Phase 1: compute circle centers and random target points
  const lineData = [];
  circles.forEach((circleEl, idx) => {
    const qId = circleEl.dataset.questionId || `circle-${idx}`;
    const { rx, ry } = seededRandom(qId);
    const xOffset = liquidXRange.min + rx * (liquidXRange.max - liquidXRange.min);
    const yFraction = liquidYRange.min + ry * (liquidYRange.max - liquidYRange.min);

    const targetX = jarCX + jarRect.width * xOffset;
    const targetY = jarRect.top - viewRect.top + jarRect.height * yFraction;

    const circleRect = circleEl.getBoundingClientRect();
    const cCX = circleRect.left - viewRect.left + circleRect.width / 2;
    const cCY = circleRect.top - viewRect.top + circleRect.height / 2;

    lineData.push({ cCX, cCY, targetX, targetY, circleRect });
  });

  // Phase 2: resolve intersections by swapping target points
  // Repeat until no crossings remain (max 3 passes for safety)
  for (let pass = 0; pass < 3; pass++) {
    let swapped = false;
    for (let i = 0; i < lineData.length; i++) {
      for (let j = i + 1; j < lineData.length; j++) {
        const a = lineData[i], b = lineData[j];
        if (segmentsIntersect(
          a.cCX, a.cCY, a.targetX, a.targetY,
          b.cCX, b.cCY, b.targetX, b.targetY
        )) {
          // Swap target points to uncross
          const tmpX = a.targetX, tmpY = a.targetY;
          a.targetX = b.targetX; a.targetY = b.targetY;
          b.targetX = tmpX; b.targetY = tmpY;
          swapped = true;
        }
      }
    }
    if (!swapped) break;
  }

  // Phase 3: draw the lines
  lineData.forEach(({ cCX, cCY, targetX, targetY, circleRect }) => {
    const dx = targetX - cCX;
    const dy = targetY - cCY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const circleR = circleRect.width / 2;
    const nx = dx / dist;
    const ny = dy / dist;
    const startX = cCX + nx * circleR;
    const startY = cCY + ny * circleR;
    // Control point for a gentle curve
    const midX = (startX + targetX) / 2 + dy * 0.15;
    const midY = (startY + targetY) / 2 - dx * 0.15;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${startX},${startY} Q ${midX},${midY} ${targetX},${targetY}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent, #d97706)');
    path.setAttribute('stroke-width', '1');
    path.setAttribute('stroke-dasharray', '4 4');
    path.setAttribute('opacity', '0.3');
    svg.appendChild(path);
  });
}

// ============================================================================
// ZOOM OVERLAY
// ============================================================================

// ============================================================================
// ZOOM (circle-zoom.html approach: circle itself transitions to center)
// ============================================================================

function openZoomOverlay(questionId) {
  const circle = jarState.circleInstances[questionId];
  if (!circle) return;

  jarState.currentZoomedQuestionId = questionId;

  const container = document.getElementById('jar-circles-container');
  const viewJar = document.getElementById('view-jar');
  if (!container || !viewJar) return;

  // Calculate target: center of the view, scaled up
  const viewW = viewJar.offsetWidth;
  const viewH = viewJar.offsetHeight;
  const targetSize = Math.min(viewW * 0.5, viewH * 0.75, 500);
  const targetX = viewW / 2;
  const targetY = viewH / 2;

  // Apply zoomed state
  const el = circle.element;
  el.classList.add('zoomed');
  el.style.left = targetX + 'px';
  el.style.top = targetY + 'px';
  el.style.width = targetSize + 'px';
  el.style.height = targetSize + 'px';
  el.style.transform = 'translate(-50%, -50%)';

  // Show backdrop, hide other elements
  container.classList.add('has-zoomed');
  document.getElementById('jar-zoom-backdrop').classList.add('active');

  // Attach click handlers to inner elements for detail pane
  setupZoomedClickHandlers(circle);
}

function closeZoomOverlay() {
  const questionId = jarState.currentZoomedQuestionId;
  if (!questionId) return;

  const circle = jarState.circleInstances[questionId];
  if (!circle) return;

  const container = document.getElementById('jar-circles-container');
  const el = circle.element;

  // Restore original position and size
  el.classList.remove('zoomed');
  el.style.left = circle.position.x + 'px';
  el.style.top = circle.position.y + 'px';
  el.style.width = circle.size + 'px';
  el.style.height = circle.size + 'px';
  el.style.transform = 'translateX(-50%) translateY(-50%)';

  // Hide backdrop, show other elements
  container.classList.remove('has-zoomed');
  document.getElementById('jar-zoom-backdrop').classList.remove('active');

  jarState.currentZoomedQuestionId = null;
  closeDetailPane();
  removeEmptyStateUI(circle);
}

function removeEmptyStateUI(circle) {
  const existing = circle.element.querySelector('.jar-empty-state');
  if (existing) existing.remove();
}

function setupEmptyStateUI(circle) {
  removeEmptyStateUI(circle);
  const questionId = circle.questionId;
  const questionStr = OryzaeData.getQuestionString(questionId) || '';

  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'jar-empty-state';
  emptyDiv.innerHTML = `
    <div class="jar-empty-state-message">この問いはまだ発酵が始まっていません。<br>しばらくの間、この問いに関するエントリを書き続けてください。</div>
    <button class="jar-empty-state-btn">この問いのエントリを書く</button>
  `;
  circle.element.appendChild(emptyDiv);

  // Fade in after zoom animation completes (~1.2s)
  requestAnimationFrame(() => {
    setTimeout(() => {
      emptyDiv.classList.add('visible');
    }, 1200);
  });

  emptyDiv.querySelector('.jar-empty-state-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    // Close zoom overlay first
    closeZoomOverlay();
    // Create new entry and link this question
    startNewDocument();
    const entryId = State.get('currentEntryId');
    OryzaeData.linkQuestionToEntry(entryId, questionId);
    if (window.ToiManager) window.ToiManager.refresh();
    Navigation.switchTo('editor');
  });
}

function setupZoomedClickHandlers(circle) {
  const questionId = circle.questionId;
  const fermentation = OryzaeData.getFermentationForQuestion(questionId);
  if (!fermentation) {
    setupEmptyStateUI(circle);
    return;
  }

  const snippets = OryzaeData.getSnippetsForFermentation(fermentation.id);
  const keywords = OryzaeData.getKeywordsForFermentation(fermentation.id);

  // Attach click handlers to elements inside the circle
  circle.element.querySelectorAll('.jar-circle-element').forEach(el => {
    // Remove old listeners by cloning
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);

    newEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = newEl.dataset.type;
      const idx = parseInt(newEl.dataset.index) || 0;

      if (type === 'keyword') {
        showDetailPane(questionId, 'keyword', keywords, idx);
      } else if (type === 'snippet') {
        showDetailPane(questionId, 'snippet', snippets, idx);
      } else if (type === 'letter') {
        showDetailPane(questionId, 'letter', null, null);
      }
    });
  });
}

// ============================================================================
// DETAIL PANE
// ============================================================================

function showDetailPane(questionId, type, data, index) {
  const pane = document.getElementById('jar-detail-pane');
  const questionDiv = document.getElementById('jar-detail-question');
  const header = document.getElementById('jar-detail-header');
  const body = document.getElementById('jar-detail-body');
  const writeBtn = document.getElementById('jar-detail-write-btn');

  const question = OryzaeData.getQuestionString(questionId);
  questionDiv.textContent = question || '未タイトル';

  jarState.currentDetailElementType = type;

  if (type === 'snippet') {
    header.textContent = 'Oryzae が切り取った文章';
    body.innerHTML = '';

    const snippet = (index != null && data) ? data[index] : (data ? data[0] : null);
    if (snippet) {
      const item = document.createElement('div');
      item.className = 'snippet-item';
      item.innerHTML = `
        <div class="snippet-text">${snippet.original_text}</div>
        <div class="snippet-source">出典: ${snippet.source_date}</div>
        <div class="snippet-reason">${snippet.selection_reason}</div>
      `;
      body.appendChild(item);
    }
  } else if (type === 'keyword') {
    header.textContent = 'Yeast が生成したキーワード';
    body.innerHTML = '';

    const keyword = (index != null && data) ? data[index] : (data ? data[0] : null);
    if (keyword) {
      const item = document.createElement('div');
      item.className = 'keyword-item';
      item.innerHTML = `
        <div class="keyword-name">${keyword.keyword}</div>
        <div class="keyword-desc">${keyword.description}</div>
      `;
      body.appendChild(item);
    }
  } else if (type === 'letter') {
    header.textContent = 'Lab からの手紙';
    body.innerHTML = '';

    const fermentation = OryzaeData.getFermentationForQuestion(questionId);
    const letter = OryzaeData.getLetterForFermentation(fermentation.id);

    const letterText = document.createElement('div');
    letterText.className = 'letter-text';
    letterText.innerHTML = letter.body_text.split('\n\n').map(p => `<p>${p}</p>`).join('');
    body.appendChild(letterText);
  }

  pane.classList.add('active');

  // Write button handler
  writeBtn.onclick = () => {
    OryzaeData.linkQuestionToEntry(State.get('currentEntryId'), questionId);
    Navigation.switchTo('editor');
  };
}

function closeDetailPane() {
  const pane = document.getElementById('jar-detail-pane');
  pane.classList.remove('active');
}

// ============================================================================
// QUESTION MANAGEMENT
// ============================================================================

function renderQuestionList() {
  const container = document.getElementById('jar-question-items');
  const addBtn = document.getElementById('jar-add-question-btn');

  const questions = OryzaeData.getActiveQuestions();

  container.innerHTML = '';
  questions.forEach(q => {
    const text = OryzaeData.getQuestionString(q.id);
    const tag = document.createElement('div');
    tag.className = 'jar-question-tag';
    tag.textContent = text || '未タイトル';
    tag.style.cursor = 'pointer';
    tag.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditQuestionModal(q.id);
    });
    container.appendChild(tag);
  });

  addBtn.style.display = questions.length < 3 ? 'block' : 'none';
}

function openAddQuestionModal() {
  const modal = document.getElementById('jar-modal-overlay');
  const input = document.getElementById('jar-modal-input');
  const saveBtn = document.getElementById('jar-modal-save');
  const cancelBtn = document.getElementById('jar-modal-cancel');

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
  input.focus();

  const save = () => {
    const text = input.value.trim();
    if (text) {
      OryzaeData.addQuestion(text);
      input.value = '';
      closeAddQuestionModal();
      renderJar();
    }
  };

  saveBtn.onclick = save;
  input.onkeypress = (e) => {
    if (e.key === 'Enter') save();
  };

  cancelBtn.onclick = closeAddQuestionModal;
}

function closeAddQuestionModal() {
  const modal = document.getElementById('jar-modal-overlay');
  modal.classList.remove('active');
  setTimeout(() => modal.style.display = 'none', 300);
}

// ============================================================================
// EDIT/ARCHIVE QUESTION MODAL
// ============================================================================

function openEditQuestionModal(questionId) {
  const modal = document.getElementById('jar-edit-modal-overlay');
  const input = document.getElementById('jar-edit-modal-input');
  const saveBtn = document.getElementById('jar-edit-modal-save');
  const cancelBtn = document.getElementById('jar-edit-modal-cancel');
  const archiveBtn = document.getElementById('jar-edit-modal-archive');
  const charCount = document.getElementById('jar-edit-char-count');

  const currentString = OryzaeData.getQuestionString(questionId) || '';
  input.value = currentString;
  if (charCount) charCount.textContent = currentString.length + '/64';

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  input.oninput = () => {
    if (charCount) charCount.textContent = input.value.length + '/64';
  };

  const save = () => {
    const text = input.value.trim();
    if (text && text !== currentString) {
      OryzaeData.updateQuestion(questionId, text);
      closeEditQuestionModal();
      renderJar();
    } else {
      closeEditQuestionModal();
    }
  };

  saveBtn.onclick = save;
  cancelBtn.onclick = closeEditQuestionModal;

  archiveBtn.onclick = () => {
    OryzaeData.archiveQuestion(questionId);
    closeEditQuestionModal();
    renderJar();
  };

  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) closeEditQuestionModal();
  };
}

function closeEditQuestionModal() {
  const modal = document.getElementById('jar-edit-modal-overlay');
  modal.classList.remove('active');
  setTimeout(() => modal.style.display = 'none', 300);
}

// ============================================================================
// MAIN JAR VIEW
// ============================================================================

function renderJar() {
  const container = document.getElementById('jar-circles-container');
  if (!container) return;

  // Clear existing circles
  Object.values(jarState.circleInstances).forEach(circle => circle.unmount());
  jarState.circleInstances = {};

  const questions = OryzaeData.getActiveQuestions();
  // Calculate circle size based on container height to avoid overflow
  const containerH = container.offsetHeight || 600;
  const containerW = container.offsetWidth || 1000;
  const circleSize = Math.min(240, containerH * 0.38);

  const positions = [
    { x: 80, y: 22 },  // top-right (further from jar)
    { x: 72, y: 72 },  // bottom center-right (below jar, offset right)
    { x: 14, y: 46 }   // center-left (further from jar)
  ];

  questions.forEach((q, idx) => {
    if (idx < positions.length) {
      const pos = positions[idx];
      const x = containerW * (pos.x / 100);
      const y = containerH * (pos.y / 100);

      const circle = new CircleGraphic(q.id, { x, y }, circleSize);
      circle.mount();
      circle.attachClickHandler(openZoomOverlay);

      jarState.circleInstances[q.id] = circle;
    }
  });

  renderQuestionList();
  updateConnectionLines();
}

function animateJar(currentTime) {
  if (!jarRenderer) return;

  const elapsedTime = jarClock.getElapsedTime();

  // Update jar bottle
  jarRenderer.update(elapsedTime);

  // Update circles
  Object.values(jarState.circleInstances).forEach(circle => {
    circle.update(elapsedTime);
  });

  updateConnectionLines();

  if (jarIsAnimating) {
    animationFrameId = requestAnimationFrame(animateJar);
  }
}

// ============================================================================
// JAR VIEW CONTROLLER
// ============================================================================

let jarListenersAttached = false;

const JarView = {
  activate() {
    const jarContainer = document.getElementById('jar-bottle-container');

    if (!jarContainer) {
      console.error('jar-bottle-container not found');
      return;
    }

    // Initialize Three.js renderer (once)
    if (!jarRenderer) {
      jarRenderer = new JarBottle(jarContainer);
      window.jarRenderer = jarRenderer;
      jarClock = new THREE.Clock();
    }

    // Render circles
    renderJar();

    // Setup event listeners (once)
    if (!jarListenersAttached) {
      jarListenersAttached = true;

      const zoomBackdrop = document.getElementById('jar-zoom-backdrop');
      zoomBackdrop.addEventListener('click', (e) => {
        if (e.target === zoomBackdrop) {
          closeDetailPane();
          closeZoomOverlay();
        }
      });

      document.getElementById('jar-detail-close').addEventListener('click', closeDetailPane);
      document.getElementById('jar-add-question-btn').addEventListener('click', openAddQuestionModal);

      // Close modal overlay on click outside
      document.getElementById('jar-modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('jar-modal-overlay')) closeAddQuestionModal();
      });
    }

    // Start animation
    jarIsAnimating = true;
    animationFrameId = requestAnimationFrame(animateJar);
  },

  deactivate() {
    jarIsAnimating = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  },

  dispose() {
    this.deactivate();
    if (jarRenderer) {
      jarRenderer.dispose();
      jarRenderer = null;
      window.jarRenderer = null;
    }
  }
};

// Export for use by Navigation
if (typeof window !== 'undefined') {
  window.JarView = JarView;
}
