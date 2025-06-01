class MidiKeyboardGame {
    constructor() {
        // Game State
        this.score = 0;
        this.combo = 1;
        this.maxCombo = 0;
        this.lives = 3;
        this.currentLevel = 1;
        this.isGameRunning = false;
        this.isPaused = false;
        this.currentMode = 'game'; // 'game' or 'free'

        // MIDI & Audio
        this.midiAccess = null;
        this.midiInput = null;
        this.audioContext = null;
        this.masterVolume = null;
        this.activeOscillators = new Map();

        // Game Mechanics
        this.fallingNotes = [];
        this.baseGameSpeed = 1.0; 
        this.noteSpawnRate = 120; 
        this.framesSinceLastNote = 0;
        this.barHeight = 50;
        this.barWidth = 45; 

        // Dynamic Speed Properties
        this.dynamicSpeedFactor = 1.0; 
        this.maxDynamicSpeedFactor = 1.8; 
        this.minDynamicSpeedFactor = 0.8; 
        this.consecutivePerfectGreatHits = 0;
        this.hitsForSpeedBoost = 4; 
        this.comboMilestoneForSpeedBoost = 5; 

        // Hit Timing
        this.hitTolerances = {
            perfect: 8,
            great: 16,
            good: 24
        };
        this.hitScores = {
            perfect: 100,
            great: 75,
            good: 50
        };

        // Animation Loop
        this.gameLoopId = null;
        this.lastFrameTime = 0;

        // Note & Scale Configuration
        this.practiceNotes = [ 
            'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
            'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
            'C5'
        ];
        this.noteToMidi = {
            'C3': 48, 'C#3': 49, 'D3': 50, 'D#3': 51, 'E3': 52, 'F3': 53, 'F#3': 54,
            'G3': 55, 'G#3': 56, 'A3': 57, 'A#3': 58, 'B3': 59,
            'C4': 60, 'C#4': 61, 'D4': 62, 'D#4': 63, 'E4': 64, 'F4': 65, 'F#4': 66,
            'G4': 67, 'G#4': 68, 'A4': 69, 'A#4': 70, 'B4': 71,
            'C5': 72
        };
        // Removed this.computerKeyToMidi

        this.availableScales = {
            'all_notes': this.practiceNotes,
            'c_major_pentascale': ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
            'g_major_pentascale': ['G3', 'A3', 'B3', 'D4', 'E4', 'G4'],
            'c_major_scale_c4_c5': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
            'chromatic_c4_c5': this.practiceNotes.slice(this.practiceNotes.indexOf('C4'))
        };
        this.currentScaleKey = 'all_notes'; 

        // Level Configuration
        this.levels = {
            1: { speedMultiplier: 0.8, spawnRate: 150, notes: this.availableScales.c_major_pentascale.slice(0,3), scoreToAdvance: 750 },
            2: { speedMultiplier: 0.9, spawnRate: 130, notes: this.availableScales.c_major_pentascale, scoreToAdvance: 2000 },
            3: { speedMultiplier: 1.0, spawnRate: 110, notes: this.availableScales.c_major_scale_c4_c5, scoreToAdvance: 4000 },
            4: { speedMultiplier: 1.1, spawnRate: 90,  notes: this.availableScales.chromatic_c4_c5.slice(0,7), scoreToAdvance: 7000 },
            5: { speedMultiplier: 1.2, spawnRate: 75,  notes: this.availableScales.all_notes, scoreToAdvance: 10000 },
        };
        
        this.initializeElements();
        this.bindEvents();
        this.initializeAudio();
        this.populateScaleSelector();
        this.applyModeSettings(); 
        this.updateLevelUI();
    }
    
    initializeElements() {
        this.scoreElement = document.getElementById('score');
        this.comboElement = document.getElementById('combo');
        this.livesElement = document.getElementById('lives-display');
        this.levelElement = document.getElementById('level');
        this.statusElement = document.getElementById('status');
        this.gameArea = document.getElementById('gameArea');
        this.fallingNotesContainer = document.getElementById('fallingNotes');
        this.keyboard = document.getElementById('keyboard');
        this.hitFeedbackElement = document.getElementById('hitFeedback');
        
        this.gameAreaRect = this.gameArea.getBoundingClientRect();
        this.hitLineY = this.gameAreaRect.height - 50; 

        this.scoreSection = document.querySelector('.score-section');
        this.livesSection = document.querySelector('.lives-section');
        this.levelDisplay = document.querySelector('.level'); 

        this.connectMidiBtn = document.getElementById('connectMidi');
        this.startGameBtn = document.getElementById('startGame');
        this.pauseGameBtn = document.getElementById('pauseGame');
        this.resetGameBtn = document.getElementById('resetGame');
        
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');

        this.freePlayBtn = document.getElementById('freePlayBtn');
        this.gameModeBtn = document.getElementById('gameModeBtn');
        this.scaleSelector = document.getElementById('scaleSelector');
    }

    populateScaleSelector() {
        if (!this.scaleSelector) return;
        this.scaleSelector.innerHTML = '';
        for (const scaleKey in this.availableScales) {
            const option = document.createElement('option');
            option.value = scaleKey;
            let friendlyName = scaleKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            option.textContent = friendlyName;
            this.scaleSelector.appendChild(option);
        }
        this.scaleSelector.value = this.currentScaleKey;
        this.highlightScaleKeys(); 
    }
    
    bindEvents() {
        this.connectMidiBtn.addEventListener('click', () => this.connectMidi());
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.pauseGameBtn.addEventListener('click', () => this.togglePause());
        this.resetGameBtn.addEventListener('click', () => this.resetGame());
        
        this.volumeSlider.addEventListener('input', (e) => this.updateVolume(e.target.value));

        this.freePlayBtn.addEventListener('click', () => this.setMode('free'));
        this.gameModeBtn.addEventListener('click', () => this.setMode('game'));

        if (this.scaleSelector) {
            this.scaleSelector.addEventListener('change', (event) => this.setScale(event.target.value));
        }
        // Removed document.addEventListener for keydown (computer keyboard)
    }

    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterVolume = this.audioContext.createGain();
            this.masterVolume.gain.value = parseFloat(this.volumeSlider.value) / 100;
            this.masterVolume.connect(this.audioContext.destination);
        } catch (error) {
            console.error('Failed to initialize audio:', error);
            this.statusElement.textContent = 'Audio system error. Sound may not work.';
        }
    }

    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    playNote(midiNote, duration = 0.7) { 
        if (!this.audioContext) return;
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
        
        const frequency = this.midiToFrequency(midiNote);
        const noteKey = midiNote.toString();
        this.stopNote(midiNote); 
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'triangle'; 
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.02); 
        gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.15); 
        gainNode.gain.setValueAtTime(0.2, now + duration - 0.1); 
        gainNode.gain.linearRampToValueAtTime(0, now + duration); 
        
        oscillator.connect(gainNode);
        gainNode.connect(this.masterVolume);
        
        this.activeOscillators.set(noteKey, { oscillator, gainNode });
        oscillator.start(now);
        oscillator.stop(now + duration + 0.1); 
        
        oscillator.onended = () => {
            gainNode.disconnect(); 
            this.activeOscillators.delete(noteKey);
        };
    }
    
    stopNote(midiNote) {
        const noteKey = midiNote.toString();
        const activeNote = this.activeOscillators.get(noteKey);
        if (activeNote) {
            const now = this.audioContext.currentTime;
            activeNote.gainNode.gain.cancelScheduledValues(now);
            activeNote.gainNode.gain.setValueAtTime(activeNote.gainNode.gain.value, now); 
            activeNote.gainNode.gain.linearRampToValueAtTime(0.001, now + 0.05); 
        }
    }

    setMode(mode) {
        if (this.currentMode === mode) return;
        this.currentMode = mode;
        this.resetGame(); 
        this.applyModeSettings();
    }

    applyModeSettings() {
        if (this.currentMode === 'free') {
            this.freePlayBtn.classList.add('active-mode');
            this.gameModeBtn.classList.remove('active-mode');
            if (this.scoreSection) this.scoreSection.style.visibility = 'hidden';
            if (this.livesSection) this.livesSection.style.visibility = 'hidden';
            if (this.levelDisplay) this.levelDisplay.style.visibility = 'hidden';
            this.statusElement.textContent = 'Free Play Mode: Practice any scale!';
            this.dynamicSpeedFactor = 1.0;
        } else { // game mode
            this.gameModeBtn.classList.add('active-mode');
            this.freePlayBtn.classList.remove('active-mode');
            if (this.scoreSection) this.scoreSection.style.visibility = 'visible';
            if (this.livesSection) this.livesSection.style.visibility = 'visible';
            if (this.levelDisplay) this.levelDisplay.style.visibility = 'visible';
            this.statusElement.textContent = this.midiInput ? `Level ${this.currentLevel}. Ready!` : 'Connect MIDI to play!';
            this.applyLevelSettings(); 
        }
        this.updateUI(); 
    }

    setScale(scaleKey) {
        if (this.availableScales.hasOwnProperty(scaleKey)) {
            this.currentScaleKey = scaleKey;
            if (this.scaleSelector) this.scaleSelector.value = scaleKey;
            this.highlightScaleKeys();
            if (this.isGameRunning && this.currentMode === 'game') {
                console.log("Scale changed during game. Notes will now be from new scale (may affect level theme).");
            } else if (!this.isGameRunning) {
                 this.resetGame(); 
            }
        }
    }

    highlightScaleKeys() {
        document.querySelectorAll('.key.scale-active').forEach(k => k.classList.remove('scale-active'));
        const notesInScale = this.availableScales[this.currentScaleKey];
        if (notesInScale) {
            notesInScale.forEach(noteName => {
                const keyEl = document.querySelector(`.key[data-note="${noteName}"]`);
                if (keyEl) keyEl.classList.add('scale-active');
            });
        }
    }

    updateVolume(value) {
        if (this.masterVolume) {
            this.masterVolume.gain.value = value / 100;
        }
        this.volumeValue.textContent = `${value}%`;
    }
    
    async connectMidi() {
        try {
            this.statusElement.textContent = 'Requesting MIDI access...';
            if (!navigator.requestMIDIAccess) throw new Error('Web MIDI API not supported');
            
            this.midiAccess = await navigator.requestMIDIAccess();
            this.statusElement.textContent = 'MIDI access granted. Looking for devices...';
            
            const inputs = this.midiAccess.inputs;
            if (inputs.size === 0) {
                this.statusElement.textContent = 'No MIDI input devices found.';
                this.startGameBtn.disabled = false; 
                return;
            }

            let deviceFound = false;
            inputs.forEach(input => {
                if (!deviceFound) { 
                    this.midiInput = input;
                    this.midiInput.onmidimessage = (message) => this.handleMidiMessage(message);
                    this.statusElement.textContent = `Connected to: ${this.midiInput.name}. Ready!`;
                    this.connectMidiBtn.disabled = true;
                    this.startGameBtn.disabled = false;
                    deviceFound = true;
                }
            });
            if (!deviceFound) { 
                 this.statusElement.textContent = 'Could not connect to a MIDI device.';
                 this.startGameBtn.disabled = false;
            }
            
        } catch (error) {
            console.error('MIDI connection failed:', error);
            this.statusElement.textContent = `MIDI Error: ${error.message}.`;
            this.startGameBtn.disabled = false; 
        }
    }
    
    handleMidiMessage(message) {
        const [command, note, velocity] = message.data;
        if (command === 144 && velocity > 0) { 
            this.handleNotePress(note, 'midi');
        } else if (command === 128 || (command === 144 && velocity === 0)) { 
            this.handleNoteRelease(note, 'midi');
        }
    }

    // Removed handleComputerKeyPress method
    
    handleNotePress(midiNote, sourceType) { // sourceType can still be 'midi'
        const noteName = Object.keys(this.noteToMidi).find(key => this.noteToMidi[key] === midiNote);
        if (!noteName) return;
        
        this.playNote(midiNote);
        this.visualizeKeyPress(noteName, true);
        
        if (this.isGameRunning && !this.isPaused) {
            this.checkNoteHit(noteName);
        }
    }

    handleNoteRelease(midiNote, sourceType) { // sourceType can still be 'midi'
        this.stopNote(midiNote);
        const noteName = Object.keys(this.noteToMidi).find(key => this.noteToMidi[key] === midiNote);
        if (noteName) {
            this.visualizeKeyPress(noteName, false);
        }
    }
    
    visualizeKeyPress(noteName, isActive) {
        const keyElement = document.querySelector(`[data-note="${noteName}"]`);
        if (keyElement) {
            if (isActive) {
                keyElement.classList.add('active');
            } else {
                keyElement.classList.remove('active');
            }
        }
    }
    
    startGame() {
        if (this.isGameRunning && !this.isPaused) return; 
        if (this.isGameRunning && this.isPaused) { 
            this.togglePause();
            return;
        }

        this.isGameRunning = true;
        this.isPaused = false;
        this.resetScoreAndLives(); 
        
        if (!this.gameLoopId) { 
            this.currentLevel = 1;
        }
        this.applyLevelSettings(); 

        this.startGameBtn.disabled = true;
        this.pauseGameBtn.disabled = false;
        this.freePlayBtn.disabled = true; 
        this.gameModeBtn.disabled = true;
        this.scaleSelector.disabled = true;

        this.statusElement.textContent = this.currentMode === 'game' ? `Level ${this.currentLevel} - Go!` : 'Free Play Started!';
        
        this.lastFrameTime = performance.now();
        if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId); 
        this.gameLoopId = requestAnimationFrame(this.animationFrameLoop.bind(this));
    }
    
    animationFrameLoop(currentTime) {
        if (!this.isGameRunning) {
            if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
            return;
        }

        const deltaTime = (currentTime - this.lastFrameTime); 
        this.lastFrameTime = currentTime;

        if (!this.isPaused) {
            const deltaFactor = deltaTime / (1000 / 60);
            this.gameUpdate(deltaFactor);
        }
        this.gameLoopId = requestAnimationFrame(this.animationFrameLoop.bind(this));
    }

    togglePause() {
        if (!this.isGameRunning) return;
        this.isPaused = !this.isPaused;
        this.pauseGameBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        this.statusElement.textContent = this.isPaused ? 'Game Paused' : (this.currentMode === 'game' ? `Level ${this.currentLevel} - Resumed` : 'Free Play Resumed');
        if (!this.isPaused) { 
            this.lastFrameTime = performance.now(); 
        }
    }
    
    resetGame() { 
        this.isGameRunning = false;
        this.isPaused = false;
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }
        
        this.resetScoreAndLives();
        this.currentLevel = 1; 
        this.applyLevelSettings(); 
        
        this.fallingNotes = [];
        this.fallingNotesContainer.innerHTML = ''; 
        this.activeOscillators.forEach((_, noteKey) => this.stopNote(parseInt(noteKey)));
        
        this.updateUI();
        this.updateLevelUI();
        
        if (this.currentMode === 'game') {
             this.statusElement.textContent = this.midiInput ? `Level ${this.currentLevel}. Ready!` : 'Connect MIDI to play!';
        } else { 
             this.statusElement.textContent = 'Free Play Mode. Practice any scale!';
        }

        this.startGameBtn.disabled = false; 
        this.pauseGameBtn.disabled = true;
        this.pauseGameBtn.textContent = 'Pause';
        this.freePlayBtn.disabled = false;
        this.gameModeBtn.disabled = false;
        this.scaleSelector.disabled = false;

        this.hideHitFeedback();
        this.highlightScaleKeys(); 
    }

    resetScoreAndLives() {
        this.score = 0;
        this.combo = 1;
        this.maxCombo = 0;
        this.lives = 3;
        this.consecutivePerfectGreatHits = 0; 
    }
    
    gameUpdate(deltaFactor) { 
        if (!this.isGameRunning || this.isPaused) return;
        
        this.framesSinceLastNote += deltaFactor;
        
        let currentSpawnRate;
        if (this.currentMode === 'game') {
            currentSpawnRate = this.levels[this.currentLevel].spawnRate / this.dynamicSpeedFactor; 
            currentSpawnRate = Math.max(30, currentSpawnRate); 
        } else {
            currentSpawnRate = this.noteSpawnRate; 
        }

        if (this.framesSinceLastNote >= currentSpawnRate) {
            this.spawnNote();
            this.framesSinceLastNote = 0;
        }
        
        this.updateFallingNotes(deltaFactor);
        if (this.currentMode === 'game') {
            this.checkMissedNotes(); 
        }
        this.updateUI();
    }
    
    spawnNote() {
        let notesPool;
        if (this.currentMode === 'game') {
            notesPool = this.levels[this.currentLevel].notes;
        } else { 
            notesPool = this.availableScales[this.currentScaleKey];
        }

        if (!notesPool || notesPool.length === 0) {
            console.warn(`No notes available for current level/scale. Defaulting to C4.`);
            notesPool = ['C4']; 
        }
        
        const randomNoteName = notesPool[Math.floor(Math.random() * notesPool.length)];
        const keyElement = document.querySelector(`[data-note="${randomNoteName}"]`);

        if (!keyElement) {
            console.warn(`Key element not found for note: ${randomNoteName}. Skipping spawn.`);
            return;
        }
        
        const keyRect = keyElement.getBoundingClientRect();
        const gameAreaRect = this.gameArea.getBoundingClientRect(); 
        
        const currentBarWidth = keyElement.classList.contains('white-key') ? 
                                parseFloat(getComputedStyle(keyElement).width) * 0.8 : 
                                parseFloat(getComputedStyle(keyElement).width) * 0.9;  
        
        const noteX = (keyRect.left - gameAreaRect.left) + (keyRect.width / 2) - (currentBarWidth / 2);
        
        const note = {
            id: Date.now() + Math.random(),
            noteName: randomNoteName,
            x: noteX,
            y: -this.barHeight, 
            width: currentBarWidth,
            element: null, 
            hit: false,
            missed: false
        };
        
        this.fallingNotes.push(note);
        this.createNoteElement(note);
    }
    
    createNoteElement(note) {
        const noteElement = document.createElement('div');
        noteElement.className = 'falling-bar';
        noteElement.id = `note-${note.id}`;
        noteElement.textContent = note.noteName;
        noteElement.style.left = `${note.x}px`;
        noteElement.style.top = `${note.y}px`;
        noteElement.style.width = `${note.width}px`;
        noteElement.style.height = `${this.barHeight}px`;
        
        if (this.currentMode === 'free') {
            noteElement.style.backgroundColor = 'rgba(100, 200, 255, 0.7)'; 
        } else {
            noteElement.style.backgroundColor = '#3498db'; 
        }
        
        note.element = noteElement;
        this.fallingNotesContainer.appendChild(noteElement);
    }
    
    updateFallingNotes(deltaFactor) {
        let currentLevelBaseSpeed;
        if (this.currentMode === 'game') {
            currentLevelBaseSpeed = this.levels[this.currentLevel].speedMultiplier * this.baseGameSpeed;
        } else { 
            currentLevelBaseSpeed = this.baseGameSpeed * 0.7; 
        }
        const effectiveSpeed = currentLevelBaseSpeed * this.dynamicSpeedFactor * deltaFactor;

        for (let i = this.fallingNotes.length - 1; i >= 0; i--) {
            const note = this.fallingNotes[i];
            if (!note.hit && !note.missed) {
                note.y += effectiveSpeed; 
                if (note.element) {
                    note.element.style.top = `${note.y}px`;
                }
            }
        }
    }
    
    checkNoteHit(pressedNoteName) {
        let hitOccurred = false;
        let bestHitQuality = null; 

        for (let bar of this.fallingNotes) {
            if (bar.hit || bar.missed || bar.noteName !== pressedNoteName) continue;

            const barBottomY = bar.y + this.barHeight;
            const diff = Math.abs(barBottomY - this.hitLineY);

            let quality = null;
            if (diff <= this.hitTolerances.perfect) quality = 'perfect';
            else if (diff <= this.hitTolerances.great) quality = 'great';
            else if (diff <= this.hitTolerances.good) quality = 'good';

            if (quality) {
                if (this.currentMode === 'game') {
                    this.score += this.hitScores[quality] * this.combo;
                    this.combo++;
                    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
                    this.showHitFeedback(quality);

                    if (quality === 'perfect' || quality === 'great') {
                        this.consecutivePerfectGreatHits++;
                        if (this.consecutivePerfectGreatHits >= this.hitsForSpeedBoost) {
                            this.dynamicSpeedFactor = Math.min(this.maxDynamicSpeedFactor, this.dynamicSpeedFactor + 0.1);
                            this.consecutivePerfectGreatHits = 0; 
                            console.log("Speed increased by streak:", this.dynamicSpeedFactor);
                        }
                    } else { 
                        this.consecutivePerfectGreatHits = 0; 
                    }
                    if (this.combo > 1 && this.combo % this.comboMilestoneForSpeedBoost === 0) {
                         this.dynamicSpeedFactor = Math.min(this.maxDynamicSpeedFactor, this.dynamicSpeedFactor + 0.05);
                         console.log("Speed increased by combo milestone:", this.dynamicSpeedFactor);
                    }
                } else { 
                    this.showHitFeedback(quality, true); 
                }

                bar.hit = true;
                hitOccurred = true;
                bestHitQuality = quality; 

                if (bar.element) {
                    bar.element.classList.add(quality); 
                    bar.element.classList.add('hit-flash');
                    this.createParticleEffect(bar.x + (bar.width / 2), this.hitLineY);
                }
                
                setTimeout(() => this.removeNote(bar.id), 400); 
                break; 
            }
        }

        const keyElement = document.querySelector(`[data-note="${pressedNoteName}"]`);
        if (keyElement) {
            keyElement.classList.remove('feedback-perfect', 'feedback-great', 'feedback-good', 'feedback-wrong', 'active');
            keyElement.classList.add('active'); 

            if (hitOccurred && bestHitQuality) {
                keyElement.classList.add(`feedback-${bestHitQuality}`);
            } else if (this.currentMode === 'game' && this.isGameRunning && !this.isPaused) {
                keyElement.classList.add('feedback-wrong');
                this.combo = 1; 
                this.consecutivePerfectGreatHits = 0; 
                this.dynamicSpeedFactor = Math.max(this.minDynamicSpeedFactor, this.dynamicSpeedFactor - 0.15); 
                if (this.dynamicSpeedFactor < 1.0 && this.levels[this.currentLevel].speedMultiplier >=1.0) { 
                    this.dynamicSpeedFactor = 1.0; 
                } else if (this.dynamicSpeedFactor < this.levels[this.currentLevel].speedMultiplier) { 
                     this.dynamicSpeedFactor = this.levels[this.currentLevel].speedMultiplier;
                }
                console.log("Speed decreased by miss/wrong press:", this.dynamicSpeedFactor);
                this.showHitFeedback('miss');
            }
            setTimeout(() => {
                keyElement.classList.remove('active', `feedback-${bestHitQuality}`, 'feedback-wrong');
            }, 400);
        }
        
        if (this.currentMode === 'game') {
            this.updateUI();
            this.advanceLevel();
        }
    }

    showHitFeedback(quality, isFreePlay = false) {
        if (!this.hitFeedbackElement) return;
        
        let text = '';
        switch(quality) {
            case 'perfect': text = 'Perfect!'; break;
            case 'great': text = 'Great!'; break;
            case 'good': text = 'Good!'; break;
            case 'miss': text = isFreePlay ? '' : 'Miss!'; break; 
        }
        if (!text && !isFreePlay && quality !== 'miss') return; 

        this.hitFeedbackElement.textContent = text;
        this.hitFeedbackElement.className = 'hit-feedback'; 
        this.hitFeedbackElement.classList.add(quality);
        this.hitFeedbackElement.classList.add('show');

        setTimeout(() => {
            this.hideHitFeedback();
        }, 800);
    }
    hideHitFeedback() {
        if (this.hitFeedbackElement) this.hitFeedbackElement.classList.remove('show');
    }
    
    checkMissedNotes() {
        if (this.currentMode !== 'game') return;

        for (let i = this.fallingNotes.length - 1; i >= 0; i--) {
            const bar = this.fallingNotes[i];
            if (bar.hit || bar.missed) continue;

            if (bar.y > this.hitLineY + this.hitTolerances.good) {
                bar.missed = true;
                this.lives--;
                this.combo = 1;
                this.consecutivePerfectGreatHits = 0; 
                this.dynamicSpeedFactor = Math.max(this.minDynamicSpeedFactor, this.dynamicSpeedFactor - 0.15);
                if (this.dynamicSpeedFactor < 1.0 && this.levels[this.currentLevel].speedMultiplier >=1.0) {
                    this.dynamicSpeedFactor = 1.0;
                } else if (this.dynamicSpeedFactor < this.levels[this.currentLevel].speedMultiplier) {
                     this.dynamicSpeedFactor = this.levels[this.currentLevel].speedMultiplier;
                }
                console.log("Speed decreased by missed note:", this.dynamicSpeedFactor);
                this.showHitFeedback('miss');

                if (bar.element) {
                    bar.element.classList.add('miss');
                    setTimeout(() => this.removeNote(bar.id), 700);
                }
                
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver();
                    break; 
                }
            }
        }
    }
    
    createParticleEffect(x, y) {
        const particleCount = 5; 
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${x}px`;
            particle.style.top = `${y - this.gameArea.getBoundingClientRect().top}px`; 
            particle.style.setProperty('--dx', `${(Math.random() - 0.5) * 80}px`); 
            particle.style.setProperty('--dy', `${(Math.random() - 0.5) * 80 - 20}px`); 
            
            this.gameArea.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
    }
    
    removeNote(noteId) {
        const noteIndex = this.fallingNotes.findIndex(note => note.id === noteId);
        if (noteIndex > -1) {
            const noteElement = this.fallingNotes[noteIndex].element;
            if (noteElement) noteElement.remove();
            this.fallingNotes.splice(noteIndex, 1);
        }
    }
    
    updateUI() {
        this.scoreElement.textContent = this.score;
        this.comboElement.textContent = this.combo > 1 ? `x${this.combo}` : ''; 
        if (this.currentMode === 'game') {
             this.livesElement.textContent = '♥'.repeat(Math.max(0,this.lives)) + '♡'.repeat(Math.max(0, 3 - this.lives));
        }
    }

    updateLevelUI() {
        if (this.levelElement && this.currentMode === 'game') {
            this.levelElement.textContent = this.currentLevel;
        }
    }

    applyLevelSettings() {
        if (this.currentMode !== 'game' || !this.levels[this.currentLevel]) {
            this.dynamicSpeedFactor = 1.0; 
            return;
        }
        this.dynamicSpeedFactor = 1.0; 
        this.consecutivePerfectGreatHits = 0;
        this.updateLevelUI();
    }

    advanceLevel() {
        if (this.currentMode !== 'game' || !this.isGameRunning) return;

        const currentLevelConfig = this.levels[this.currentLevel];
        if (!currentLevelConfig) return; 

        if (this.score >= currentLevelConfig.scoreToAdvance) {
            if (this.levels[this.currentLevel + 1]) { 
                this.currentLevel++;
                this.applyLevelSettings(); 
                this.statusElement.textContent = `Level Up! Now Level ${this.currentLevel}!`;
            } else {
                this.statusElement.textContent = `Congratulations! You've beaten all levels! Final Score: ${this.score}, Max Combo: x${this.maxCombo}`;
                this.isGameRunning = false; 
                if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
                this.gameLoopId = null;
                this.startGameBtn.disabled = false;
                this.pauseGameBtn.disabled = true;
                this.freePlayBtn.disabled = false;
                this.gameModeBtn.disabled = false;
                this.scaleSelector.disabled = false;
            }
        }
    }
    
    gameOver() {
        this.isGameRunning = false;
        if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
        this.gameLoopId = null;
        
        this.activeOscillators.forEach((_, noteKey) => this.stopNote(parseInt(noteKey)));
        
        this.statusElement.textContent = `Game Over! Level: ${this.currentLevel}, Score: ${this.score}, Max Combo: x${this.maxCombo}`;
        this.startGameBtn.disabled = false;
        this.pauseGameBtn.disabled = true;
        this.freePlayBtn.disabled = false;
        this.gameModeBtn.disabled = false;
        this.scaleSelector.disabled = false;
        
        setTimeout(() => {
            this.fallingNotes.forEach(note => note.element?.classList.add('miss'));
            setTimeout(() => {
                 this.fallingNotesContainer.innerHTML = '';
                 this.fallingNotes = [];
            }, 1000);
        }, 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new MidiKeyboardGame();
    window.midiGame = game; 
    console.log("MIDI Keyboard Practice Game Initialized. Access with 'window.midiGame'.");
});