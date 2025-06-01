# 🎹 MIDI Keyboard Practice Game

A fun and interactive game to help you practice your MIDI keyboard timing, note recognition, and accuracy. Notes fall from the top, and you must press the corresponding key on your MIDI keyboard or computer keyboard as it aligns with the hit zone.

## ✨ Features

*   **MIDI Device Integration:** Connect your MIDI keyboard (optimized for C3-C5 range, e.g., Arturia MiniLab 3).
*   **Computer Keyboard Fallback:** Play using your computer keyboard. Mapped keys (C4 octave default, C5 on 'K'):
    *   White Keys (C4-B4, C5): `A`, `S`, `D`, `F`, `G`, `H`, `J`, `K`
    *   Black Keys (C#4-A#4): `W`, `E`, `T`, `Y`, `U`
    *   (Hints displayed on the virtual keyboard)
*   **Dynamic Falling Bars:** Notes appear as falling bars, visually aligned with virtual keyboard keys. Bar width adapts to key type.
*   **Game Mode with Levels:**
    *   Progress through increasingly challenging levels.
    *   Levels feature different speeds, note spawn rates, and note selections.
    *   Score points based on timing accuracy.
    *   Build combos for higher scores.
    *   Start with 3 lives; lose a life for missed notes.
*   **Free Play Mode:**
    *   Practice selected scales without pressure (no score, no lives).
    *   Slower pace, ideal for learning and familiarization.
*   **Targeted Scale Practice:**
    *   Select from various scales (e.g., Pentascales, Major, Chromatic).
    *   Keys belonging to the active scale are highlighted on the virtual keyboard.
*   **Nuanced Timing Feedback:**
    *   Hits are rated: **Perfect!**, **Great!**, **Good!**
    *   Visual and textual feedback for hit quality.
*   **Visual & Audio Polish:**
    *   Smooth animations with `requestAnimationFrame`.
    *   Virtual keyboard keys light up and provide animated feedback on press.
    *   Particle effects on successful hits.
    *   Synthesized triangle-wave sounds for pressed notes with ADSR envelope.
    *   Adjustable game audio volume.
*   **Responsive Design:** Adapts to different screen sizes, with specific optimizations for mobile.

## 🚀 How to Play

1.  **Setup:**
    *   **MIDI Keyboard (Recommended):**
        *   Connect your MIDI keyboard to your computer.
        *   Click the "Connect MIDI" button.
        *   Allow MIDI access if prompted by your browser. The status message will confirm connection.
    *   **Computer Keyboard:**
        *   If no MIDI device is connected or you prefer, you can use your computer keyboard. Default mappings for the C4 octave and C5 are shown on the virtual keyboard keys.

2.  **Choose Mode:**
    *   **Game Mode (Default):** Click "Start Game" to begin at Level 1.
        *   Notes will fall. Press the correct key as the *bottom edge* of the falling bar aligns with the **HIT LINE** inside the **HIT ZONE**.
        *   Accuracy (Perfect, Great, Good) determines your score and combo.
        *   Missed notes or incorrectly timed presses (in Game Mode) cost a life.
        *   The game ends when you run out of lives.
    *   **Free Play Mode:** Select "Free Play".
        *   Choose a scale from the "Practice Scale" dropdown.
        *   Click "Start Game". Notes from the selected scale will fall at a relaxed pace.
        *   Focus on hitting the right notes without scoring or life penalties. Excellent for learning scales and keyboard layout.

3.  **Controls:**
    *   **Connect MIDI:** Attempts to connect to an available MIDI input device.
    *   **Start Game:** Begins the game in the currently selected mode (Game or Free Play).
    *   **Pause/Resume:** Pauses or resumes the current game.
    *   **Reset:** Stops the current game and resets all progress, scores, and level to initial state for the selected mode.
    *   **Game Mode / Free Play Buttons:** Switch between the two primary modes. Resets the game.
    *   **Practice Scale Dropdown:** Select a musical scale. Notes spawned will be from this scale (especially in Free Play and early Game Mode levels).
    *   **Volume Slider:** Adjusts the game's sound volume.

## 🛠️ Running the Game

1.  Clone or download this repository.
2.  Open the `index.html` file in a modern web browser that supports the Web MIDI API and Web Audio API (e.g., Chrome, Edge, Opera, Firefox).

## 💻 Technologies Used

*   HTML5
*   CSS3 (Flexbox, Grid, Custom Properties, Animations)
*   JavaScript (ES6+ Classes, `async/await`, Web MIDI API, Web Audio API, `requestAnimationFrame`)

## Future Development Ideas (Not Implemented)

*   More complex rhythmic patterns and note durations.
*   Background music tracks.
*   User accounts and high score leaderboards.
*   More advanced sound synthesis or sample-based audio.
*   Tutorial levels for absolute beginners.
*   Customizable keyboard mappings.