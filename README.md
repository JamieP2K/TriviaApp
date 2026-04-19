# TriviaBlaze

A fast-paced trivia quiz app with solo and real-time multiplayer modes. Questions are pulled from the [Open Trivia Database](https://opentdb.com/) across dozens of categories and difficulty levels.

**Live app:** https://jamiep2k.github.io/TriviaApp/

---

## Features

- **Singleplayer** — customise category, difficulty, question count, and an optional countdown timer
- **Multiplayer** — host or join a room with up to 6 players using a 6-character room code
- Real-time score sync and a final leaderboard
- Automatic room cleanup when the host leaves or disconnects
- Works entirely in the browser — no install required

---

## How to Use

### Singleplayer

1. Open the app and configure your quiz settings (category, difficulty, number of questions, time limit)
2. Press **Start Quiz**
3. Select an answer for each question — correct answers are revealed immediately
4. View your final score and a full answer review at the end

### Multiplayer

**Hosting a game:**
1. Press **Multiplayer** on the home screen
2. Press **Host** and enter your display name
3. Configure the quiz settings in the lobby
4. Share the 6-character room code with other players
5. Press **Start Game** once everyone has joined

**Joining a game:**
1. Press **Multiplayer** → **Join** and enter your display name
2. Enter the room code provided by the host
3. Wait in the lobby until the host starts the game

Once the game starts, all players answer questions simultaneously. The next question advances automatically once everyone has answered (or the timer runs out). Final standings are shown on a leaderboard at the end.

---

## Self-Hosting

The app is plain HTML/CSS/JS with no build step — just serve the three files.

**To set up multiplayer you need a Firebase project:**

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project
2. Enable **Realtime Database** (choose a region) and **Anonymous Authentication**
3. Copy your Firebase config and paste it into the `firebaseConfig` block near the bottom of `index.html`
4. Set your Realtime Database rules to the following:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null && (!data.exists() || data.child('hostId').val() === auth.uid)",
        "players": {
          "$uid": {
            ".write": "auth != null && (auth.uid === $uid || root.child('rooms').child($roomCode).child('hostId').val() === auth.uid)"
          }
        }
      }
    }
  }
}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Questions API | [Open Trivia Database](https://opentdb.com/) |
| Multiplayer | [Firebase Realtime Database](https://firebase.google.com/products/realtime-database) |
| Auth | Firebase Anonymous Authentication |
| Hosting | GitHub Pages |