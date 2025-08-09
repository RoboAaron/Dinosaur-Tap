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

  // Elements
  const homeScreen = document.getElementById('screen-home');
  const playScreen = document.getElementById('screen-play');
  const playButton = document.getElementById('btn-play');
  const btnPlay = document.getElementById('btn-play');
  const btnHome = document.getElementById('btn-home');
  const starCounter = document.getElementById('stars');
  const playArea = document.getElementById('play-area');
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
    `assets/dino-assets/make-a-triceratops-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-stegosaurus-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-stegosaurus-for-a-toddler-game (1).svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-diplodocus-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-pterodactyl-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-spinosaurus-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-velociraptor-for-a-toddler-game.svg?cb=${CACHE_BUST}`,
    `assets/dino-assets/make-a-velociraptor-for-a-toddler-game (1).svg?cb=${CACHE_BUST}`
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

  function celebrateConfettiAt(x, y){
    if (typeof confetti !== 'function') return;
    const nx = Math.min(Math.max(x / window.innerWidth, 0), 1);
    const ny = Math.min(Math.max(y / window.innerHeight, 0), 1);
    confetti({ particleCount: 36, spread: 55, startVelocity: 45, origin: { x: nx, y: ny }, scalar: 0.9 });
    setTimeout(() => confetti({ particleCount: 20, spread: 75, origin: { x: nx, y: ny }, decay: 0.92, scalar: 0.8 }), 60);
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
    if (visibleDinos.length >= MAX_CONCURRENT_DINOS) {
      // FIFO: remove the oldest visible dino to make room
      const oldest = visibleQueue.shift();
      if (oldest && oldest.el) hideDino(oldest.el);
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
    celebrateConfettiAt(pt.x, pt.y);
    
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

  // Prevent iOS rubber-band within play area
  playArea.addEventListener('touchmove', (e)=>{ e.preventDefault(); }, {passive:false});

  // Start at home
  showScreen('home');
})();
