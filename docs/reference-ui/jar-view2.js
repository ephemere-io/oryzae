/**
 * JarView2 — Redesigned Jar view using SVG/CSS (no Three.js)
 * Ported from new_jar_14.html mockup design.
 *
 * This module mirrors the same data/interaction contract as JarView (jar-view-new.js)
 * but renders with a completely different visual style.
 */

const JarView2 = (() => {
  // ── State ──
  let isActive = false;
  let animFrame = null;
  let initialised = false;
  let jarState = { zoomedQuestion: null, detailType: null, detailElement: null };
  let resizeHandler = null;

  // ── DOM references ──
  const $ = id => document.getElementById(id);

  // ── Helpers ──
  function seededRandom(seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
    return function() { s = (s * 16807 + 0) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
  }

  // Microbe SVG templates (shared between jar & circles)
  const microbeSVG = {
    koji: `<svg viewBox="0 0 28 28"><g fill="none"><path d="M14,24 C10,20 8,14 12,8 C14,6 16,6 18,8 C22,12 22,18 18,22" stroke="#A3B8A8" stroke-width="2" stroke-linecap="round" opacity="0.65"/><ellipse cx="14" cy="6" rx="3.5" ry="5" fill="#A3B8A8" opacity="0.35"/><ellipse cx="9" cy="10" rx="2" ry="3" fill="#8EA89C" opacity="0.45"/><ellipse cx="19" cy="14" rx="1.5" ry="2.5" fill="#8EA89C" opacity="0.3"/></g></svg>`,
    yeast: `<svg viewBox="0 0 24 36"><g fill="#D9B48F" opacity="0.55"><rect x="8" y="4" width="8" height="20" rx="4" fill="#D9B48F" opacity="0.6"/><rect x="6" y="2" width="5" height="14" rx="2.5" fill="#E2C28E" opacity="0.7"/><rect x="14" y="8" width="4" height="12" rx="2" fill="#D9B48F" opacity="0.45"/><rect x="10" y="20" width="4" height="10" rx="2" fill="#E2C28E" opacity="0.5"/></g></svg>`,
    lab: `<svg viewBox="0 0 32 20"><g fill="none"><path d="M6,14 Q12,6 18,12 Q26,18 30,10" stroke="#A3B8A8" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/><circle cx="6" cy="14" r="3" fill="#A3B8A8" opacity="0.4"/><circle cx="18" cy="12" r="2.5" fill="#8EA89C" opacity="0.35"/><circle cx="30" cy="10" r="2" fill="#A3B8A8" opacity="0.3"/></g></svg>`
  };
  const microbeTypes = ['koji', 'yeast', 'lab'];

  // Circle positions (keep same as jar-view-new.js — NOT overlapping jar)
  const circlePositions = [
    { x: 80, y: 22 }, // top-right
    { x: 72, y: 72 }, // bottom center-right
    { x: 14, y: 46 }, // center-left
  ];

  // ── SVG Jar Bottle ──
  function renderBottle() {
    const container = $('j2-bottle-container');
    if (!container) return;
    container.innerHTML = `
      <div class="j2-jar-glow"></div>
      <svg class="j2-jar-svg" viewBox="0 0 480 600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M190,100 C190,60 290,60 290,100 C290,130 270,140 270,170 C270,270 410,330 410,480 C410,580 70,580 70,480 C70,330 210,270 210,170 C210,140 190,130 190,100 Z"
              fill="rgba(253,251,247,0.2)" stroke="rgba(255,255,255,0.8)" stroke-width="1.5" class="j2-jar-glass"/>
        <path d="M78,450 C78,350 180,310 200,240 C220,240 270,310 402,450 C410,580 70,580 78,450 Z"
              fill="url(#j2-fermentGradient)" opacity="0.6" filter="blur(12px)"/>
        <path d="M100,460 C100,340 220,270 220,180" stroke="url(#j2-highlightGradient)" stroke-width="4" stroke-linecap="round" filter="blur(2px)" opacity="0.7"/>
        <path d="M380,480 C380,380 260,280 260,190" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" filter="blur(1px)"/>
        <path d="M210,100 Q 240,110 270,100" stroke="rgba(255,255,255,0.9)" stroke-width="3" stroke-linecap="round" filter="blur(1px)"/>
        <g stroke="rgba(226,194,142,0.4)" stroke-width="0.75" fill="none" opacity="0.8">
          <path d="M240,280 Q 280,350 250,420 T 320,520" class="j2-float-1"/>
          <path d="M320,320 Q 290,380 340,440 T 260,540" class="j2-float-2"/>
          <path d="M200,220 Q 240,290 180,350 T 210,480" class="j2-float-3"/>
          <path d="M160,360 Q 140,420 200,460 T 140,530" class="j2-float-1"/>
          <path d="M260,200 Q 270,250 240,290"/>
        </g>
        <defs>
          <linearGradient id="j2-fermentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(226,194,142,0.1)"/>
            <stop offset="50%" stop-color="rgba(142,168,156,0.2)"/>
            <stop offset="100%" stop-color="rgba(226,194,142,0.4)"/>
          </linearGradient>
          <linearGradient id="j2-highlightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.8)"/>
            <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
          </linearGradient>
        </defs>
      </svg>
      <div class="j2-jar-content" id="j2-jar-content"></div>
    `;
  }

  // ── Text particles inside jar ──
  const textParticleWords = ['発酵', '記憶', '静寂', '光', '闇', '朝', '麹', '息'];
  const fillerWords = ['米', '水', '土壌', '醸す', '問い', '時間', '沈殿', '風', '季節', '菌', '熱', '繁殖', '心', '秋', '瀬'];

  function renderJarContent() {
    const container = $('j2-jar-content');
    if (!container) return;
    container.innerHTML = '';

    const allWords = [...textParticleWords, ...fillerWords];
    const floatClasses = ['j2-float-1', 'j2-float-2', 'j2-float-3'];
    const blurLevels = [0.6, 0.8, 1.2, 1.8, 2.2, 2.5, 3.5, 4];

    allWords.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = `j2-jar-text ${floatClasses[i % 3]}`;
      span.textContent = word;
      const top = 18 + (i * 37 % 65);
      const left = 22 + (i * 53 % 60);
      const blur = blurLevels[i % blurLevels.length];
      const fontSize = [11, 12, 14, 16, 18, 22, 26][i % 7];
      const opacity = 0.3 + (i % 5) * 0.12;
      span.style.cssText = `position:absolute;top:${top}%;left:${left}%;filter:blur(${blur}px);font-size:${fontSize}px;opacity:${opacity};cursor:default;letter-spacing:0.15em;transition:color 0.3s;`;
      container.appendChild(span);
    });

    // Microbes inside jar
    const jarMicrobes = [
      { type: 'koji', top: '32%', left: '55%', size: 32, anim: 'j2-float-2', opacity: 0.5 },
      { type: 'yeast', top: '52%', left: '22%', size: 24, anim: 'j2-float-3', opacity: 0.45 },
      { type: 'lab', top: '75%', left: '60%', size: 36, anim: 'j2-float-1', opacity: 0.4 },
      { type: 'koji', top: '15%', left: '68%', size: 28, anim: 'j2-float-2', opacity: 0.5 },
      { type: 'yeast', top: '45%', left: '78%', size: 24, anim: 'j2-float-1', opacity: 0.55 },
      { type: 'lab', top: '65%', left: '35%', size: 32, anim: 'j2-float-3', opacity: 0.4 },
    ];
    jarMicrobes.forEach(m => {
      const div = document.createElement('div');
      div.className = `j2-jar-microbe ${m.anim}`;
      div.style.cssText = `position:absolute;top:${m.top};left:${m.left};width:${m.size}px;height:${m.size}px;opacity:${m.opacity};pointer-events:none;`;
      div.innerHTML = microbeSVG[m.type] || '';
      container.appendChild(div);
    });
  }

  // ── Data Access (OryzaeData) ──
  function getActiveQuestions() {
    if (typeof OryzaeData === 'undefined') return [];
    return OryzaeData.getActiveQuestions().map(q => ({
      ...q,
      text: OryzaeData.getQuestionString(q.id) || '(問い)'
    }));
  }

  function getFermentationData(questionId) {
    if (typeof OryzaeData === 'undefined') return { keywords: [], snippets: [], letters: [], entryIds: [] };
    try {
      const ferm = OryzaeData.getFermentationForQuestion(questionId);
      if (!ferm) return { keywords: [], snippets: [], letters: [], entryIds: [] };

      const keywords = OryzaeData.getKeywordsForFermentation(ferm.id).map(kw => ({
        text: kw.keyword || '', description: kw.description || '', ...kw
      }));
      const snippets = OryzaeData.getSnippetsForFermentation(ferm.id).map(sn => ({
        text: sn.original_text || '', reason: sn.selection_reason || '', ...sn
      }));
      const letter = OryzaeData.getLetterForFermentation(ferm.id);
      const letters = letter ? [{ text: letter.body_text || '', ...letter }] : [];

      const links = OryzaeData.entryQuestionLinks
        ? OryzaeData.entryQuestionLinks.filter(l => l.question_id === questionId)
        : [];
      const entryIds = links.map(l => l.entry_id);

      return { keywords, snippets, letters, entryIds };
    } catch {
      return { keywords: [], snippets: [], letters: [], entryIds: [] };
    }
  }

  // ── Question Circles ──
  function renderCircles() {
    const container = $('j2-circles-container');
    if (!container) return;

    // Don't re-render while zoomed — would destroy zoom state
    if (jarState.zoomedQuestion) return;

    container.innerHTML = '';

    const questions = getActiveQuestions();
    if (questions.length === 0) return;

    questions.slice(0, 3).forEach((q, i) => {
      const pos = circlePositions[i];
      const circle = createCircleElement(q, i, pos);
      container.appendChild(circle);
    });

    // Wait for layout before computing connection line positions
    requestAnimationFrame(() => {
      renderConnectionLines(questions);
    });
  }

  function createCircleElement(question, index, pos) {
    const el = document.createElement('div');
    el.className = 'j2-circle';
    el.dataset.questionId = question.id;
    el.dataset.posIndex = index;

    const size = 280 + index * 10;

    el.style.cssText = `position:absolute;left:${pos.x}%;top:${pos.y}%;transform:translate(-50%,-50%);width:${size}px;height:${size}px;`;

    // Build circle SVG layers
    el.innerHTML = `
      <div class="j2-circle-glow"></div>
      <!-- Rotating question text ring -->
      <div class="j2-circle-text-ring" style="width:${size}px;height:${size}px;">
        <svg viewBox="0 0 ${size} ${size}" class="j2-circle-text-svg">
          <path id="j2-ring-${question.id}" d="M ${size/2},${size/2} m ${-(size/2-12)},0 a ${size/2-12},${size/2-12} 0 1,1 ${(size-24)},0 a ${size/2-12},${size/2-12} 0 1,1 ${-(size-24)},0" fill="transparent"/>
          <text class="j2-ring-text"><textPath href="#j2-ring-${question.id}" startOffset="0%">${question.text} • </textPath></text>
        </svg>
      </div>
      <!-- Mycelium lines from center -->
      <svg class="j2-mycelium-svg" viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px;">
        <g stroke="rgba(226,194,142,0.6)" stroke-width="1.2" fill="none" stroke-linecap="round">
          ${generateMyceliumPaths(size, question.id)}
        </g>
      </svg>
      <!-- Inner content — positioned ABOVE circle (no overflow hidden) -->
      <div class="j2-circle-inner" style="width:${size}px;height:${size}px;">
        <!-- Content rendered separately -->
      </div>
    `;

    // Render contents into the inner div
    const inner = el.querySelector('.j2-circle-inner');
    renderCircleContentsDom(inner, question, index, size);

    // Click handler for zoom
    el.addEventListener('click', (e) => {
      e.stopPropagation(); // Always prevent backdrop from closing
      if (jarState.zoomedQuestion === question.id) return;
      openZoomOverlay(el, question);
    });

    return el;
  }

  function generateMyceliumPaths(size, qId) {
    const cx = size / 2, cy = size / 2;
    const rng = seededRandom(qId + '_mycelium');
    const paths = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const endR = size / 2 - 20;
      const midR = endR * (0.35 + rng() * 0.3);
      const midAngle = angle + (rng() - 0.5) * 0.6;
      const mx = cx + Math.cos(midAngle) * midR;
      const my = cy + Math.sin(midAngle) * midR;
      const ex = cx + Math.cos(angle) * endR;
      const ey = cy + Math.sin(angle) * endR;
      paths.push(`<path d="M${cx},${cy} C ${mx},${my} ${mx},${my} ${ex},${ey}" stroke-dasharray="4 4"/>`);
    }
    return paths.join('\n');
  }

  function renderCircleContentsDom(inner, question, index, size) {
    const ferm = getFermentationData(question.id);
    const isEmpty = !ferm || (ferm.keywords.length === 0 && ferm.snippets.length === 0 && ferm.letters.length === 0);

    if (isEmpty) {
      // Empty circle — floating microbes
      const positions = [
        { top: 30, left: 40, size: 28 }, { top: 50, left: 25, size: 24 },
        { top: 60, left: 60, size: 32 }, { top: 25, left: 65, size: 24 },
        { top: 70, left: 38, size: 28 }, { top: 40, left: 70, size: 20 },
      ];
      positions.forEach((p, i) => {
        const type = microbeTypes[i % 3];
        const div = document.createElement('div');
        div.className = `j2-circle-microbe j2-float-${(i % 3) + 1}`;
        div.style.cssText = `position:absolute;top:${p.top}%;left:${p.left}%;width:${p.size}px;height:${p.size}px;opacity:0.45;pointer-events:none;`;
        div.innerHTML = microbeSVG[type];
        inner.appendChild(div);
      });
      return;
    }

    // Keywords with attached microbe — spread evenly across circle
    const kwPositions = [
      { top: 20, left: 55 },
      { top: 38, left: 18 },
      { top: 55, left: 65 },
      { top: 72, left: 28 },
      { top: 45, left: 45 },
    ];
    ferm.keywords.slice(0, 5).forEach((kw, i) => {
      const kwPos = kwPositions[i] || { top: 35 + i * 12, left: 20 + i * 15 };
      const top = kwPos.top;
      const left = kwPos.left;
      const floatClass = ['j2-float-1', 'j2-float-2', 'j2-float-3'][i % 3];
      const mType = microbeTypes[i % 3];

      const wrapper = document.createElement('div');
      wrapper.className = `j2-circle-element-wrapper ${floatClass}`;
      wrapper.style.cssText = `position:absolute;top:${top}%;left:${left}%;`;
      wrapper.innerHTML = `
        <div class="j2-circle-keyword" data-type="keyword" data-index="${i}">
          ${kw.text}
          <span class="j2-element-microbe">${microbeSVG[mType]}</span>
        </div>
      `;
      inner.appendChild(wrapper);
    });

    // Snippets with attached microbe — positioned to avoid keyword overlap
    const snPositions = [
      { top: 30, left: 35 },
      { top: 60, left: 15 },
      { top: 50, left: 75 },
    ];
    ferm.snippets.slice(0, 3).forEach((sn, i) => {
      const snPos = snPositions[i] || { top: 40 + i * 18, left: 25 + i * 20 };
      const top = snPos.top;
      const left = snPos.left;
      const floatClass = ['j2-float-1', 'j2-float-2', 'j2-float-3'][(i + 1) % 3];
      const mType = microbeTypes[(i + 1) % 3];
      const rawText = typeof sn.text === 'string' ? sn.text : '';
      const displayText = rawText.substring(0, 60) + (rawText.length > 60 ? '…' : '');

      const wrapper = document.createElement('div');
      wrapper.className = `j2-circle-element-wrapper ${floatClass}`;
      wrapper.style.cssText = `position:absolute;top:${top}%;left:${left}%;`;
      wrapper.innerHTML = `
        <div class="j2-circle-snippet" data-type="snippet" data-index="${i}">
          <p class="j2-snippet-text">「${displayText}</p>
          <div class="j2-snippet-dot"></div>
          <span class="j2-element-microbe j2-microbe-bottom">${microbeSVG[mType]}</span>
        </div>
      `;
      inner.appendChild(wrapper);
    });

    // Letter with attached microbe
    if (ferm.letters.length > 0) {
      const wrapper = document.createElement('div');
      wrapper.className = 'j2-circle-element-wrapper j2-float-2';
      wrapper.style.cssText = 'position:absolute;top:72%;left:52%;';
      wrapper.innerHTML = `
        <div class="j2-circle-letter" data-type="letter" data-index="0">
          <svg class="j2-letter-icon" viewBox="0 0 16 16" fill="none">
            <path d="M1 4L8 9L15 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1 4V12H15V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 8L1 12" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>
            <path d="M11 8L15 12" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>
          </svg>
          <div class="j2-letter-dot"></div>
          <span class="j2-element-microbe">${microbeSVG.lab}</span>
        </div>
      `;
      inner.appendChild(wrapper);
    }
  }

  // ── Connection Lines (responsive to resize) ──
  function getJarCenter() {
    const bottle = $('j2-bottle-container');
    if (!bottle) return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.42 };
    const rect = bottle.getBoundingClientRect();
    // The visual center of the jar body (lower than geometric center)
    return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.55 };
  }

  function getCircleCenter(questionId) {
    const circleEl = document.querySelector(`#j2-circles-container .j2-circle[data-question-id="${questionId}"]`);
    if (!circleEl) return null;
    const rect = circleEl.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function renderConnectionLines(questions) {
    const svg = $('j2-connection-lines');
    if (!svg) return;
    svg.innerHTML = '';

    // Get view container offset to convert viewport coords to SVG-relative coords
    const viewContainer = $('view-jar2');
    const viewRect = viewContainer ? viewContainer.getBoundingClientRect() : { left: 0, top: 0 };

    const jarC = getJarCenter();
    // Convert to SVG-relative coordinates
    jarC.x -= viewRect.left;
    jarC.y -= viewRect.top;

    questions.slice(0, 3).forEach((q, i) => {
      const circleC = getCircleCenter(q.id);
      if (!circleC) return;

      // Convert to SVG-relative coordinates
      circleC.x -= viewRect.left;
      circleC.y -= viewRect.top;

      // Start point: seeded random inside jar
      const rng = seededRandom(q.id);
      const startX = jarC.x + (rng() - 0.5) * 100;
      const startY = jarC.y + (rng() - 0.5) * 60;

      // End point: circle center
      const endX = circleC.x;
      const endY = circleC.y;

      // Control point
      const cpX = (startX + endX) / 2 + (rng() - 0.5) * 100;
      const cpY = (startY + endY) / 2 + (rng() - 0.5) * 60;

      // Glow line
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', 'rgba(142,168,156,0.08)');
      glow.setAttribute('stroke-width', '10');
      glow.setAttribute('filter', 'blur(8px)');
      svg.appendChild(glow);

      // Animated dashed line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', 'rgba(142,168,156,0.25)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4 10');
      line.setAttribute('stroke-linecap', 'round');
      line.classList.add('j2-flow-line');
      line.style.animationDuration = `${60 + i * 10}s`;
      svg.appendChild(line);
    });
  }

  // ── Question List (bottom) ──
  function renderQuestionList() {
    const container = $('j2-question-items');
    if (!container) return;
    container.innerHTML = '';

    const questions = getActiveQuestions();
    questions.forEach(q => {
      const tag = document.createElement('div');
      tag.className = 'j2-question-tag';
      tag.textContent = q.text;
      tag.dataset.questionId = q.id;
      tag.addEventListener('click', () => handleQuestionTagClick(q));
      container.appendChild(tag);
    });

    const addBtn = $('j2-add-question-btn');
    if (addBtn) addBtn.style.display = questions.length < 3 ? '' : 'none';
  }

  function handleQuestionTagClick(question) {
    const overlay = $('j2-edit-modal-overlay');
    const input = $('j2-edit-modal-input');
    const charCount = $('j2-edit-char-count');
    if (!overlay || !input) return;

    input.value = question.text;
    charCount.textContent = `${question.text.length}/64`;
    overlay.style.display = '';
    overlay._questionId = question.id;
    input.focus();
  }

  // ── Zoom Overlay ──
  function openZoomOverlay(circleEl, question) {
    jarState.zoomedQuestion = question.id;

    // Store original size for restoration
    circleEl._origWidth = circleEl.style.width;
    circleEl._origHeight = circleEl.style.height;
    circleEl._origLeft = circleEl.style.left || circleEl.dataset.origLeft;
    circleEl._origTop = circleEl.style.top || circleEl.dataset.origTop;

    circleEl.classList.add('zoomed');

    const backdrop = $('j2-zoom-backdrop');
    if (backdrop) backdrop.classList.add('active');

    // Add has-zoomed to container so it sits above backdrop
    const container = $('j2-circles-container');
    if (container) container.classList.add('has-zoomed');

    // Hide question list and connection lines
    const questionList = $('j2-question-list');
    if (questionList) questionList.style.opacity = '0';
    const connLines = $('j2-connection-lines');
    if (connLines) connLines.style.opacity = '0';

    // Hide other circles
    document.querySelectorAll('#j2-circles-container .j2-circle').forEach(c => {
      if (c !== circleEl) {
        c.style.opacity = '0';
        c.style.pointerEvents = 'none';
      }
    });

    // Calculate zoom target size — large enough to read snippet text
    const viewJar = $('view-jar2');
    const viewW = viewJar ? viewJar.offsetWidth : window.innerWidth;
    const viewH = viewJar ? viewJar.offsetHeight : window.innerHeight;
    const targetSize = Math.min(viewW * 0.6, viewH * 0.8, 650);

    // Animate to center with enlarged size
    circleEl.style.transition = 'all 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
    circleEl.style.left = '50%';
    circleEl.style.top = '50%';
    circleEl.style.width = targetSize + 'px';
    circleEl.style.height = targetSize + 'px';
    circleEl.style.zIndex = '55';
    circleEl.style.pointerEvents = 'auto';

    // Update inner content sizing to match new circle size
    const inner = circleEl.querySelector('.j2-circle-inner');
    if (inner) {
      inner.style.width = targetSize + 'px';
      inner.style.height = targetSize + 'px';
      inner.style.pointerEvents = 'auto';
    }

    // Update text ring and mycelium SVGs to match new size
    const textRing = circleEl.querySelector('.j2-circle-text-ring');
    if (textRing) {
      textRing.style.width = targetSize + 'px';
      textRing.style.height = targetSize + 'px';
    }
    const myceliumSvg = circleEl.querySelector('.j2-mycelium-svg');
    if (myceliumSvg) {
      myceliumSvg.style.width = targetSize + 'px';
      myceliumSvg.style.height = targetSize + 'px';
    }

    // Wire element clicks (only once)
    circleEl.querySelectorAll('[data-type]').forEach(el => {
      if (!el._j2ClickWired) {
        el._j2ClickWired = true;
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          openDetailPane(question, el.dataset.type, parseInt(el.dataset.index));
        });
      }
    });

    // Also wire wrappers to stop propagation
    circleEl.querySelectorAll('.j2-circle-element-wrapper').forEach(wrapper => {
      if (!wrapper._j2ClickWired) {
        wrapper._j2ClickWired = true;
        wrapper.style.pointerEvents = 'auto';
        wrapper.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
    });
  }

  function closeZoomOverlay() {
    if (!jarState.zoomedQuestion) return;
    jarState.zoomedQuestion = null;

    const backdrop = $('j2-zoom-backdrop');
    if (backdrop) backdrop.classList.remove('active');

    // Remove has-zoomed from container
    const container = $('j2-circles-container');
    if (container) container.classList.remove('has-zoomed');

    // Show question list and connection lines again
    const questionList = $('j2-question-list');
    if (questionList) { questionList.style.transition = 'opacity 0.6s'; questionList.style.opacity = ''; }
    const connLines = $('j2-connection-lines');
    if (connLines) { connLines.style.transition = 'opacity 0.6s'; connLines.style.opacity = ''; }

    const questions = getActiveQuestions();
    document.querySelectorAll('#j2-circles-container .j2-circle').forEach(c => {
      c.classList.remove('zoomed');
      c.style.opacity = '';
      c.style.zIndex = '';
      c.style.pointerEvents = '';
      c.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';

      // Restore original size
      const idx = parseInt(c.dataset.posIndex);
      const origSize = 280 + idx * 10;
      c.style.width = origSize + 'px';
      c.style.height = origSize + 'px';

      // Restore inner, text ring, mycelium sizes
      const inner = c.querySelector('.j2-circle-inner');
      if (inner) { inner.style.width = origSize + 'px'; inner.style.height = origSize + 'px'; inner.style.pointerEvents = ''; }
      const textRing = c.querySelector('.j2-circle-text-ring');
      if (textRing) { textRing.style.width = origSize + 'px'; textRing.style.height = origSize + 'px'; }
      const myceliumSvg = c.querySelector('.j2-mycelium-svg');
      if (myceliumSvg) { myceliumSvg.style.width = origSize + 'px'; myceliumSvg.style.height = origSize + 'px'; }

      // Reset position
      const qId = c.dataset.questionId;
      const qIdx = questions.findIndex(q => q.id === qId);
      if (qIdx >= 0 && circlePositions[qIdx]) {
        c.style.left = circlePositions[qIdx].x + '%';
        c.style.top = circlePositions[qIdx].y + '%';
      }
    });

    closeDetailPane();

    // Re-render connection lines after animation
    setTimeout(() => {
      if (isActive) renderConnectionLines(questions);
    }, 900);
  }

  // ── Detail Pane ──
  function openDetailPane(question, type, index) {
    const pane = $('j2-detail-pane');
    if (!pane) return;

    const ferm = getFermentationData(question.id);
    let title = '', body = '';

    if (type === 'keyword') {
      title = 'Yeast keyword';
      const kw = ferm.keywords[index];
      body = kw ? `${kw.text}\n\n${kw.description || ''}` : '';
    } else if (type === 'snippet') {
      title = 'Oryzae snippet';
      const sn = ferm.snippets[index];
      body = sn ? `${sn.text}\n\n${sn.reason || ''}` : '';
    } else if (type === 'letter') {
      title = 'Lab letter';
      const lt = ferm.letters[index];
      body = lt ? lt.text : '';
    }

    $('j2-detail-question').textContent = question.text;
    $('j2-detail-header').textContent = title;
    $('j2-detail-body').innerText = body;

    pane._currentQuestion = question;
    pane.classList.add('open');
    jarState.detailType = type;
    jarState.detailElement = index;
  }

  function closeDetailPane() {
    const pane = $('j2-detail-pane');
    if (pane) pane.classList.remove('open');
    jarState.detailType = null;
    jarState.detailElement = null;
  }

  // ── Modal Handlers ──
  function initModals() {
    const addBtn = $('j2-add-question-btn');
    const modalOverlay = $('j2-modal-overlay');
    const modalInput = $('j2-modal-input');
    const modalCancel = $('j2-modal-cancel');
    const modalSave = $('j2-modal-save');

    if (addBtn) addBtn.addEventListener('click', () => {
      modalOverlay.style.display = '';
      modalInput.value = '';
      modalInput.focus();
    });
    if (modalCancel) modalCancel.addEventListener('click', () => { modalOverlay.style.display = 'none'; });
    if (modalSave) modalSave.addEventListener('click', () => {
      const text = modalInput.value.trim();
      if (!text) return;
      addNewQuestion(text);
      modalOverlay.style.display = 'none';
      refresh();
    });

    const editOverlay = $('j2-edit-modal-overlay');
    const editInput = $('j2-edit-modal-input');
    const editCharCount = $('j2-edit-char-count');
    const editCancel = $('j2-edit-modal-cancel');
    const editSave = $('j2-edit-modal-save');
    const editArchive = $('j2-edit-modal-archive');

    if (editInput) editInput.addEventListener('input', () => {
      editCharCount.textContent = `${editInput.value.length}/64`;
    });
    if (editCancel) editCancel.addEventListener('click', () => { editOverlay.style.display = 'none'; });
    if (editSave) editSave.addEventListener('click', () => {
      const text = editInput.value.trim();
      if (!text || !editOverlay._questionId) return;
      updateQuestion(editOverlay._questionId, text);
      editOverlay.style.display = 'none';
      refresh();
    });
    if (editArchive) editArchive.addEventListener('click', () => {
      if (!editOverlay._questionId) return;
      archiveQuestion(editOverlay._questionId);
      editOverlay.style.display = 'none';
      refresh();
    });

    // Detail pane
    const detailClose = $('j2-detail-close');
    if (detailClose) detailClose.addEventListener('click', closeDetailPane);

    const detailWrite = $('j2-detail-write-btn');
    if (detailWrite) detailWrite.addEventListener('click', () => {
      const pane = $('j2-detail-pane');
      if (pane && pane._currentQuestion) {
        if (window.ToiManager) window.ToiManager.set(pane._currentQuestion.id);
        closeDetailPane();
        closeZoomOverlay();
        Navigation.switchTo('editor');
      }
    });

    // Zoom backdrop
    const backdrop = $('j2-zoom-backdrop');
    if (backdrop) backdrop.addEventListener('click', () => closeZoomOverlay());
  }

  // ── Question CRUD (delegates to OryzaeData) ──
  function addNewQuestion(text) {
    if (typeof OryzaeData !== 'undefined' && OryzaeData.addQuestion) OryzaeData.addQuestion(text);
  }
  function updateQuestion(id, text) {
    if (typeof OryzaeData !== 'undefined' && OryzaeData.updateQuestionString) OryzaeData.updateQuestionString(id, text);
  }
  function archiveQuestion(id) {
    if (typeof OryzaeData !== 'undefined' && OryzaeData.archiveQuestion) OryzaeData.archiveQuestion(id);
  }

  // ── Refresh ──
  function refresh() {
    renderCircles();
    renderQuestionList();
  }

  // ── Resize handler ──
  function onResize() {
    if (!isActive || jarState.zoomedQuestion) return;
    renderConnectionLines(getActiveQuestions());
  }

  // ── Public API ──
  function activate() {
    if (!initialised) {
      renderBottle();
      renderJarContent();
      initModals();
      initialised = true;
    }
    refresh();
    isActive = true;

    // Debounced resize handler for connection lines
    if (!resizeHandler) {
      let resizeTimer;
      resizeHandler = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(onResize, 150); };
      window.addEventListener('resize', resizeHandler);
    }
  }

  function deactivate() {
    isActive = false;
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    closeZoomOverlay();
    closeDetailPane();
  }

  function dispose() {
    deactivate();
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
    initialised = false;
  }

  return { activate, deactivate, dispose, refresh };
})();
