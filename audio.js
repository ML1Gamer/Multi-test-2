// Audio System using Web Audio API
let audioContext = null;
let musicGainNode = null;
let sfxGainNode = null;
let currentMusicSource = null;
let currentMusicType = null;
let musicIntervalIds = []; // track all setInterval IDs for cleanup

// Initialize audio nodes
function initAudio() {
    try {
        // Create AudioContext on first user interaction
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume if suspended (browsers auto-suspend contexts)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        if (!musicGainNode) {
            musicGainNode = audioContext.createGain();
            musicGainNode.gain.value = 0.3; // Music volume
            musicGainNode.connect(audioContext.destination);
        }
        
        if (!sfxGainNode) {
            sfxGainNode = audioContext.createGain();
            sfxGainNode.gain.value = 0.4; // SFX volume
            sfxGainNode.connect(audioContext.destination);
        }
    } catch (e) {
        console.warn('Audio initialization failed:', e);
    }
}

// Sound effect generator functions
function playShootSound(weapon) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    if (weapon.isMelee) {
        // Melee whoosh sound
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    } else if (weapon.name === 'Pistol') {
        // Sharp pistol shot
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    } else if (weapon.name === 'Shotgun' || weapon.name === 'CombatShotgun') {
        // Deep shotgun blast
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    } else if (weapon.name === 'Sniper' || weapon.name === 'DMR' || weapon.name === '.50 Cal BMG') {
        // Powerful rifle shot
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(180, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    } else if (weapon.name === 'SMG') {
        // Rapid fire sound
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.03);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.03);
    } else {
        // Generic gun sound
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(160, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(60, audioContext.currentTime + 0.08);
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
    }
    
    oscillator.connect(gainNode);
    gainNode.connect(sfxGainNode);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

function playExplosionSound() {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.3);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(sfxGainNode);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

function playHitSound() {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    
    oscillator.connect(gainNode);
    gainNode.connect(sfxGainNode);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.05);
}

function playEnemyDeathSound(isBoss = false) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    if (isBoss) {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    } else {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(250, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    }
    
    oscillator.connect(gainNode);
    gainNode.connect(sfxGainNode);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
}

function playPickupSound(type) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    if (type === 'money' || type === 'key') {
        // Coin/treasure sound
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    } else if (type === 'health') {
        // Healing sound
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    } else if (type === 'weapon' || type === 'gear') {
        // Powerup sound
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(900, audioContext.currentTime + 0.05);
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    } else {
        // Generic pickup
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(700, audioContext.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    }
    
    oscillator.connect(gainNode);
    gainNode.connect(sfxGainNode);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

function playDoorSound() {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(100, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.connect(gainNode);
    gainNode.connect(sfxGainNode);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

function playPlayerHurtSound() {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(sfxGainNode);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playEnemySpawnSound() {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.connect(gainNode);
    gainNode.connect(sfxGainNode);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

function playNoAmmoSound() {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    
    oscillator.connect(gainNode);
    gainNode.connect(sfxGainNode);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.05);
}

// Music generation using oscillators
function createMusicLoop(type) {
    if (!audioContext) return;
    
    if (currentMusicSource) {
        stopMusic();
    }
    
    currentMusicType = type;
    
    // Create different music patterns based on room type
    if (type === ROOM_TYPES.BOSS || type === 'boss_spawn') {
        playBossMusic();
    } else if (type === ROOM_TYPES.SHOP) {
        playShopMusic();
    } else if (type === ROOM_TYPES.START) {
        playSafeMusic();
    } else {
        playNormalMusic();
    }
}

function playNormalMusic() {
    if (!audioContext) return;
    
    const tempo = 120; // BPM
    const beatDuration = 60 / tempo;
    
    const bass = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    
    bass.type = 'sine';
    bass.frequency.value = 110; // A2
    bassGain.gain.value = 0.15;
    
    bass.connect(bassGain);
    bassGain.connect(musicGainNode);
    bass.start();
    
    currentMusicSource = bass;
    
    // Add some variation
    musicIntervalIds.push(setInterval(() => {
        if (currentMusicType === ROOM_TYPES.NORMAL && currentMusicSource === bass) {
            const notes = [110, 130, 98, 123]; // A2, C3, G2, B2
            bass.frequency.setValueAtTime(notes[Math.floor(Math.random() * notes.length)], audioContext.currentTime);
        }
    }, beatDuration * 4 * 1000));
}

function playBossMusic() {
    if (!audioContext) return;
    
    const tempo = 140; // Faster tempo
    const beatDuration = 60 / tempo;
    
    const bass = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    const lead = audioContext.createOscillator();
    const leadGain = audioContext.createGain();
    
    bass.type = 'sawtooth';
    bass.frequency.value = 82.41; // E2
    bassGain.gain.value = 0.2;
    
    lead.type = 'square';
    lead.frequency.value = 329.63; // E4
    leadGain.gain.value = 0.1;
    
    bass.connect(bassGain);
    bassGain.connect(musicGainNode);
    lead.connect(leadGain);
    leadGain.connect(musicGainNode);
    
    bass.start();
    lead.start();
    
    currentMusicSource = { bass, lead };
    
    // Intense rhythm
    let beat = 0;
    musicIntervalIds.push(setInterval(() => {
        if (currentMusicType === ROOM_TYPES.BOSS || currentMusicType === 'boss_spawn') {
            const bassNotes = [82.41, 98, 73.42, 92.5]; // E2, G2, D2, F#2
            const leadNotes = [329.63, 392, 493.88, 440]; // E4, G4, B4, A4
            
            bass.frequency.setValueAtTime(bassNotes[beat % bassNotes.length], audioContext.currentTime);
            lead.frequency.setValueAtTime(leadNotes[(beat * 2) % leadNotes.length], audioContext.currentTime);
            beat++;
        }
    }, beatDuration * 1000));
}

function playShopMusic() {
    if (!audioContext) return;
    
    const melody = audioContext.createOscillator();
    const melodyGain = audioContext.createGain();
    
    melody.type = 'sine';
    melody.frequency.value = 523.25; // C5
    melodyGain.gain.value = 0.12;
    
    melody.connect(melodyGain);
    melodyGain.connect(musicGainNode);
    melody.start();
    
    currentMusicSource = melody;
    
    // Pleasant melody
    const notes = [523.25, 587.33, 659.25, 698.46, 783.99]; // C5, D5, E5, F5, G5
    let noteIndex = 0;
    
    musicIntervalIds.push(setInterval(() => {
        if (currentMusicType === ROOM_TYPES.SHOP && currentMusicSource === melody) {
            melody.frequency.setValueAtTime(notes[noteIndex % notes.length], audioContext.currentTime);
            noteIndex++;
        }
    }, 500));
}

function playSafeMusic() {
    if (!audioContext) return;
    
    const pad = audioContext.createOscillator();
    const padGain = audioContext.createGain();
    
    pad.type = 'sine';
    pad.frequency.value = 220; // A3
    padGain.gain.value = 0.1;
    
    pad.connect(padGain);
    padGain.connect(musicGainNode);
    pad.start();
    
    currentMusicSource = pad;
    
    // Calm, slow changes
    musicIntervalIds.push(setInterval(() => {
        if (currentMusicType === ROOM_TYPES.START && currentMusicSource === pad) {
            const notes = [220, 246.94, 261.63]; // A3, B3, C4
            pad.frequency.setValueAtTime(notes[Math.floor(Math.random() * notes.length)], audioContext.currentTime);
        }
    }, 2000));
}

function stopMusic() {
    // Clear all music intervals first
    musicIntervalIds.forEach(id => clearInterval(id));
    musicIntervalIds = [];

    if (currentMusicSource) {
        try {
            if (currentMusicSource.bass) {
                currentMusicSource.bass.stop();
                currentMusicSource.lead.stop();
            } else {
                currentMusicSource.stop();
            }
        } catch (e) {
            // Already stopped
        }
        currentMusicSource = null;
    }
}

function setMusicVolume(volume) {
    if (musicGainNode) {
        musicGainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
}

function setSFXVolume(volume) {
    if (sfxGainNode) {
        sfxGainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
}