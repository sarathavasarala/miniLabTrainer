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
        this.gameSpeed = 1; // Base speed, modified by level
        this.noteSpawnRate = 120; // Base rate, modified by level
        this.framesSinceLastNote = 0;
        this.barHeight = 50;
        this.barWidth = 45; // Default width of falling bars

        // Hit Timing (pixels from hitLineY for bottom of the bar)
        this.hitTolerances = {
            perfect: 8,  // Smaller window for perfect
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
        this.practiceNotes = [ // C3 to C5 range
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
        this.computerKeyToMidi = { // C4 Octave + C5
            'A': 60, 'W': 61, 'S': 62, 'E': 63, 'D': 64, 'F': 65, 'T': 66, 
            'G': 67, 'Y': 68, 'H': 69, 'U': 70, 'J': 71, 'K': 72 // K for C5
        };

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
            1: { speed: 0.8, spawnRate: 150, notes: this.availableScales.c_major_pentascale.slice(0,3) }, // C4, D4, E4
            2: { speed: 1.0, spawnRate: 130, notes: this.availableScales.c_major_pentascale },
            3: { speed: 1.2, spawnRate: 110, notes: this.availableScales.c_major_scale_c4_c5 },
            4: { speed: 1.4, spawnRate: 90,  notes: this.availableScales.chromatic_c4_c5.slice(0,7) }, // C4 to G4 chromatic
            5: { speed: 1.6, spawnRate: 75,  notes: this.availableScales.all_notes },
            // Add more levels
        };
        
        this.initializeElements();
        this.bindEvents();
        this.initializeAudio();
        this.populateScaleSelector();
        this.applyModeSettings(); // Initial UI setup
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
        this.hitLineY = this.gameAreaRect.height - 50; // 50px from bottom (center of visual hit-line)

        this.scoreSection = document.querySelector('.score-section');
        this.livesSection = document.querySelector('.lives-section');
        this.levelDisplay = document.querySelector('.level'); // Level display in header

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
        this.highlightScaleKeys(); // Initial highlight
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
        document.addEventListener('keydown', (event) => this.handleComputerKeyPress(event));
        // Handle keyup for computer keys if you want to stop sound on release
        // document.addEventListener('keyup', (event) => this.handleComputerKeyRelease(event));
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

    playNote(midiNote, duration = 0.7) { // Slightly longer default duration
        if (!this.audioContext) return;
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
        
        const frequency = this.midiToFrequency(midiNote);
        const noteKey = midiNote.toString();
        this.stopNote(midiNote); // Stop if already playing
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'triangle'; // Triangle wave is a bit softer than sine for simple synth
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.02); // Faster attack
        gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.15); // Decay
        gainNode.gain.setValueAtTime(0.2, now + duration - 0.1); // Sustain
        gainNode.gain.linearRampToValueAtTime(0, now + duration); // Release
        
        oscillator.connect(gainNode);
        gainNode.connect(this.masterVolume);
        
        this.activeOscillators.set(noteKey, { oscillator, gainNode });
        oscillator.start(now);
        oscillator.stop(now + duration + 0.1); // Add a little tail for the ramp down
        
        oscillator.onended = () => {
            gainNode.disconnect(); // Clean up connections
            this.activeOscillators.delete(noteKey);
        };
    }
    
    stopNote(midiNote) {
        const noteKey = midiNote.toString();
        const activeNote = this.activeOscillators.get(noteKey);
        if (activeNote) {
            const now = this.audioContext.currentTime;
            activeNote.gainNode.gain.cancelScheduledValues(now);
            activeNote.gainNode.gain.setValueAtTime(activeNote.gainNode.gain.value, now); // Hold current value
            activeNote.gainNode.gain.linearRampToValueAtTime(0.001, now + 0.05); // Quick fade out
            
            // Oscillator stop is already scheduled or will be handled by its onended
            // We don't call activeNote.oscillator.stop() here again to avoid errors if already stopped.
        }
    }

    setMode(mode) {
        if (this.currentMode === mode) return;
        this.currentMode = mode;
        this.resetGame(); // Reset game state when changing modes
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
            this.gameSpeed = 1; // Slower speed for free play
            this.noteSpawnRate = 150; // Slower spawn for free play
        } else { // game mode
            this.gameModeBtn.classList.add('active-mode');
            this.freePlayBtn.classList.remove('active-mode');
            if (this.scoreSection) this.scoreSection.style.visibility = 'visible';
            if (this.livesSection) this.livesSection.style.visibility = 'visible';
            if (this.levelDisplay) this.levelDisplay.style.visibility = 'visible';
            this.statusElement.textContent = this.midiInput ? `Level ${this.currentLevel}. Ready!` : 'Connect MIDI or use computer keys!';
            this.applyLevelSettings();
        }
        this.updateUI(); // Update score/lives display based on visibility
    }

    setScale(scaleKey) {
        if (this.availableScales.hasOwnProperty(scaleKey)) {
            this.currentScaleKey = scaleKey;
            if (this.scaleSelector) this.scaleSelector.value = scaleKey;
            this.highlightScaleKeys();
            // In game mode, changing scale might reset level or adapt current level
            if (this.isGameRunning && this.currentMode === 'game') {
                // Optionally restart level or warn user
                console.log("Scale changed during game. Notes will now be from new scale.");
            } else if (!this.isGameRunning) {
                 this.resetGame(); // Or just update notes for next game
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
        // ... (MIDI connection logic largely unchanged, but update status and button states)
        try {
            this.statusElement.textContent = 'Requesting MIDI access...';
            if (!navigator.requestMIDIAccess) throw new Error('Web MIDI API not supported');
            
            this.midiAccess = await navigator.requestMIDIAccess();
            this.statusElement.textContent = 'MIDI access granted. Looking for devices...';
            
            const inputs = this.midiAccess.inputs;
            if (inputs.size === 0) {
                this.statusElement.textContent = 'No MIDI input devices found. You can use computer keys.';
                this.startGameBtn.disabled = false; // Allow starting with computer keys
                return;
            }

            let deviceFound = false;
            inputs.forEach(input => {
                if (!deviceFound) { // Connect to the first one
                    this.midiInput = input;
                    this.midiInput.onmidimessage = (message) => this.handleMidiMessage(message);
                    this.statusElement.textContent = `Connected to: ${this.midiInput.name}. Ready!`;
                    this.connectMidiBtn.disabled = true;
                    this.startGameBtn.disabled = false;
                    deviceFound = true;
                }
            });
            if (!deviceFound) { // Should not happen if inputs.size > 0, but as a fallback
                 this.statusElement.textContent = 'Could not connect to a MIDI device. Try computer keys.';
                 this.startGameBtn.disabled = false;
            }
            
        } catch (error) {
            console.error('MIDI connection failed:', error);
            this.statusElement.textContent = `MIDI Error: ${error.message}. Using computer keys.`;
            this.startGameBtn.disabled = false; // Allow starting with computer keys
        }
    }
    
    handleMidiMessage(message) {
        const [command, note, velocity] = message.data;
        if (command === 144 && velocity > 0) { // Note on
            this.handleNotePress(note, 'midi');
        } else if (command === 128 || (command === 144 && velocity === 0)) { // Note off
            this.handleNoteRelease(note, 'midi');
        }
    }

    handleComputerKeyPress(event) {
        // Prevent game control via spacebar, enter etc. if desired
        if (event.key === " " || event.key === "Enter") {
            // event.preventDefault(); // If these keys have other functions
        }
        if (this.isPaused && event.key.toUpperCase() !== 'P') return; // Allow P to unpause

        const key = event.key.toUpperCase();
        if (this.computerKeyToMidi.hasOwnProperty(key) && !event.repeat) {
            const midiNote = this.computerKeyToMidi[key];
            this.handleNotePress(midiNote, 'computer');
        }
    }
    // Optional: handle computer key release for sound
    // handleComputerKeyRelease(event) {
    //     const key = event.key.toUpperCase();
    //     if (this.computerKeyToMidi.hasOwnProperty(key)) {
    //         const midiNote = this.computerKeyToMidi[key];
    //         this.handleNoteRelease(midiNote, 'computer');
    //     }
    // }
    
    handleNotePress(midiNote, sourceType) {
        const noteName = Object.keys(this.noteToMidi).find(key => this.noteToMidi[key] === midiNote);
        if (!noteName) return;
        
        this.playNote(midiNote);
        this.visualizeKeyPress(noteName, true);
        
        if (this.isGameRunning && !this.isPaused) {
            this.checkNoteHit(noteName);
        }
    }

    handleNoteRelease(midiNote, sourceType) {
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
        if (this.isGameRunning) return;

        this.isGameRunning = true;
        this.isPaused = false;
        this.resetScoreAndLives(); // Reset score for a new game session
        this.applyLevelSettings(); // Apply settings for current level

        this.startGameBtn.disabled = true;
        this.pauseGameBtn.disabled = false;
        this.freePlayBtn.disabled = true; // Disable mode switching during game
        this.gameModeBtn.disabled = true;
        this.scaleSelector.disabled = true;

        this.statusElement.textContent = this.currentMode === 'game' ? `Level ${this.currentLevel} - Go!` : 'Free Play Started!';
        
        this.lastFrameTime = performance.now();
        if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId); // Clear previous if any
        this.gameLoopId = requestAnimationFrame(this.animationFrameLoop.bind(this));
    }
    
    animationFrameLoop(currentTime) {
        if (!this.isGameRunning) {
            if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
            return;
        }

        const deltaTime = (currentTime - this.lastFrameTime); // Milliseconds since last frame
        this.lastFrameTime = currentTime;

        if (!this.isPaused) {
            // Convert deltaTime to a factor based on 60 FPS (16.67ms per frame)
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
        if (!this.isPaused) { // When resuming
            this.lastFrameTime = performance.now(); // Reset lastFrameTime to avoid jump
        }
    }
    
    resetGame() { // Full reset
        this.isGameRunning = false;
        this.isPaused = false;
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }
        
        this.resetScoreAndLives();
        this.currentLevel = 1; // Reset to level 1
        this.applyLevelSettings();
        
        this.fallingNotes = [];
        this.fallingNotesContainer.innerHTML = ''; // Clear visual notes
        this.activeOscillators.forEach((_, noteKey) => this.stopNote(parseInt(noteKey)));
        
        this.updateUI();
        this.updateLevelUI();
        this.applyModeSettings(); // Re-apply mode specific UI visibility

        this.startGameBtn.disabled = false; // (this.midiInput === null); Handled by connectMidi or default for comp keys
        this.pauseGameBtn.disabled = true;
        this.pauseGameBtn.textContent = 'Pause';
        this.freePlayBtn.disabled = false;
        this.gameModeBtn.disabled = false;
        this.scaleSelector.disabled = false;

        this.statusElement.textContent = this.currentMode === 'free' ? 'Free Play Mode. Practice any scale!' : 'Ready to play!';
        this.hideHitFeedback();
        this.highlightScaleKeys(); // Re-apply scale highlighting
    }

    resetScoreAndLives() {
        this.score = 0;
        this.combo = 1;
        this.maxCombo = 0;
        this.lives = 3;
    }
    
    gameUpdate(deltaFactor) { // deltaFactor is 1.0 at 60fps
        if (!this.isGameRunning || this.isPaused) return;
        
        this.framesSinceLastNote += deltaFactor;
        
        const currentSpawnRate = this.currentMode === 'free' ? this.noteSpawnRate : this.levels[this.currentLevel].spawnRate;
        if (this.framesSinceLastNote >= currentSpawnRate) {
            this.spawnNote();
            this.framesSinceLastNote = 0;
        }
        
        this.updateFallingNotes(deltaFactor);
        if (this.currentMode === 'game') {
            this.checkMissedNotes(); // Only check misses in game mode
        }
        this.updateUI();
    }
    
    spawnNote() {
        let notesPool;
        if (this.currentMode === 'game') {
            notesPool = this.levels[this.currentLevel].notes;
        } else { // Free Play mode
            notesPool = this.availableScales[this.currentScaleKey];
        }

        if (!notesPool || notesPool.length === 0) {
            console.warn(`No notes available for current level/scale. Defaulting to C4.`);
            notesPool = ['C4']; // Fallback
        }
        
        const randomNoteName = notesPool[Math.floor(Math.random() * notesPool.length)];
        const keyElement = document.querySelector(`[data-note="${randomNoteName}"]`);

        if (!keyElement) {
            console.warn(`Key element not found for note: ${randomNoteName}. Skipping spawn.`);
            return;
        }
        
        const keyRect = keyElement.getBoundingClientRect();
        const gameAreaRect = this.gameArea.getBoundingClientRect(); // Re-fetch in case of resize
        
        // Ensure barWidth is dynamically calculated or use a fixed value
        // For now, use this.barWidth, ensure it matches key visual if intended.
        // Let's make barWidth responsive to the key's actual width for better alignment.
        const currentBarWidth = keyElement.classList.contains('white-key') ? 
                                parseFloat(getComputedStyle(keyElement).width) * 0.8 : // Slightly narrower than white key
                                parseFloat(getComputedStyle(keyElement).width) * 0.9;  // Slightly narrower than black key
        
        const noteX = (keyRect.left - gameAreaRect.left) + (keyRect.width / 2) - (currentBarWidth / 2);
        
        const note = {
            id: Date.now() + Math.random(),
            noteName: randomNoteName,
            x: noteX,
            y: -this.barHeight, // Start off-screen from top
            width: currentBarWidth,
            element: null, // Will be assigned in createNoteElement
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
        
        // In free play, highlight the note as it approaches
        if (this.currentMode === 'free') {
            noteElement.style.backgroundColor = 'rgba(100, 200, 255, 0.7)'; // Light blue for free play
        } else {
            noteElement.style.backgroundColor = '#3498db'; // Default game mode color
        }
        
        note.element = noteElement;
        this.fallingNotesContainer.appendChild(noteElement);
    }
    
    updateFallingNotes(deltaFactor) {
        const currentSpeed = (this.currentMode === 'free' ? this.gameSpeed : this.levels[this.currentLevel].speed) * deltaFactor;

        for (let i = this.fallingNotes.length - 1; i >= 0; i--) {
            const note = this.fallingNotes[i];
            if (!note.hit && !note.missed) {
                note.y += currentSpeed;
                if (note.element) {
                    note.element.style.top = `${note.y}px`;
                }

                // In free play, continuously highlight the key it's meant for
                if (this.currentMode === 'free' && note.y > this.hitLineY - this.barHeight * 2 && note.y < this.hitLineY + this.barHeight) {
                    // Could add a temporary highlight to the target virtual key here
                }
            }
        }
    }
    
    checkNoteHit(pressedNoteName) {
        let hitOccurred = false;
        let bestHitQuality = null; // To handle one press hitting only the 'best' timed note

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
                } else { // Free Play - still show feedback
                    this.showHitFeedback(quality, true); // isFreePlay = true
                }

                bar.hit = true;
                hitOccurred = true;
                bestHitQuality = quality; // Assuming first good hit is taken

                if (bar.element) {
                    bar.element.classList.add(quality); // e.g., 'perfect', 'great', 'good'
                    bar.element.classList.add('hit-flash');
                    this.createParticleEffect(bar.x + (bar.width / 2), this.hitLineY);
                }
                
                // Schedule removal after animation
                setTimeout(() => this.removeNote(bar.id), 400); 
                break; // Process only one hit per key press
            }
        }

        const keyElement = document.querySelector(`[data-note="${pressedNoteName}"]`);
        if (keyElement) {
            // Clear previous feedback classes before adding new one
            keyElement.classList.remove('feedback-perfect', 'feedback-great', 'feedback-good', 'feedback-wrong', 'active');
            keyElement.classList.add('active'); // Re-add active for current press

            if (hitOccurred && bestHitQuality) {
                keyElement.classList.add(`feedback-${bestHitQuality}`);
            } else if (this.currentMode === 'game' && this.isGameRunning && !this.isPaused) {
                // Pressed key but missed timing or wrong note for active bars
                keyElement.classList.add('feedback-wrong');
                this.combo = 1; // Reset combo on a mistimed press in game mode
                this.showHitFeedback('miss');
            }
            setTimeout(() => {
                keyElement.classList.remove('active', `feedback-${bestHitQuality}`, 'feedback-wrong');
            }, 400);
        }
        
        if (this.currentMode === 'game') this.updateUI();
    }

    showHitFeedback(quality, isFreePlay = false) {
        if (!this.hitFeedbackElement) return;
        
        let text = '';
        switch(quality) {
            case 'perfect': text = 'Perfect!'; break;
            case 'great': text = 'Great!'; break;
            case 'good': text = 'Good!'; break;
            case 'miss': text = isFreePlay ? '' : 'Miss!'; break; // Don't show "Miss!" text in free play for random presses
        }
        if (!text && !isFreePlay && quality !== 'miss') return; // Only show miss if relevant

        this.hitFeedbackElement.textContent = text;
        this.hitFeedbackElement.className = 'hit-feedback'; // Reset classes
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

            // A bar is missed if its TOP (bar.y) has passed well below the hitLineY + tolerance
            if (bar.y > this.hitLineY + this.hitTolerances.good) {
                bar.missed = true;
                this.lives--;
                this.combo = 1;
                this.showHitFeedback('miss');

                if (bar.element) {
                    bar.element.classList.add('miss');
                    // Schedule removal after visual indication
                    setTimeout(() => this.removeNote(bar.id), 700);
                }
                
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver();
                    break; // Stop checking once game is over
                }
            }
        }
    }
    
    createParticleEffect(x, y) {
        const particleCount = 5; // Fewer particles
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            // Ensure particles spawn relative to gameArea, not viewport
            particle.style.left = `${x}px`;
            particle.style.top = `${y - this.gameArea.getBoundingClientRect().top}px`; // Adjust for gameArea offset
            particle.style.setProperty('--dx', `${(Math.random() - 0.5) * 80}px`); // Reduced spread
            particle.style.setProperty('--dy', `${(Math.random() - 0.5) * 80 - 20}px`); // Bias upwards
            
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
        if (this.currentMode !== 'game' || !this.levels[this.currentLevel]) return;
        // const levelConf = this.levels[this.currentLevel];
        // gameSpeed and noteSpawnRate are dynamically read in update/spawn methods
        this.updateLevelUI();
    }

    advanceLevel() {
        if (this.currentMode !== 'game') return;
        // Condition for advancing level (e.g., certain score, number of perfects)
        // For simplicity, let's say after X score or X notes hit
        const scoreThresholdForNextLevel = this.currentLevel * 1000; // Example
        if (this.score >= scoreThresholdForNextLevel && this.levels[this.currentLevel + 1]) {
            this.currentLevel++;
            this.applyLevelSettings();
            this.statusElement.textContent = `Level Up! Now Level ${this.currentLevel}!`;
            // Could add a small visual/audio cue for level up
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
        
        // Clear remaining notes with a delay for visual effect
        setTimeout(() => {
            this.fallingNotes.forEach(note => note.element?.classList.add('miss'));
            setTimeout(() => {
                 this.fallingNotesContainer.innerHTML = '';
                 this.fallingNotes = [];
            }, 1000);
        }, 500);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new MidiKeyboardGame();
    window.midiGame = game; // Make it accessible for debugging
    console.log("MIDI Keyboard Practice Game Initialized. Access with 'window.midiGame'.");
});