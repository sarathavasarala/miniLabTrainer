# 🎹 MIDI Keyboard Practice Game

A fun and interactive game to help you practice your MIDI keyboard timing and accuracy. Notes fall from the top, and you must press the corresponding key on your MIDI keyboard or computer keyboard when the note reaches the hit zone.

## Features

*   **MIDI Device Integration:** Connect your MIDI keyboard (optimized for C3-C5 range, e.g., Arturia MiniLab 3).
*   **Computer Keyboard Fallback:** Play using your computer keyboard (A, S, D, F, G, H, J for white keys C4-B4; W, E, T, Y, U for black keys C#4-A#4).
*   **Falling Bars Gameplay:** Notes appear as falling bars, aligning with virtual keyboard keys.
*   **Scoring System:** Points awarded based on timing accuracy.
*   **Combo Multiplier:** String together successful hits for a higher score.
*   **Lives System:** Start with 3 lives; lose a life for missed notes.
*   **Visual Feedback:**
    *   Notes change color when hit or missed.
    *   Virtual keyboard keys light up when pressed.
    *   Particle effects on successful hits.
*   **Audio Feedback:** Synthesized piano sounds for pressed notes.
*   **Adjustable Volume:** Control the game's audio volume.
*   **Responsive Design:** Adapts to different screen sizes.

## How to Play

1.  **Setup:**
    *   **MIDI Keyboard (Recommended):**
        *   Connect your MIDI keyboard to your computer.
        *   Click the "Connect MIDI" button in the game.
        *   Allow MIDI access if prompted by your browser. The status message will confirm connection.
    *   **Computer Keyboard:**
        *   You can also play using your computer keyboard. The following keys map to the C4 octave:
            *   White Keys (C4-B4): `A`, `S`, `D`, `F`, `G`, `H`, `J`
            *   Black Keys (C#4-A#4): `W`, `E`, `T`, `Y`, `U`

2.  **Gameplay:**
    *   Click "Start Game".
    *   Bars representing notes will begin to fall from the top of the screen, corresponding to different keys on the virtual keyboard.
    *   When the bottom edge of a falling bar aligns with the top edge of its corresponding key on the virtual keyboard, press the correct key on your MIDI or computer keyboard.
    *   Your score and combo will increase with accurate hits.
    *   If a bar passes the alignment point for its key without being hit correctly, you lose a life.
    *   The game ends when you run out of lives.

3.  **Controls:**
    *   **Connect MIDI:** Connects to your MIDI device.
    *   **Start Game:** Begins the game.
    *   **Pause/Resume:** Pauses or resumes the current game.
    *   **Reset:** Resets the game to its initial state.
    *   **Volume Slider:** Adjusts the game's sound volume.

## Running the Game

1.  Clone or download this repository.
2.  Open the `index.html` file in a modern web browser that supports the Web MIDI API and Web Audio API (e.g., Chrome, Edge, Opera).

## Technologies Used

*   HTML5
*   CSS3
*   JavaScript (ES6+)
*   Web MIDI API (for MIDI keyboard input)
*   Web Audio API (for sound synthesis)
