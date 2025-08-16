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
  let soundEnabled = true; // Audio toggle
  let debugMode = false; // Debug mode toggle
  let currentBackground = 0; // Current background index

  // Elements
  const homeScreen = document.getElementById('screen-home');
  const playScreen = document.getElementById('screen-play');
  const btnPlayNormal = document.getElementById('btn-play-normal');
  const btnPlayUnlimited = document.getElementById('btn-play-unlimited');
  const btnHome = document.getElementById('btn-home');

  const starCounter = document.getElementById('stars');
  const playArea = document.getElementById('play-area');
  const btnSizeUp = document.getElementById('btn-size-up');
  const btnSizeDown = document.getElementById('btn-size-down');
  const sizeDisplay = document.getElementById('size-display');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const btnDebugToggle = document.getElementById('btn-debug-toggle');
  const effectSelector = document.getElementById('effect-selector');
  const btnBackground = document.getElementById('btn-background');
  let dinoElements = Array.from(document.querySelectorAll('.dino-static'));

  // Debug element finding
  console.log('Elements found:');
  console.log('btnBackground:', btnBackground);
  console.log('playArea:', playArea);
  console.log('All buttons:', document.querySelectorAll('button'));

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

  // Background environments configuration
  const BACKGROUNDS = [
    { name: 'Plain', class: 'bg-plain', icon: '🌱' },
    { name: 'Desert', class: 'bg-desert', icon: '🏜️' },
    { name: 'Mountain', class: 'bg-mountain', icon: '🏔️' },
    { name: 'Forest', class: 'bg-forest', icon: '🌲' },
    { name: 'Green Plain', class: 'bg-green-plain', icon: '🌿' },
    { name: 'Oceanside', class: 'bg-oceanside', icon: '🌊' },
    { name: 'Snow', class: 'bg-snow', icon: '❄️' },
    { name: 'Sunset', class: 'bg-sunset', icon: '🌅' },
    { name: 'Volcano', class: 'bg-volcano', icon: '🌋' }
  ];

  // Track ordering and per-dino timers
  const visibleQueue = [];
  const autoHideTimers = new Map();

  // Audio System
  let audioContext = null;
  let audioInitialized = false;
  
  function initializeAudio() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context created:', audioContext.state);
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('Audio context resumed:', audioContext.state);
        });
      }
      audioInitialized = true;
      console.log('Audio initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }
  
  const sounds = {
    // Dinosaur roars - mapped to asset filenames
    'make-a-t-rex-for-a-toddler-game.svg': createDinosaurRoar(80, 0.3, 'aggressive'), // Deep, powerful
    'make-a-t-rex-for-a-toddler-game (1).svg': createDinosaurRoar(85, 0.3, 'aggressive'),
    'make-a-triceratops-for-a-toddler-game.svg': createDinosaurRoar(120, 0.25, 'herbivore'), // Higher, gentler
    'make-a-stegosaurus-for-a-toddler-game.svg': createDinosaurRoar(100, 0.2, 'herbivore'),
    'make-a-stegosaurus-for-a-toddler-game (1).svg': createDinosaurRoar(105, 0.2, 'herbivore'),
    'make-a-diplodocus-for-a-toddler-game.svg': createDinosaurRoar(60, 0.4, 'gentle'), // Very deep, long
    'make-a-pterodactyl-for-a-toddler-game.svg': createDinosaurRoar(300, 0.15, 'flying'), // High pitched screech
    'make-a-spinosaurus-for-a-toddler-game.svg': createDinosaurRoar(90, 0.35, 'aquatic'), // Deep with bubbles
    'make-a-velociraptor-for-a-toddler-game.svg': createDinosaurRoar(200, 0.2, 'raptor'), // Sharp, quick
    'make-a-velociraptor-for-a-toddler-game (1).svg': createDinosaurRoar(210, 0.2, 'raptor'),
    'create-a-liopleurodon-for-a-toddler-game.svg': createDinosaurRoar(70, 0.3, 'marine'), // Deep marine sound
    'create-an-ankylosaurus-for-a-toddler-game--make-su.svg': createDinosaurRoar(110, 0.25, 'armored'), // Muffled
    
    // UI sounds
    tap: createTapSound(),
    star: createStarSound(),
    spawn: createSpawnSound(),
    celebration: createCelebrationSound()
  };

  function createDinosaurRoar(baseFreq, duration, type) {
    return () => {
      if (!soundEnabled || !audioInitialized) return;
      if (!audioContext) initializeAudio();
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filterNode = audioContext.createBiquadFilter();
      
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Base roar characteristics
      oscillator.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, audioContext.currentTime + duration);
      
      // Type-specific modifications
      switch(type) {
        case 'aggressive':
          oscillator.type = 'sawtooth';
          filterNode.frequency.setValueAtTime(800, audioContext.currentTime);
          break;
        case 'herbivore':
          oscillator.type = 'triangle';
          filterNode.frequency.setValueAtTime(1200, audioContext.currentTime);
          break;
        case 'gentle':
          oscillator.type = 'sine';
          filterNode.frequency.setValueAtTime(600, audioContext.currentTime);
          break;
        case 'flying':
          oscillator.type = 'square';
          filterNode.frequency.setValueAtTime(2000, audioContext.currentTime);
          break;
        case 'aquatic':
          oscillator.type = 'sawtooth';
          filterNode.frequency.setValueAtTime(400, audioContext.currentTime);
          break;
        case 'raptor':
          oscillator.type = 'square';
          filterNode.frequency.setValueAtTime(1500, audioContext.currentTime);
          break;
        case 'marine':
          oscillator.type = 'sine';
          filterNode.frequency.setValueAtTime(300, audioContext.currentTime);
          break;
        case 'armored':
          oscillator.type = 'triangle';
          filterNode.frequency.setValueAtTime(600, audioContext.currentTime);
          break;
      }
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      
      console.log(`Playing ${type} roar at ${baseFreq}Hz for ${duration}s`);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    };
  }

  function createTapSound() {
    return () => {
      if (!soundEnabled || !audioInitialized) return;
      if (!audioContext) initializeAudio();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
      
      console.log('Playing tap sound');
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    };
  }

  function createStarSound() {
    return () => {
      if (!soundEnabled || !audioInitialized) return;
      if (!audioContext) initializeAudio();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
      oscillator.frequency.linearRampToValueAtTime(659, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.linearRampToValueAtTime(784, audioContext.currentTime + 0.2); // G5
      oscillator.type = 'triangle';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    };
  }

  function createSpawnSound() {
    return () => {
      if (!soundEnabled || !audioInitialized) return;
      if (!audioContext) initializeAudio();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.2);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.03, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    };
  }

  function createCelebrationSound() {
    return () => {
      if (!soundEnabled || !audioInitialized) return;
      if (!audioContext) initializeAudio();
      // Play a quick ascending arpeggio
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.05);
        oscillator.type = 'triangle';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + i * 0.05);
        gainNode.gain.linearRampToValueAtTime(0.04, audioContext.currentTime + i * 0.05 + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + i * 0.05 + 0.15);
        
        oscillator.start(audioContext.currentTime + i * 0.05);
        oscillator.stop(audioContext.currentTime + i * 0.05 + 0.15);
      });
    };
  }

  function playDinosaurSound(dinoSrc) {
    const filename = dinoSrc.split('/').pop().split('?')[0]; // Extract filename without query params
    console.log('Attempting to play sound for:', filename);
    const soundFunc = sounds[filename];
    if (soundFunc) {
      soundFunc();
    } else {
      console.log('No sound function found for:', filename);
    }
  }

  // Simple test sound function
  function playTestBeep() {
    if (!audioInitialized) {
      console.log('Audio not initialized, initializing now...');
      initializeAudio();
    }
    
    if (!audioContext) {
      console.error('Audio context not available');
      return;
    }

    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      console.log('Test beep played');
    } catch (error) {
      console.error('Error playing test beep:', error);
    }
  }

  // Background change sound function
  function playBackgroundChangeSound() {
    if (!audioInitialized || !audioContext) return;
    
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Play a gentle ascending note
      oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5 note
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Error playing background change sound:', error);
    }
  }

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
      
      // Initialize background button when play screen is shown
      if (btnBackground) {
        btnBackground.textContent = BACKGROUNDS[currentBackground].icon;
        btnBackground.setAttribute('aria-label', `Change background to ${BACKGROUNDS[(currentBackground + 1) % BACKGROUNDS.length].name}`);
        console.log('Background button initialized with icon:', BACKGROUNDS[currentBackground].icon);
        console.log('Current background class:', BACKGROUNDS[currentBackground].class);
      }
    }
  }

  function grantStar() {
    stars++;
    starCounter.textContent = stars;
    sounds.star(); // Play star sound
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
      // Create main lightning bolt container
      const lightning = document.createElement('div');
      lightning.className = 'celebration-lightning';
      lightning.style.left = x + 'px';
      lightning.style.top = y + 'px';
      
      // Create multiple lightning segments for realistic branching
      const segments = [
        { x1: 0, y1: -100, x2: -5, y2: -60, width: 3 },
        { x1: -5, y1: -60, x2: 8, y2: -20, width: 4 },
        { x1: 8, y1: -20, x2: -3, y2: 20, width: 3 },
        { x1: -3, y1: 20, x2: 12, y2: 60, width: 2 },
        // Branch 1
        { x1: 8, y1: -20, x2: 25, y2: 10, width: 2 },
        { x1: 25, y1: 10, x2: 35, y2: 40, width: 1 },
        // Branch 2
        { x1: -5, y1: -60, x2: -20, y2: -30, width: 2 },
        { x1: -20, y1: -30, x2: -25, y2: -10, width: 1 }
      ];
      
      segments.forEach((seg, i) => {
        const bolt = document.createElement('div');
        bolt.className = 'lightning-segment';
        
        const length = Math.sqrt(Math.pow(seg.x2 - seg.x1, 2) + Math.pow(seg.y2 - seg.y1, 2));
        const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1) * 180 / Math.PI;
        
        bolt.style.position = 'absolute';
        bolt.style.left = seg.x1 + 'px';
        bolt.style.top = seg.y1 + 'px';
        bolt.style.width = length + 'px';
        bolt.style.height = seg.width + 'px';
        bolt.style.background = 'linear-gradient(90deg, #ffffff, #87ceeb, #ffffff)';
        bolt.style.boxShadow = `0 0 ${seg.width * 2}px #87ceeb, 0 0 ${seg.width * 4}px #4169e1`;
        bolt.style.transform = `rotate(${angle}deg)`;
        bolt.style.transformOrigin = '0 50%';
        bolt.style.animation = `lightning-flash 0.3s ease-out ${i * 0.02}s`;
        bolt.style.borderRadius = '1px';
        
        lightning.appendChild(bolt);
      });
      
      // Add screen flash effect
      const flash = document.createElement('div');
      flash.style.position = 'fixed';
      flash.style.top = '0';
      flash.style.left = '0';
      flash.style.width = '100vw';
      flash.style.height = '100vh';
      flash.style.background = 'rgba(255, 255, 255, 0.3)';
      flash.style.pointerEvents = 'none';
      flash.style.animation = 'lightning-screen-flash 0.15s ease-out';
      flash.style.zIndex = '9999';
      
      document.body.appendChild(lightning);
      document.body.appendChild(flash);
      
      setTimeout(() => {
        lightning.remove();
        flash.remove();
      }, 600);
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
      const effects = ['confetti', 'ring', 'sparkles', 'pop', 'fireworks', 'hearts', 'lightning', 'bubbles'];
      const randomEffect = effects[Math.floor(Math.random() * effects.length)];
      celebrationEffects[randomEffect](x, y, dino);
    }
  };

  function celebrateAt(x, y, dino = null) {
    const effect = celebrationEffects[currentEffect];
    if (effect) {
      effect(x, y, dino);
      // Play celebration sound for visual effects (not for pop which is dino-focused)
      if (currentEffect !== 'pop') {
        sounds.celebration();
      }
    }
  }

  // Size control functions
  function updateDinoSizes() {
    dinoElements.forEach(dino => {
      dino.style.transform = `translate(-50%, -50%) scale(${dinoSizeScale})`;
    });
    if (dinoSizeScale === -1) {
      sizeDisplay.textContent = 'Random';
    } else {
      sizeDisplay.textContent = `${dinoSizeScale.toFixed(1)}x`;
    }
  }

  function increaseDinoSize() {
    if (dinoSizeScale === -1) {
      dinoSizeScale = 1.0; // Exit random mode
    } else {
      dinoSizeScale += 0.5;
    }
    updateDinoSizes();
  }

  function decreaseDinoSize() {
    if (dinoSizeScale > 0.5) {
      dinoSizeScale -= 0.5;
      updateDinoSizes();
    } else if (dinoSizeScale === 0.5) {
      // Enter random zoom mode
      dinoSizeScale = -1;
      updateDinoSizes();
      applyRandomSizes();
    }
  }

  function applyRandomSizes() {
    if (dinoSizeScale === -1) {
      dinoElements.forEach(dino => {
        const randomScale = 0.5 + Math.random() * 5.5; // 0.5x to 6x
        dino.style.transform = `translate(-50%, -50%) scale(${randomScale})`;
      });
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
      const y = randBetween(10, 90); 
      dino.style.left = `${x}%`;
      dino.style.top = `${y}%`;
      
      // Apply size based on current mode
      if (dinoSizeScale === -1) {
        // Random mode: each dino gets random size
        const randomScale = 0.5 + Math.random() * 5.5; // 0.5x to 6x
        dino.style.transform = `translate(-50%, -50%) scale(${randomScale})`;
      } else {
        // Normal mode: use current scale
        dino.style.transform = `translate(-50%, -50%) scale(${dinoSizeScale})`;
      }
      
      dino.classList.add('visible');
      visibleQueue.push({ el: dino, shownAt: Date.now() });
      
      // Play spawn sound
      sounds.spawn();
      
      scheduleAutoHide(dino);
      activeDinos++;
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
    
    // Haptic feedback for mobile devices
    if (debugMode) {
      showDebugMessage('Attempting vibration on tap...');
      showDebugMessage(`navigator.vibrate available: ${!!navigator.vibrate}`);
    }
    
    if (navigator.vibrate) {
      try {
        const vibrated = navigator.vibrate(50); // 50ms vibration
        if (debugMode) {
          showDebugMessage(`Vibration result: ${vibrated ? 'SUCCESS' : 'FAILED'}`);
        }
      } catch (error) {
        if (debugMode) {
          showDebugMessage(`Vibration error: ${error.message}`, true);
        }
      }
    } else {
      if (debugMode) {
        showDebugMessage('Vibration not supported', true);
      }
    }
    
    // Alternative vibration patterns for better compatibility
    if (navigator.vibrate) {
      // Try different patterns for better Android compatibility
      setTimeout(() => {
        try {
          navigator.vibrate([50]); // Array format
          if (debugMode) {
            showDebugMessage('Fallback array vibration attempted');
          }
        } catch (e) {
          if (debugMode) {
            showDebugMessage(`Array vibration failed: ${e.message}`, true);
          }
        }
      }, 10);
    }
    
    // Play dinosaur-specific roar
    playDinosaurSound(dino.src);
    
    // Play tap sound
    sounds.tap();
    
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
  btnPlayNormal.addEventListener('click', () => {
    gameMode = 'normal';
    showScreen('play');
    startGame();
  });
  
  btnPlayUnlimited.addEventListener('click', () => {
    gameMode = 'unlimited';
    showScreen('play');
    startGame();
  });
  
  btnHome.addEventListener('click', () => { stopGame(); showScreen('home'); });



  // Initialize audio on first user interaction
  function handleFirstInteraction() {
    initializeAudio();
    document.removeEventListener('click', handleFirstInteraction);
    document.removeEventListener('touchstart', handleFirstInteraction);
  }
  document.addEventListener('click', handleFirstInteraction);
  document.addEventListener('touchstart', handleFirstInteraction);

  // Size control handlers
  btnSizeUp.addEventListener('click', increaseDinoSize);
  btnSizeDown.addEventListener('click', decreaseDinoSize);

  // Sound toggle handler
  btnSoundToggle.addEventListener('click', () => {
    if (!audioInitialized) {
      initializeAudio();
    }
    soundEnabled = !soundEnabled;
    btnSoundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    btnSoundToggle.setAttribute('aria-label', soundEnabled ? 'Mute sound effects' : 'Enable sound effects');
    
    // Play a test sound when enabling
    if (soundEnabled) {
      playTestBeep();
    }
  });

  // Create debug display function
  function showDebugMessage(message, isError = false) {
    if (!debugMode) return; // Only show debug messages when debug mode is on
    
    const debugDiv = document.getElementById('debug-display') || (() => {
      const div = document.createElement('div');
      div.id = 'debug-display';
      div.style.cssText = `
        position: fixed; top: 10px; left: 10px; right: 10px; 
        background: rgba(0,0,0,0.9); color: white; padding: 10px; 
        border-radius: 8px; font-family: monospace; font-size: 12px; 
        z-index: 10000; max-height: 200px; overflow-y: auto;
        border: 2px solid ${isError ? '#ff4444' : '#44ff44'};
      `;
      document.body.appendChild(div);
      return div;
    })();
    
    const timestamp = new Date().toLocaleTimeString();
    debugDiv.innerHTML += `<div style="margin: 2px 0; color: ${isError ? '#ff8888' : '#88ff88'}">[${timestamp}] ${message}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
    
    // Auto-clear after 10 seconds
    setTimeout(() => {
      if (debugDiv.children.length > 20) {
        debugDiv.removeChild(debugDiv.firstChild);
      }
    }, 10000);
  }

  function runVibrationTest() {
    showDebugMessage('=== VIBRATION TEST STARTED ===');
    showDebugMessage(`Browser: ${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'}`);
    showDebugMessage(`Platform: ${navigator.platform}`);
    showDebugMessage(`Vibrate API: ${'vibrate' in navigator ? 'Available' : 'Not Available'}`);
    showDebugMessage(`HTTPS: ${window.isSecureContext ? 'Yes' : 'No'}`);
    showDebugMessage(`URL: ${window.location.protocol}//${window.location.host}`);
    
    if ('vibrate' in navigator) {
      showDebugMessage('Testing vibration patterns...');
      
      // Test 1: Simple vibration
      try {
        const result1 = navigator.vibrate(100);
        showDebugMessage(`Test 1 - Simple vibrate(100): ${result1 ? 'SUCCESS' : 'FAILED'}`);
      } catch (e) {
        showDebugMessage(`Test 1 - Simple vibration ERROR: ${e.message}`, true);
      }
      
      // Test 2: Array pattern
      setTimeout(() => {
        try {
          const result2 = navigator.vibrate([100]);
          showDebugMessage(`Test 2 - Array vibrate([100]): ${result2 ? 'SUCCESS' : 'FAILED'}`);
        } catch (e) {
          showDebugMessage(`Test 2 - Array vibration ERROR: ${e.message}`, true);
        }
      }, 300);
      
      // Test 3: Pattern vibration
      setTimeout(() => {
        try {
          const result3 = navigator.vibrate([50, 50, 50]);
          showDebugMessage(`Test 3 - Pattern vibrate([50,50,50]): ${result3 ? 'SUCCESS' : 'FAILED'}`);
        } catch (e) {
          showDebugMessage(`Test 3 - Pattern vibration ERROR: ${e.message}`, true);
        }
      }, 700);
      
      // Test 4: Long vibration
      setTimeout(() => {
        try {
          const result4 = navigator.vibrate(200);
          showDebugMessage(`Test 4 - Long vibrate(200): ${result4 ? 'SUCCESS' : 'FAILED'}`);
          showDebugMessage('=== VIBRATION TEST COMPLETE ===');
        } catch (e) {
          showDebugMessage(`Test 4 - Long vibration ERROR: ${e.message}`, true);
        }
      }, 1200);
      
    } else {
      showDebugMessage('Vibration API not supported on this device/browser', true);
    }
  }

  // Debug toggle handler
  btnDebugToggle.addEventListener('click', () => {
    debugMode = !debugMode;
    btnDebugToggle.textContent = debugMode ? '🐛' : '🔍';
    btnDebugToggle.setAttribute('aria-label', debugMode ? 'Disable debug mode' : 'Enable debug mode');
    
    if (debugMode) {
      showDebugMessage('=== DEBUG MODE ENABLED ===');
      showDebugMessage('Tap this button again to disable debug mode');
      showDebugMessage('Now tapping dinosaurs will show vibration debug info');
      // Run vibration test when debug mode is enabled
      runVibrationTest();
    } else {
      // Hide debug display when debug mode is disabled
      const debugDiv = document.getElementById('debug-display');
      if (debugDiv) {
        debugDiv.remove();
      }
    }
  });

  // Effect selector handler
  if (effectSelector) {
    effectSelector.addEventListener('change', (e) => {
      currentEffect = e.target.value;
      console.log('Effect changed to:', currentEffect);
    });
  } else {
    console.error('Effect selector element not found');
  }

  // Background change handler
  if (btnBackground) {
    console.log('Background button found, adding click listener');
    btnBackground.addEventListener('click', () => {
      console.log('Background button clicked! Current background:', currentBackground);
      
      // Remove current background class
      const currentClass = BACKGROUNDS[currentBackground].class;
      playArea.classList.remove(currentClass);
      console.log('Removed class:', currentClass);
      
      // Move to next background
      currentBackground = (currentBackground + 1) % BACKGROUNDS.length;
      const newClass = BACKGROUNDS[currentBackground].class;
      
      // Add new background class
      playArea.classList.add(newClass);
      console.log('Added class:', newClass, 'for background:', BACKGROUNDS[currentBackground].name);
      
      // Update button icon and aria-label
      btnBackground.textContent = BACKGROUNDS[currentBackground].icon;
      btnBackground.setAttribute('aria-label', `Change background to ${BACKGROUNDS[(currentBackground + 1) % BACKGROUNDS.length].name}`);
      
      console.log('Background changed to:', BACKGROUNDS[currentBackground].name);
      
      // Play a subtle sound effect if sound is enabled
      if (soundEnabled && audioInitialized) {
        playBackgroundChangeSound();
      }
      
      // Add visual feedback
      btnBackground.style.transform = 'scale(0.9)';
      setTimeout(() => {
        btnBackground.style.transform = 'scale(1)';
      }, 100);
    });
  } else {
    console.error('Background button element not found');
  }



  // Prevent iOS rubber-band within play area
  playArea.addEventListener('touchmove', (e)=>{ e.preventDefault(); }, {passive:false});

  // Initialize size display
  updateDinoSizes();

  // Initialize background button - will be done when play screen is shown
  console.log('Background button element found during setup:', btnBackground);
  
  // Ensure play area has initial background class
  if (playArea) {
    playArea.classList.add(BACKGROUNDS[currentBackground].class);
    console.log('Initial background class applied:', BACKGROUNDS[currentBackground].class);
  }

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
