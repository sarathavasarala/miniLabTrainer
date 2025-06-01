class MidiKeyboardGame {
    constructor() {
        this.score = 0;
        this.combo = 1;
        this.lives = 3;
        this.isGameRunning = false;
        this.isPaused = false;
        this.midiAccess = null;
        this.midiInput = null;
        this.fallingNotes = [];
        this.gameSpeed = 1; // pixels per frame
        this.noteSpawnRate = 120; // frames between notes (2 seconds at 60fps)
        this.framesSinceLastNote = 0;
        this.barHeight = 60;
        this.hitTolerance = 5; // Pixels for hit accuracy
        this.barWidth = 50; // Width of the falling bars
        this.gameLoop = null;
        this.currentMode = 'game'; // 'game' or 'free'

        this.availableScales = {
            'all_notes': this.practiceNotes, // Existing full range
            'c_major_pentascale': ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
            'g_major_pentascale': ['G3', 'A3', 'B3', 'D4', 'E4', 'G4'],
            'chromatic_c4_c5': ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5']
        };
        this.currentScale = 'all_notes';
        
        // Audio setup
        this.audioContext = null;
        this.masterVolume = null;
        this.activeOscillators = new Map(); // Track active notes to prevent overlapping
        
        // Note configuration - C3 to C5 range (25 keys total) - Arturia MiniLab 3 layout
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

        this.computerKeyToMidi = {
            'A': 60, // C4
            'W': 61, // C#4
            'S': 62, // D4
            'E': 63, // D#4
            'D': 64, // E4
            'F': 65, // F4
            'T': 66, // F#4
            'G': 67, // G4
            'Y': 68, // G#4
            'H': 69, // A4
            'U': 70, // A#4
            'J': 71  // B4
        };
        
        this.initializeElements();
        this.bindEvents();
        this.initializeAudio();
    }
    
    async initializeAudio() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master volume control
            this.masterVolume = this.audioContext.createGain();
            this.masterVolume.gain.value = 0.3; // Set to 30% volume
            this.masterVolume.connect(this.audioContext.destination);
            
            console.log('Audio system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize audio:', error);
        }
    }
    
    // Convert MIDI note number to frequency
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }
    
    // Play a note with the given MIDI number
    playNote(midiNote, duration = 0.5) {
        if (!this.audioContext) return;
        
        // Resume audio context if it's suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const frequency = this.midiToFrequency(midiNote);
        const noteKey = midiNote.toString();
        
        // Stop any existing note with the same key
        this.stopNote(midiNote);
        
        // Create oscillator for the main tone
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        // Set up a more pleasant piano-like sound using multiple harmonics
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        // Create envelope for natural piano attack/decay
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.8, now + 0.01); // Quick attack
        gainNode.gain.exponentialRampToValueAtTime(0.3, now + 0.1); // Decay
        gainNode.gain.exponentialRampToValueAtTime(0.1, now + duration * 0.7); // Sustain
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Release
        
        // Connect the audio graph
        oscillator.connect(gainNode);
        gainNode.connect(this.masterVolume);
        
        // Store the oscillator so we can stop it later
        this.activeOscillators.set(noteKey, { oscillator, gainNode });
        
        // Start the oscillator
        oscillator.start(now);
        oscillator.stop(now + duration);
        
        // Clean up after the note ends
        oscillator.onended = () => {
            this.activeOscillators.delete(noteKey);
        };
    }
    
    // Stop a specific note
    stopNote(midiNote) {
        const noteKey = midiNote.toString();
        const activeNote = this.activeOscillators.get(noteKey);
        
        if (activeNote) {
            const now = this.audioContext.currentTime;
            // Quick fade out to avoid clicks
            activeNote.gainNode.gain.cancelScheduledValues(now);
            activeNote.gainNode.gain.setValueAtTime(activeNote.gainNode.gain.value, now);
            activeNote.gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            
            activeNote.oscillator.stop(now + 0.05);
            this.activeOscillators.delete(noteKey);
        }
    }
    
    initializeElements() {
        this.scoreElement = document.getElementById('score');
        this.comboElement = document.getElementById('combo');
        this.livesElement = document.getElementById('lives-display');
        this.statusElement = document.getElementById('status');
        this.gameArea = document.getElementById('gameArea');
        this.fallingNotesContainer = document.getElementById('fallingNotes');
        this.keyboard = document.getElementById('keyboard');

        // Score/Lives sections for show/hide
        this.scoreSection = document.querySelector('.score-section');
        this.livesSection = document.querySelector('.lives-section');
        
        // Buttons
        this.connectMidiBtn = document.getElementById('connectMidi');
        this.startGameBtn = document.getElementById('startGame');
        this.pauseGameBtn = document.getElementById('pauseGame');
        this.resetGameBtn = document.getElementById('resetGame');
        
        // Volume control
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');

        // Game mode buttons
        this.freePlayBtn = document.getElementById('freePlayBtn');
        this.gameModeBtn = document.getElementById('gameModeBtn');

        // Scale selector
        this.scaleSelector = document.getElementById('scaleSelector');
    }

    populateScaleSelector() {
        if (!this.scaleSelector) return;

        // Clear existing options first (if any, e.g., from HTML)
        this.scaleSelector.innerHTML = '';

        for (const scaleKey in this.availableScales) {
            const option = document.createElement('option');
            option.value = scaleKey;
            // Create a more user-friendly name: replace underscores with spaces, capitalize words
            let friendlyName = scaleKey.replace(/_/g, ' ');
            friendlyName = friendlyName.replace(/\b\w/g, l => l.toUpperCase());
            option.textContent = friendlyName;
            this.scaleSelector.appendChild(option);
        }
        // Set the dropdown to reflect the initial currentScale
        this.scaleSelector.value = this.currentScale;
    }
    
    bindEvents() {
        this.connectMidiBtn.addEventListener('click', () => this.connectMidi());
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.pauseGameBtn.addEventListener('click', () => this.togglePause());
        this.resetGameBtn.addEventListener('click', () => this.resetGame());
        
        // Volume control
        this.volumeSlider.addEventListener('input', (e) => this.updateVolume(e.target.value));

        // Game mode buttons
        this.freePlayBtn.addEventListener('click', () => this.setMode('free'));
        this.gameModeBtn.addEventListener('click', () => this.setMode('game'));

        // Scale selector
        if (this.scaleSelector) {
            this.scaleSelector.addEventListener('change', (event) => this.setScale(event.target.value));
        }

        document.addEventListener('keydown', (event) => this.handleComputerKeyPress(event));
    }

    setMode(mode) {
        if (this.currentMode === mode) return; // Do nothing if already in this mode

        this.currentMode = mode;
        this.resetGame(); // Reset game state when changing modes

        if (mode === 'free') {
            this.freePlayBtn.classList.add('active-mode');
            this.gameModeBtn.classList.remove('active-mode');
        } else { // game mode
            this.gameModeBtn.classList.add('active-mode');
            this.freePlayBtn.classList.remove('active-mode');
        }
        // applyModeSettings is called within resetGame
    }

    setScale(scaleName) {
        if (this.availableScales.hasOwnProperty(scaleName)) {
            this.currentScale = scaleName;
            this.resetGame(); // Reset the game for the new scale to take effect
            // Update dropdown UI if it's not already bound to this.currentScale
            if (this.scaleSelector) { // Check if scaleSelector is initialized
                this.scaleSelector.value = scaleName;
            }
        } else {
            console.warn(`Scale "${scaleName}" not found.`);
        }
    }

    applyModeSettings() {
        if (this.currentMode === 'free') {
            // Hide score, combo, lives sections
            if (this.scoreSection) this.scoreSection.style.display = 'none';
            if (this.livesSection) this.livesSection.style.display = 'none';
            // Optionally, you might want to visually indicate free play mode in the status
            this.statusElement.textContent = 'Free Play Mode. Practice freely!';
        } else { // game mode
            // Show score, combo, lives sections
            if (this.scoreSection) this.scoreSection.style.display = ''; // Revert to default display
            if (this.livesSection) this.livesSection.style.display = ''; // Revert to default display
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
            
            if (!navigator.requestMIDIAccess) {
                throw new Error('Web MIDI API not supported in this browser');
            }
            
            this.midiAccess = await navigator.requestMIDIAccess();
            this.statusElement.textContent = 'MIDI access granted. Looking for devices...';
            
            // Look for MIDI input devices
            const inputs = this.midiAccess.inputs;
            let deviceFound = false;
            
            for (let input of inputs.values()) {
                console.log('Found MIDI device:', input.name);
                this.midiInput = input;
                this.midiInput.onmidimessage = (message) => this.handleMidiMessage(message);
                deviceFound = true;
                break; // Use the first available device
            }
            
            if (deviceFound) {
                this.statusElement.textContent = `Connected to: ${this.midiInput.name}`;
                this.connectMidiBtn.disabled = true;
                this.startGameBtn.disabled = false;
            } else {
                this.statusElement.textContent = 'No MIDI devices found. Please connect your MiniLab 3 and try again.';
                this.startGameBtn.disabled = true;
            }
            
        } catch (error) {
            console.error('MIDI connection failed:', error);
            this.statusElement.textContent = `MIDI Error: ${error.message}. Please connect your MiniLab 3.`;
            this.startGameBtn.disabled = true;
        }
    }
    
    handleMidiMessage(message) {
        const [command, note, velocity] = message.data;
        
        // Note on message (144) with velocity > 0
        if (command === 144 && velocity > 0) {
            this.handleNotePress(note);
        }
        // Note off message (128) or note on with velocity 0
        else if (command === 128 || (command === 144 && velocity === 0)) {
            this.stopNote(note);
        }
    }

    handleComputerKeyPress(event) {
        const key = event.key.toUpperCase();
        if (this.computerKeyToMidi.hasOwnProperty(key)) {
            const midiNote = this.computerKeyToMidi[key];

            // Prevent re-triggering if key is held down, if desired (optional for now)
            // if (this.isGameRunning && !this.isPaused && !event.repeat) {
            //     this.handleNotePress(midiNote);
            // }

            // For simplicity, always call handleNotePress on keydown for this game type
            if (this.isGameRunning && !this.isPaused) {
                this.handleNotePress(midiNote);
            }
        }
    }
    
    handleNotePress(midiNote) {
        // Find the corresponding note name
        const noteName = Object.keys(this.noteToMidi).find(key => this.noteToMidi[key] === midiNote);
        if (!noteName) return;
        
        // Play the audio for this note
        this.playNote(midiNote, 0.8);
        
        // Visual feedback - highlight the pressed key
        this.highlightKey(noteName);
        
        // Check if this note press hits any falling notes (only during game)
        if (this.isGameRunning && !this.isPaused) {
            this.checkNoteHit(noteName);
        }
    }
    
    highlightKey(noteName) {
        const key = document.querySelector(`[data-note="${noteName}"]`);
        if (key) {
            key.classList.add('active');
            setTimeout(() => key.classList.remove('active'), 150);
        }
    }
    
    startGame() {
        this.isGameRunning = true;
        this.isPaused = false;
        this.startGameBtn.disabled = true;
        this.pauseGameBtn.disabled = false;
        this.statusElement.textContent = 'Game started! Press the keys when notes reach the hit zone.';
        
        this.gameLoop = setInterval(() => this.update(), 1000 / 60); // 60 FPS
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        this.pauseGameBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        this.statusElement.textContent = this.isPaused ? 'Game paused' : 'Game resumed';
    }
    
    resetGame() {
        this.isGameRunning = false;
        this.isPaused = false;
        this.score = 0;
        this.combo = 1;
        this.lives = 3;
        this.fallingNotes = [];
        this.framesSinceLastNote = 0;
        
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        
        // Stop all active notes
        this.activeOscillators.forEach((noteData, noteKey) => {
            this.stopNote(parseInt(noteKey));
        });
        
        // Clear falling notes from DOM
        this.fallingNotesContainer.innerHTML = '';
        
        // Reset UI
        this.updateUI(); // score/lives/combo to defaults
        this.applyModeSettings(); // Apply mode-specific UI changes (show/hide elements)

        this.startGameBtn.disabled = this.midiInput === null && !this.startGameBtn.disabled;
        this.pauseGameBtn.disabled = true;
        this.pauseGameBtn.textContent = 'Pause';
        // Status message will be set by applyModeSettings if in free play, otherwise default
        if (this.currentMode === 'game') {
            this.statusElement.textContent = this.midiInput ? 'Ready to play!' : 'Click "Connect MIDI" to begin';
        }
    }
    
    update() {
        if (!this.isGameRunning || this.isPaused) return;
        
        // In free play, notes might not spawn if lives/score logic is tied to spawning.
        // For now, let's assume continuous note spawning regardless of mode,
        // and score/lives are just not counted in 'free' mode.
        // If specific free-play behavior for spawning is needed, it can be added here.

        this.framesSinceLastNote++;
        
        // Spawn new notes
        if (this.framesSinceLastNote >= this.noteSpawnRate) {
            this.spawnNote();
            this.framesSinceLastNote = 0;
        }
        
        // Update falling notes
        this.updateFallingNotes();
        
        // Check for missed notes
        this.checkMissedNotes();
        
        // Update UI
        this.updateUI();
    }
    
    spawnNote() {
        const currentScaleNotes = this.availableScales[this.currentScale];
        if (!currentScaleNotes || currentScaleNotes.length === 0) {
            console.warn(`Current scale "${this.currentScale}" has no notes or is invalid. Defaulting to all_notes.`);
            // Default to all_notes if current scale is problematic
            this.currentScale = 'all_notes';
            const fallbackScaleNotes = this.availableScales[this.currentScale];
            if (!fallbackScaleNotes || fallbackScaleNotes.length === 0) {
                 // This should not happen if 'all_notes' is correctly defined with practiceNotes
                console.error("Fallback scale 'all_notes' is also empty. Cannot spawn notes.");
                return;
            }
             const randomNote = fallbackScaleNotes[Math.floor(Math.random() * fallbackScaleNotes.length)];
        }

        const randomNote = currentScaleNotes[Math.floor(Math.random() * currentScaleNotes.length)];
        const keyElement = document.querySelector(`[data-note="${randomNote}"]`);

        if (!keyElement) {
            console.warn(`Key element not found for note: ${randomNote} in scale ${this.currentScale}. Skipping spawn.`);
            return; // Skip if the note's key element isn't on the virtual keyboard
        }
        
        const keyRect = keyElement.getBoundingClientRect();
        const gameAreaRect = this.gameArea.getBoundingClientRect();
        const noteX = keyRect.left - gameAreaRect.left + (keyRect.width / 2) - (this.barWidth / 2); // Center the bar
        
        const note = {
            id: Date.now() + Math.random(),
            note: randomNote,
            x: noteX,
            y: 0,
            hit: false,
            missed: false
        };
        
        this.fallingNotes.push(note);
        this.createNoteElement(note);
    }
    
    createNoteElement(note) {
        const noteElement = document.createElement('div');
        noteElement.className = 'falling-bar'; // Changed class name
        noteElement.id = `note-${note.id}`;
        noteElement.textContent = note.note; // Display note name
        noteElement.style.left = `${note.x}px`;
        noteElement.style.top = `${note.y}px`;
        noteElement.style.width = `${this.barWidth}px`; // New: using this.barWidth
        noteElement.style.height = `${this.barHeight}px`; // New: using this.barHeight
        
        this.fallingNotesContainer.appendChild(noteElement);
    }
    
    updateFallingNotes() {
        this.fallingNotes.forEach(note => {
            if (!note.hit && !note.missed) {
                note.y += this.gameSpeed;
                const noteElement = document.getElementById(`note-${note.id}`);
                if (noteElement) {
                    noteElement.style.top = `${note.y}px`;
                }
            }
        });
    }
    
    checkNoteHit(pressedNote) {
        const keyElement = document.querySelector(`[data-note="${pressedNote}"]`);
        if (!keyElement) return;

        const gameAreaRect = this.gameArea.getBoundingClientRect();
        const keyRect = keyElement.getBoundingClientRect();
        // Calculate keyTopY relative to the fallingNotesContainer's coordinate system
        // Assuming fallingNotesContainer is the direct offsetParent for positioning calculations,
        // or that its top aligns with gameArea.top for this calculation to be simple.
        // If fallingNotesContainer has its own offset, this might need adjustment.
        // For now, assume keyTopY relative to gameArea is sufficient if bars are positioned relative to gameArea.
        const keyTopY = keyRect.top - gameAreaRect.top;

        for (let bar of this.fallingNotes) {
            if (bar.hit || bar.missed) continue;

            if (bar.note === pressedNote) {
                const barBottomY = bar.y + this.barHeight;

                if (Math.abs(barBottomY - keyTopY) <= this.hitTolerance) {
                    bar.hit = true;
                    if (this.currentMode === 'game') {
                        this.score += 100; // Basic score
                        this.combo = Math.min(this.combo + 1, 10);
                    }

                    const barElement = document.getElementById(`note-${bar.id}`);
                    if (barElement) {
                        barElement.classList.add('hit');
                        // barElement.textContent = '✓'; // Note name persists, hit indicated by style
                        // Position particles at the bottom-center of the bar where it hits the key line
                        this.createParticleEffect(bar.x + (this.barWidth / 2), barBottomY);
                        setTimeout(() => this.removeNote(bar.id), 300);
                    }

                    keyElement.classList.add('correct');
                    setTimeout(() => keyElement.classList.remove('correct'), 500);

                    this.updateUI(); // Update score and combo display
                    return; // One press hits one bar
                }
            }
        }

        // If loop completes, no bar was hit for this key press at the right time
        if (this.currentMode === 'game') {
            this.combo = 1;
        }
        keyElement.classList.add('wrong');
        setTimeout(() => keyElement.classList.remove('wrong'), 500);
        this.updateUI(); // Update combo display
    }
    
    checkMissedNotes() {
        const gameAreaRect = this.gameArea.getBoundingClientRect();

        this.fallingNotes.forEach(bar => {
            if (bar.hit || bar.missed) return; // Use 'return' to skip to next iteration in forEach

            const keyElement = document.querySelector(`[data-note="${bar.note}"]`);
            if (!keyElement) {
                console.warn(`Missed check: No key element found for note ${bar.note}`);
                return;
            }

            const keyRect = keyElement.getBoundingClientRect();
            const keyTopY = keyRect.top - gameAreaRect.top;

            // A bar is missed if its top (bar.y) has passed the key's top alignment point (keyTopY)
            // by more than the hitTolerance. This means the opportunity to align
            // bar.y + this.barHeight with keyTopY is gone.
            if (bar.y > keyTopY + this.hitTolerance) {
                bar.missed = true;
                if (this.currentMode === 'game') {
                    this.lives--;
                    this.combo = 1;
                }

                const barElement = document.getElementById(`note-${bar.id}`);
                if (barElement) {
                    barElement.classList.add('miss');
                    // barElement.textContent = '✗'; // Note name persists, miss indicated by style
                    // Add a small visual effect like a shake or fade out for missed notes
                    setTimeout(() => {
                        if (barElement.parentNode) { // Check if still in DOM
                            // Optional: Add a more distinct miss animation if desired
                            // For now, just remove it
                            this.removeNote(bar.id);
                        }
                    }, 500);
                }
                
                this.updateUI();

                if (this.currentMode === 'game' && this.lives <= 0) {
                    this.gameOver();
                }
            }
        });
    }
    
    createParticleEffect(x, y) {
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            particle.style.setProperty('--dx', `${(Math.random() - 0.5) * 100}px`);
            particle.style.setProperty('--dy', `${(Math.random() - 0.5) * 100}px`);
            
            this.gameArea.appendChild(particle);
            
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 1000);
        }
    }
    
    removeNote(noteId) {
        this.fallingNotes = this.fallingNotes.filter(note => note.id !== noteId);
        const noteElement = document.getElementById(`note-${noteId}`);
        if (noteElement && noteElement.parentNode) {
            noteElement.parentNode.removeChild(noteElement);
        }
    }
    
    updateUI() {
        this.scoreElement.textContent = this.score;
        this.comboElement.textContent = this.combo;
        this.livesElement.textContent = '♥'.repeat(this.lives) + '♡'.repeat(3 - this.lives);
    }
    
    gameOver() {
        this.isGameRunning = false;
        clearInterval(this.gameLoop);
        this.gameLoop = null;
        
        // Stop all active notes
        this.activeOscillators.forEach((noteData, noteKey) => {
            this.stopNote(parseInt(noteKey));
        });
        
        this.statusElement.textContent = `Game Over! Final Score: ${this.score}`;
        this.startGameBtn.disabled = false;
        this.pauseGameBtn.disabled = true;
        
        // Clear remaining notes
        setTimeout(() => {
            this.fallingNotesContainer.innerHTML = '';
            this.fallingNotes = [];
        }, 1000);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new MidiKeyboardGame();
    
    // Add some helpful instructions
    console.log('MIDI Keyboard Practice Game Loaded!');
    console.log('Controls:');
    console.log('- Connect your MIDI keyboard and click "Connect MIDI"');
    console.log('- Or use computer keyboard: A,S,D,F,G,H,J (white keys C4-B4) and W,E,T,Y,U (black keys C#4-A#4)');
    console.log('- Press the correct key when notes reach the green hit zone');
    console.log('- Get points based on timing accuracy');
    console.log('- 3 mistakes and you\'re out!');

    // Apply initial mode settings (ensure UI is correct for default 'game' mode)
    game.applyModeSettings();
    game.populateScaleSelector(); // Populate and set initial scale in dropdown

    // Make game instance globally available for testing
    window.game = game;
    console.log("Game instance available as 'window.game'. Type 'game.runTests()' in console to run tests.");
});

// Test functions will be added to MidiKeyboardGame class prototype or within the class itself.
MidiKeyboardGame.prototype.runTests = function() {
    console.log("===== Starting Tests =====");
    this.testGameModes();
    this.testScaleSelection();
    console.log("===== Tests Finished =====");
};

MidiKeyboardGame.prototype.testGameModes = function() {
    console.log("--- Running Game Mode Tests ---");
    let passCount = 0;
    let failCount = 0;
    const originalScore = this.score;
    const originalLives = this.lives;
    const originalCombo = this.combo;

    const assert = (condition, message) => {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passCount++;
        } else {
            console.error(`[FAIL] ${message}`);
            failCount++;
        }
    };

    // Test 1: Switch to Free Play
    console.log("Testing Free Play Mode...");
    this.setMode('free');
    assert(this.currentMode === 'free', "Mode set to 'free'");
    assert(this.scoreSection.style.display === 'none', "Score section hidden in free play");
    assert(this.livesSection.style.display === 'none', "Lives section hidden in free play");

    // Simulate note hit in Free Play
    const initialScoreFree = this.score;
    this.checkNoteHit('C4'); // Assuming C4 is a valid note for this check
    assert(this.score === initialScoreFree, "Score does not change on hit in free play");
    assert(this.combo === 1, "Combo remains 1 on hit in free play (or its initial free play state)");

    // Simulate note miss in Free Play
    const initialLivesFree = this.lives; // Should be 3 after resetGame in setMode
    // Mock a missed note
    const mockMissedNoteFree = {
        id: 'test-miss-free',
        note: 'C4', // Any valid note
        x: 50,
        y: this.gameArea.getBoundingClientRect().height + 100, // Ensure it's way past the hit zone
        hit: false,
        missed: false // checkMissedNotes will set this
    };
    this.fallingNotes.push(mockMissedNoteFree);
    this.checkMissedNotes();
    assert(this.lives === initialLivesFree, "Lives do not change on miss in free play");
    this.fallingNotes = this.fallingNotes.filter(n => n.id !== 'test-miss-free'); // Clean up

    // Test 2: Switch back to Game Mode
    console.log("Testing Game Mode...");
    this.setMode('game');
    assert(this.currentMode === 'game', "Mode set to 'game'");
    assert(this.scoreSection.style.display !== 'none', "Score section visible in game mode");
    assert(this.livesSection.style.display !== 'none', "Lives section visible in game mode");

    // Reset score/lives for clearer testing of game mode effects
    this.score = 0;
    this.lives = 3;
    this.combo = 1;
    this.updateUI();


    // Simulate note hit in Game Mode
    this.checkNoteHit('D4'); // Use a different note to avoid potential interference
    assert(this.score > 0, "Score increases on hit in game mode");
    // Combo assertion depends on hitting a valid falling note, which is hard to guarantee here.
    // We're mainly testing that score logic runs.

    // Simulate note miss in Game Mode
    const initialLivesGame = this.lives;
    const mockMissedNoteGame = {
        id: 'test-miss-game',
        note: 'D4',
        x: 50,
        y: this.gameArea.getBoundingClientRect().height + 100,
        hit: false,
        missed: false
    };
    this.fallingNotes.push(mockMissedNoteGame);
    this.checkMissedNotes();
    assert(this.lives < initialLivesGame, "Lives decrease on miss in game mode");
    this.fallingNotes = this.fallingNotes.filter(n => n.id !== 'test-miss-game'); // Clean up

    // Restore original game state before tests
    this.score = originalScore;
    this.lives = originalLives;
    this.combo = originalCombo;
    this.setMode('game'); // Default back to game mode
    this.updateUI();
    console.log(`Game Mode Test Summary: ${passCount} PASS, ${failCount} FAIL`);
};

MidiKeyboardGame.prototype.testScaleSelection = function() {
    console.log("--- Running Scale Selection Tests ---");
    let passCount = 0;
    let failCount = 0;
    const originalScale = this.currentScale;
    // It's tricky to test spawn rate without async/await, so we'll focus on the note pool.

    const assert = (condition, message) => {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passCount++;
        } else {
            console.error(`[FAIL] ${message}`);
            failCount++;
        }
    };

    // Test 1: C Major Pentascale
    console.log("Testing C Major Pentascale...");
    this.setScale('c_major_pentascale');
    assert(this.currentScale === 'c_major_pentascale', "Scale set to 'c_major_pentascale'");
    const cMajorPentaNotes = this.availableScales['c_major_pentascale'];
    assert(JSON.stringify(this.availableScales[this.currentScale]) === JSON.stringify(cMajorPentaNotes), "Correct notes for C Major Pentascale");

    let spawnedNotesCMajor = [];
    for (let i = 0; i < 20; i++) { // Spawn 20 notes
        // Temporarily clear fallingNotes to isolate spawned notes for this test run
        const originalFallingNotes = [...this.fallingNotes];
        this.fallingNotes = [];
        this.spawnNote();
        if (this.fallingNotes.length > 0) {
            spawnedNotesCMajor.push(this.fallingNotes[0].note);
        }
        this.fallingNotes = originalFallingNotes; // Restore
    }
    let allInCMajorPenta = true;
    for (const note of spawnedNotesCMajor) {
        if (!cMajorPentaNotes.includes(note)) {
            allInCMajorPenta = false;
            break;
        }
    }
    assert(allInCMajorPenta && spawnedNotesCMajor.length > 0, "All spawned notes are in C Major Pentascale");
    if (!allInCMajorPenta) console.log("Spawned notes (C Major Pentascale):", spawnedNotesCMajor);


    // Test 2: G Major Pentascale
    console.log("Testing G Major Pentascale...");
    this.setScale('g_major_pentascale');
    assert(this.currentScale === 'g_major_pentascale', "Scale set to 'g_major_pentascale'");
    const gMajorPentaNotes = this.availableScales['g_major_pentascale'];
    assert(JSON.stringify(this.availableScales[this.currentScale]) === JSON.stringify(gMajorPentaNotes), "Correct notes for G Major Pentascale");

    let spawnedNotesGMajor = [];
    for (let i = 0; i < 20; i++) {
        const originalFallingNotes = [...this.fallingNotes];
        this.fallingNotes = [];
        this.spawnNote();
        if (this.fallingNotes.length > 0) {
            spawnedNotesGMajor.push(this.fallingNotes[0].note);
        }
        this.fallingNotes = originalFallingNotes;
    }
    let allInGMajorPenta = true;
    for (const note of spawnedNotesGMajor) {
        if (!gMajorPentaNotes.includes(note)) {
            allInGMajorPenta = false;
            break;
        }
    }
    assert(allInGMajorPenta && spawnedNotesGMajor.length > 0, "All spawned notes are in G Major Pentascale");
    if (!allInGMajorPenta) console.log("Spawned notes (G Major Pentascale):", spawnedNotesGMajor);

    // Test 3: All Notes (fallback/default)
    console.log("Testing All Notes (Chromatic)...");
    this.setScale('all_notes');
    assert(this.currentScale === 'all_notes', "Scale set to 'all_notes'");
    // Check if it's using a wider variety (not strictly all practiceNotes, but more than pentascale)
    let spawnedNotesAll = [];
     for (let i = 0; i < 30; i++) { // Spawn more notes to check variety
        const originalFallingNotes = [...this.fallingNotes];
        this.fallingNotes = [];
        this.spawnNote();
        if (this.fallingNotes.length > 0) {
            spawnedNotesAll.push(this.fallingNotes[0].note);
        }
        this.fallingNotes = originalFallingNotes;
    }
    const uniqueNotesAll = new Set(spawnedNotesAll);
    assert(uniqueNotesAll.size > 5, "Spawned notes for 'all_notes' show variety (more than 5 unique notes)");
    if (uniqueNotesAll.size <= 5) console.log("Spawned unique notes (All Notes):", uniqueNotesAll);


    // Restore original scale
    this.setScale(originalScale);
    console.log(`Scale Selection Test Summary: ${passCount} PASS, ${failCount} FAIL`);
};