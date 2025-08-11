(() => {
  const $ = (sel) => document.querySelector(sel);
  console.log('Dino game starting!');

  // State
  let running = false;
  let stars = 0;
  let spawnTimer = null;
  let watchdog = null;
  let activeDinos = 0;
  let centerDino = null;
  let dinoSizeScale = 1.0; // Current size multiplier
  let currentEffect = 'confetti'; // Current celebration effect
  let gameMode = 'normal'; // 'normal' or 'unlimited'

  // Elements
  const homeScreen = document.getElementById('screen-home');
  const playScreen = document.getElementById('screen-play');
  const playButton = document.getElementById('btn-play');
  const btnPlay = document.getElementById('btn-play');
  const btnHome = document.getElementById('btn-home');
  const starCounter = document.getElementById('stars');
  const playArea = document.getElementById('play-area');
  const btnSizeUp = document.getElementById('btn-size-up');
  const btnSizeDown = document.getElementById('btn-size-down');
  const sizeDisplay = document.getElementById('size-display');
  const effectSelector = document.getElementById('effect-selector');
  const modeSelector = document.getElementById('mode-selector');
  let dinoElements = Array.from(document.querySelectorAll('.dino-static'));

  // Config
  const MAX_CONCURRENT_DINOS = 10;
  const MIN_SPAWN_MS = 800;
  const MAX_SPAWN_MS = 1800;
  const DINO_LIFETIME_MS = 2500;
  const EDGE_MARGIN_PCT = 6; // allow closer-to-edge spawns for more scatter
  const CACHE_BUST = Date.now();
  const MAX_POOL = 10; // number of img nodes to manage
  const MIN_STAY_DINOS = 5; // don't auto-hide until at least this many are visible
  const DINO_ASSETS = [
    `assets/dino-assets/make-a-t-rex-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-t-rex-for-a-toddler-game (1).svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-triceratops-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-stegosaurus-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-stegosaurus-for-a-toddler-game (1).svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-diplodocus-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-pterodactyl-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-spinosaurus-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-velociraptor-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-velociraptor-for-a-toddler-game (1).svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/create-a-liopleurodon-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/create-an-ankylosaurus-for-a-toddler-game--make-su.svg?cb=${CACHE_BUST}`
  ];

  // Track ordering and per-dino timers
  const visibleQueue = [];
  const autoHideTimers = new Map();

  function showScreen(target) {
    const isHome = target === 'home';
    if (isHome) {
      homeScreen.classList.add('is-visible');
      playScreen.classList.remove('is-visible');
      homeScreen.setAttribute('aria-hidden', 'false');
      playScreen.setAttribute('aria-hidden', 'true');
    } else {
      homeScreen.classList.remove('is-visible');
      playScreen.classList.add('is-visible');
      homeScreen.setAttribute('aria-hidden', 'true');
      playScreen.setAttribute('aria-hidden', 'false');
    }
  }

  function grantStar() {
    stars++;
    starCounter.textContent = stars;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pick(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function getDinoNameFromPath(path) {
    if (!path) return 'Dinosaur';
    const fileName = path.split('/').pop();
    const dinoName = fileName.split('.')[0];
    // Capitalize first letter
    return dinoName.charAt(0).toUpperCase() + dinoName.slice(1);
  }

  // Celebration utilities
  function getTapPoint(e, el){
    if (e && e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e && e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    if (e && typeof e.clientX === 'number') return { x: e.clientX, y: e.clientY };
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  // Celebration effects registry
  const celebrationEffects = {
    confetti: function(x, y) {
      if (typeof confetti !== 'function') return;
      const nx = Math.min(Math.max(x / window.innerWidth, 0), 1);
      const ny = Math.min(Math.max(y / window.innerHeight, 0), 1);
      confetti({ particleCount: 36, spread: 55, startVelocity: 45, origin: { x: nx, y: ny }, scalar: 0.9 });
      setTimeout(() => confetti({ particleCount: 20, spread: 75, origin: { x: nx, y: ny }, decay: 0.92, scalar: 0.8 }), 60);
    },
    
    ring: function(x, y) {
      const ring = document.createElement('div');
      ring.className = 'celebration-ring';
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 800);
    },
    
    sparkles: function(x, y) {
      const colors = [
        { bg: 'radial-gradient(circle, #ffd700 0%, #ff6b35 100%)', glow: '#ffd700' },
        { bg: 'radial-gradient(circle, #ff69b4 0%, #ff1493 100%)', glow: '#ff69b4' },
        { bg: 'radial-gradient(circle, #00ffff 0%, #0080ff 100%)', glow: '#00ffff' },
        { bg: 'radial-gradient(circle, #32cd32 0%, #228b22 100%)', glow: '#32cd32' },
        { bg: 'radial-gradient(circle, #ff4500 0%, #dc143c 100%)', glow: '#ff4500' }
      ];
      
      for (let i = 0; i < 12; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'celebration-sparkle';
        
        // Varied movement patterns
        const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const distance = 60 + Math.random() * 40; // 60-100px
        const driftX = Math.cos(angle) * distance;
        const driftY = Math.sin(angle) * distance - 20; // Slight upward bias
        
        // Varied sizes and colors
        const size = 8 + Math.random() * 8; // 8-16px
        const colorSet = colors[Math.floor(Math.random() * colors.length)];
        const duration = 1.0 + Math.random() * 0.8; // 1.0-1.8s
        const rotation = Math.random() * 360;
        
        sparkle.style.left = x + 'px';
        sparkle.style.top = y + 'px';
        sparkle.style.setProperty('--drift-x', driftX + 'px');
        sparkle.style.setProperty('--drift-y', driftY + 'px');
        sparkle.style.setProperty('--sparkle-size', size + 'px');
        sparkle.style.setProperty('--sparkle-color', colorSet.bg);
        sparkle.style.setProperty('--glow-color', colorSet.glow);
        sparkle.style.setProperty('--duration', duration + 's');
        sparkle.style.setProperty('--rotation', rotation + 'deg');
        sparkle.style.animationDelay = (i * 40) + 'ms';
        
        document.body.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), duration * 1000 + 200);
      }
    },
    
    pop: function(x, y, dino) {
      if (dino) {
        // Set CSS variable for current scale
        dino.style.setProperty('--current-scale', dinoSizeScale);
        dino.style.animation = 'celebration-pop 0.3s ease-out';
        setTimeout(() => { 
          dino.style.animation = ''; 
          // Restore the proper transform with current scale
          dino.style.transform = `translate(-50%, -50%) scale(${dinoSizeScale})`;
        }, 300);
      }
    },
    
    fireworks: function(x, y) {
      // Launch trail
      const trail = document.createElement('div');
      trail.className = 'celebration-firework firework-trail';
      trail.style.left = x + 'px';
      trail.style.top = y + 'px';
      document.body.appendChild(trail);
      
      // Burst after delay
      setTimeout(() => {
        for (let i = 0; i < 12; i++) {
          const burst = document.createElement('div');
          burst.className = 'celebration-firework firework-burst';
          const angle = (i / 12) * Math.PI * 2;
          const distance = 30 + Math.random() * 20;
          const burstX = x + Math.cos(angle) * distance;
          const burstY = y - 80 + Math.sin(angle) * distance;
          burst.style.left = burstX + 'px';
          burst.style.top = burstY + 'px';
          burst.style.animationDelay = (i * 20) + 'ms';
          document.body.appendChild(burst);
          setTimeout(() => burst.remove(), 1200);
        }
        trail.remove();
      }, 800);
    },

    hearts: function(x, y) {
      for (let i = 0; i < 6; i++) {
        const heart = document.createElement('div');
        heart.className = 'celebration-heart';
        heart.innerHTML = '💖';
        const driftX = (Math.random() - 0.5) * 60;
        const driftY = -40 - Math.random() * 30;
        heart.style.left = x + 'px';
        heart.style.top = y + 'px';
        heart.style.setProperty('--drift-x', driftX + 'px');
        heart.style.setProperty('--drift-y', driftY + 'px');
        heart.style.animationDelay = (i * 100) + 'ms';
        document.body.appendChild(heart);
        setTimeout(() => heart.remove(), 2000);
      }
    },

    lightning: function(x, y) {
      const lightning = document.createElement('div');
      lightning.className = 'celebration-lightning';
      lightning.innerHTML = '⚡';
      lightning.style.left = x + 'px';
      lightning.style.top = y + 'px';
      document.body.appendChild(lightning);
      setTimeout(() => lightning.remove(), 600);
    },

    rainbow: function(x, y) {
      const rainbow = document.createElement('div');
      rainbow.className = 'celebration-rainbow';
      rainbow.style.left = x + 'px';
      rainbow.style.top = y + 'px';
      document.body.appendChild(rainbow);
      setTimeout(() => rainbow.remove(), 1500);
    },

    bubbles: function(x, y) {
      for (let i = 0; i < 8; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'celebration-bubble';
        const size = 8 + Math.random() * 12;
        const driftX = (Math.random() - 0.5) * 40;
        const driftY = -60 - Math.random() * 40;
        bubble.style.left = x + 'px';
        bubble.style.top = y + 'px';
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.setProperty('--drift-x', driftX + 'px');
        bubble.style.setProperty('--drift-y', driftY + 'px');
        bubble.style.animationDelay = (i * 80) + 'ms';
        document.body.appendChild(bubble);
        setTimeout(() => bubble.remove(), 2500);
      }
    },
    
    random: function(x, y, dino) {
      const effects = ['confetti', 'ring', 'sparkles', 'pop', 'fireworks', 'hearts', 'lightning', 'rainbow', 'bubbles'];
      const randomEffect = effects[Math.floor(Math.random() * effects.length)];
      celebrationEffects[randomEffect](x, y, dino);
    }
  };

  function celebrateAt(x, y, dino = null) {
    const effect = celebrationEffects[currentEffect];
    if (effect) effect(x, y, dino);
  }

  // Size control functions
  function updateDinoSizes() {
    dinoElements.forEach(dino => {
      dino.style.transform = `translate(-50%, -50%) scale(${dinoSizeScale})`;
    });
    sizeDisplay.textContent = `${dinoSizeScale.toFixed(1)}x`;
  }

  function increaseDinoSize() {
    dinoSizeScale += 0.5;
    updateDinoSizes();
  }

  function decreaseDinoSize() {
    if (dinoSizeScale > 0.5) {
      dinoSizeScale -= 0.5;
      updateDinoSizes();
    }
  }

  function startGame() {
    console.log('Starting game');
    running = true;
    stars = 0;
    starCounter.textContent = stars;
    visibleQueue.length = 0;
    autoHideTimers.forEach(id => clearTimeout(id));
    autoHideTimers.clear();
    
    // Set up dinosaur elements with event handlers
    dinoElements.forEach(d => {
        d.classList.remove('visible');
        d.src = '';
        d.addEventListener('click', onDinoTap);
        d.addEventListener('touchstart', onDinoTap, {passive: false});
    });

    // Ensure we have a pool of MAX_POOL image elements
    while (dinoElements.length < MAX_POOL) {
      const img = document.createElement('img');
      img.className = 'dino-static';
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Dinosaur');
      img.src = '';
      img.addEventListener('click', onDinoTap);
      img.addEventListener('touchstart', onDinoTap, {passive: false});
      playArea.appendChild(img);
      dinoElements.push(img);
    }
    
    showScreen('play');
    mainLoop();
    // Spawn one immediately
    spawnStaticDino();
  }

  function mainLoop() {
    if (!running) return;
    const timeout = randBetween(MIN_SPAWN_MS, MAX_SPAWN_MS);
    setTimeout(() => {
      if (!running) return;
      spawnStaticDino();
      mainLoop();
    }, timeout);
  }

  function spawnStaticDino() {
    if (!running) return;
    const visibleDinos = dinoElements.filter(d => d.classList.contains('visible'));
    
    // In unlimited mode, don't limit concurrent dinos or use FIFO
    if (gameMode === 'unlimited') {
      // Create new dino element if needed
      if (visibleDinos.length >= dinoElements.length) {
        const img = document.createElement('img');
        img.className = 'dino-static';
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', 'Dinosaur');
        img.src = '';
        img.addEventListener('click', onDinoTap);
        img.addEventListener('touchstart', onDinoTap, {passive: false});
        playArea.appendChild(img);
        dinoElements.push(img);
      }
    } else {
      // Normal mode: limit concurrent dinos and use FIFO
      if (visibleDinos.length >= MAX_CONCURRENT_DINOS) {
        const oldest = visibleQueue.shift();
        if (oldest && oldest.el) hideDino(oldest.el);
      }
    }

    const dino = pick(dinoElements.filter(d => !d.classList.contains('visible')));

    if (dino) {
      const dinoAsset = pick(DINO_ASSETS);
      // Encode to safely handle spaces/parentheses in filenames
      dino.src = encodeURI(dinoAsset);
      dino.setAttribute('aria-label', getDinoNameFromPath(dinoAsset));

      // Position and show
      const x = randBetween(EDGE_MARGIN_PCT, 100 - EDGE_MARGIN_PCT);
      const y = randBetween(10, 90); // expand vertical spawn range
      dino.style.left = x + '%';
      dino.style.top = y + '%';
      dino.classList.add('visible');
      visibleQueue.push({ el: dino, shownAt: Date.now() });
      
      // Auto-hide only once enough dinos are visible
      scheduleAutoHide(dino);
    }
  }

  function scheduleAutoHide(dino) {
    const t = setTimeout(() => {
      if (!running) return;
      const visibleCount = dinoElements.filter(d => d.classList.contains('visible')).length;
      
      // In unlimited mode, never auto-hide dinos
      if (gameMode === 'unlimited') {
        return;
      }
      
      // Normal mode: only hide if enough dinos are visible
      if (visibleCount >= MIN_STAY_DINOS) {
        if (dino.classList.contains('visible')) hideDino(dino);
      } else {
        // Not enough dinos yet; reschedule
        scheduleAutoHide(dino);
      }
    }, DINO_LIFETIME_MS);
    autoHideTimers.set(dino, t);
  }

  function hideDino(dino) {
    const t = autoHideTimers.get(dino);
    if (t) { clearTimeout(t); autoHideTimers.delete(dino); }
    if (dino.classList.contains('visible')) {
      dino.classList.remove('visible');
      dino.src = '';
      dino.setAttribute('aria-label', 'Dinosaur');
    }
    const idx = visibleQueue.findIndex(x => x.el === dino);
    if (idx !== -1) visibleQueue.splice(idx, 1);
  }

  function onDinoTap(e) {
    const dino = e.currentTarget;
    // ensure it's a visible dino
    if (!dino.classList.contains('visible')) return;
    if (e.type === 'touchstart') e.preventDefault();
    // avoid double fire from touchstart->click
    const now = Date.now();
    const last = Number(dino.dataset.lastTapTs || 0);
    if (now - last < 250) return;
    dino.dataset.lastTapTs = String(now);
    // celebrate at tap point
    const pt = getTapPoint(e, dino);
    celebrateAt(pt.x, pt.y, dino);
    
    grantStar();
    hideDino(dino);
  }

  function stopGame(){
    running = false;
    if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer = null; }
    if (watchdog) { clearInterval(watchdog); watchdog = null; }
    // Hide static dinos and remove handlers
    const staticDinos = playArea.querySelectorAll('.dino-static');
    staticDinos.forEach(dino => {
      hideDino(dino);
      // Remove all event listeners by cloning
      const newDino = dino.cloneNode(true);
      dino.parentNode.replaceChild(newDino, dino);
    });
    autoHideTimers.forEach(id => clearTimeout(id));
    autoHideTimers.clear();
    visibleQueue.length = 0;
    // Refresh list to reflect cloned nodes
    dinoElements = Array.from(document.querySelectorAll('.dino-static'));
    // remove any spawned dinos
    [...playArea.querySelectorAll('.dino-spawn')].forEach(n => n.remove());
    activeDinos = 0;
    if (centerDino && centerDino.isConnected) centerDino.remove();
    centerDino = null;
  }

  // Tap handlers
  btnPlay.addEventListener('click', () => {
    showScreen('play');
    startGame();
  });
  btnHome.addEventListener('click', () => { stopGame(); showScreen('home'); });

  // Size control handlers
  btnSizeUp.addEventListener('click', increaseDinoSize);
  btnSizeDown.addEventListener('click', decreaseDinoSize);

  // Effect selector handler
  if (effectSelector) {
    effectSelector.addEventListener('change', (e) => {
      currentEffect = e.target.value;
      console.log('Effect changed to:', currentEffect);
    });
  } else {
    console.error('Effect selector element not found');
  }

  // Mode selector handler
  if (modeSelector) {
    modeSelector.addEventListener('change', (e) => {
      gameMode = e.target.value;
      console.log('Game mode changed to:', gameMode);
    });
  } else {
    console.error('Mode selector element not found');
  }

  // Prevent iOS rubber-band within play area
  playArea.addEventListener('touchmove', (e)=>{ e.preventDefault(); }, {passive:false});

  // Initialize size display
  updateDinoSizes();

  // Debug effect selector
  console.log('Effect selector element:', effectSelector);
  console.log('Initial effect:', currentEffect);
  
  // Ensure selector shows current effect
  if (effectSelector) {
    effectSelector.value = currentEffect;
  }

  // Start at home
  showScreen('home');
})();
