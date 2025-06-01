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
        this.gameSpeed = 2; // pixels per frame
        this.noteSpawnRate = 120; // frames between notes (2 seconds at 60fps)
        this.framesSinceLastNote = 0;
        this.gameLoop = null;
        
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
        
        // Buttons
        this.connectMidiBtn = document.getElementById('connectMidi');
        this.startGameBtn = document.getElementById('startGame');
        this.pauseGameBtn = document.getElementById('pauseGame');
        this.resetGameBtn = document.getElementById('resetGame');
        
        // Volume control
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
    }
    
    bindEvents() {
        this.connectMidiBtn.addEventListener('click', () => this.connectMidi());
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.pauseGameBtn.addEventListener('click', () => this.togglePause());
        this.resetGameBtn.addEventListener('click', () => this.resetGame());
        
        // Volume control
        this.volumeSlider.addEventListener('input', (e) => this.updateVolume(e.target.value));
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
        this.updateUI();
        this.startGameBtn.disabled = this.midiInput === null && !this.startGameBtn.disabled;
        this.pauseGameBtn.disabled = true;
        this.pauseGameBtn.textContent = 'Pause';
        this.statusElement.textContent = this.midiInput ? 'Ready to play!' : 'Click "Connect MIDI" to begin';
    }
    
    update() {
        if (!this.isGameRunning || this.isPaused) return;
        
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
        const randomNote = this.practiceNotes[Math.floor(Math.random() * this.practiceNotes.length)];
        const keyElement = document.querySelector(`[data-note="${randomNote}"]`);
        if (!keyElement) return;
        
        const keyRect = keyElement.getBoundingClientRect();
        const gameAreaRect = this.gameArea.getBoundingClientRect();
        const noteX = keyRect.left - gameAreaRect.left + (keyRect.width / 2) - 30; // Center on key
        
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
        noteElement.className = 'falling-note';
        noteElement.id = `note-${note.id}`;
        noteElement.textContent = note.note;
        noteElement.style.left = `${note.x}px`;
        noteElement.style.top = `${note.y}px`;
        
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
        const hitZoneTop = this.gameArea.offsetHeight - 130; // Hit zone position
        const hitZoneBottom = this.gameArea.offsetHeight - 50;
        
        for (let note of this.fallingNotes) {
            if (note.hit || note.missed) continue;
            
            if (note.note === pressedNote && 
                note.y >= hitZoneTop && 
                note.y <= hitZoneBottom) {
                
                // Calculate timing accuracy
                const hitZoneCenter = (hitZoneTop + hitZoneBottom) / 2;
                const distance = Math.abs(note.y - hitZoneCenter);
                const maxDistance = (hitZoneBottom - hitZoneTop) / 2;
                const accuracy = 1 - (distance / maxDistance);
                
                // Score based on accuracy
                let points = Math.floor(100 * accuracy);
                if (accuracy > 0.8) points = 100; // Perfect
                else if (accuracy > 0.6) points = 75; // Good
                else points = 50; // OK
                
                this.score += points * this.combo;
                this.combo = Math.min(this.combo + 1, 10); // Max combo of 10
                
                // Visual feedback
                note.hit = true;
                const noteElement = document.getElementById(`note-${note.id}`);
                if (noteElement) {
                    noteElement.classList.add('hit');
                    this.createParticleEffect(note.x + 30, note.y + 30);
                }
                
                // Highlight the correct key
                const keyElement = document.querySelector(`[data-note="${pressedNote}"]`);
                if (keyElement) {
                    keyElement.classList.add('correct');
                    setTimeout(() => keyElement.classList.remove('correct'), 500);
                }
                
                // Remove note after animation
                setTimeout(() => this.removeNote(note.id), 300);
                return;
            }
        }
        
        // If we get here, it was a wrong key press
        this.combo = 1;
        const keyElement = document.querySelector(`[data-note="${pressedNote}"]`);
        if (keyElement) {
            keyElement.classList.add('wrong');
            setTimeout(() => keyElement.classList.remove('wrong'), 500);
        }
    }
    
    checkMissedNotes() {
        const missThreshold = this.gameArea.offsetHeight;
        
        this.fallingNotes.forEach(note => {
            if (!note.hit && !note.missed && note.y > missThreshold) {
                note.missed = true;
                this.lives--;
                this.combo = 1;
                
                const noteElement = document.getElementById(`note-${note.id}`);
                if (noteElement) {
                    noteElement.classList.add('miss');
                    setTimeout(() => this.removeNote(note.id), 500);
                }
                
                if (this.lives <= 0) {
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
    console.log('- Or use computer keyboard: C, D, E, F, G, A, B keys');
    console.log('- Press the correct key when notes reach the green hit zone');
    console.log('- Get points based on timing accuracy');
    console.log('- 3 mistakes and you\'re out!');
});