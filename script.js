const cfg = { cat: 'any', diff: 'any', num: 10, timerOn: false, timerDur: 0 };
let categories = [], questions = [], current = 0, score = 0, history = [], rafId = null;

function decode(s) { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }
function shuffle(a) { for (let i = a.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }

async function loadCategories() {
  try {
    const r = await fetch('https://opentdb.com/api_category.php');
    const d = await r.json();
    categories = d.trivia_categories || [];
  } catch(e) { categories = []; }
}
loadCategories();

const SHEETS = {
  category: {
    title: 'Category',
    options: () => [{ val:'any', label:'Any Category' }, ...categories.map(c => ({ val: String(c.id), label: c.name }))],
    current: () => cfg.cat,
    select: v => { cfg.cat = v; const label = v === 'any' ? 'Any' : (categories.find(c => String(c.id) === v)||{name:'Any'}).name; document.getElementById('cat-display').textContent = label; const mpEl = document.getElementById('cat-display-mp'); if (mpEl) mpEl.textContent = label; }
  },
  difficulty: {
    title: 'Difficulty',
    options: () => [{val:'any',label:'Any'},{val:'easy',label:'Easy'},{val:'medium',label:'Medium'},{val:'hard',label:'Hard'}],
    current: () => cfg.diff,
    select: v => { cfg.diff = v; const label = v === 'any' ? 'Any' : v[0].toUpperCase()+v.slice(1); document.getElementById('diff-display').textContent = label; const mpEl = document.getElementById('diff-display-mp'); if (mpEl) mpEl.textContent = label; }
  },
  questions: {
    title: 'Number of Questions',
    options: () => [5,10,15,20].map(n => ({ val: n, label: `${n} Questions` })),
    current: () => cfg.num,
    select: v => { cfg.num = v; document.getElementById('num-display').textContent = v; const mpEl = document.getElementById('num-display-mp'); if (mpEl) mpEl.textContent = v; }
  },
  timerDur: {
    title: 'Time Limit',
    options: () => [{val:0,label:'Off'},{val:15,label:'15 seconds'},{val:30,label:'30 seconds'},{val:60,label:'60 seconds'}],
    current: () => cfg.timerDur,
    select: v => { cfg.timerDur = v; cfg.timerOn = v > 0; const label = v === 0 ? 'Off' : `${v} seconds`; document.getElementById('timerDur-display').textContent = label; const mpEl = document.getElementById('timerDur-display-mp'); if (mpEl) mpEl.textContent = label; }
  }
};

function openSheet(name) {
  const s = SHEETS[name];
  document.getElementById('sheet-title').textContent = s.title;
  const container = document.getElementById('sheet-options');
  container.innerHTML = '';
  s.options().forEach(o => {
    const div = document.createElement('div');
    const isSel = String(s.current()) === String(o.val);
    div.className = 'sheet-option' + (isSel ? ' selected' : '');
    div.textContent = o.label;
    div.onclick = () => { s.select(o.val); closeSheet(); };
    container.appendChild(div);
  });
  document.getElementById('overlay').style.display = 'flex';
}
function closeSheet() { document.getElementById('overlay').style.display = 'none'; }

async function startQuiz() {
  const btn = document.getElementById('start-btn'), err = document.getElementById('setup-err');
  err.style.display = 'none'; btn.disabled = true; btn.textContent = 'Loading…';

  let url = `https://opentdb.com/api.php?amount=${cfg.num}&type=multiple`;
  if (cfg.cat !== 'any') url += `&category=${cfg.cat}`;
  if (cfg.diff !== 'any') url += `&difficulty=${cfg.diff}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.results || data.results.length === 0) throw new Error('No questions returned. Try a different category or difficulty.');
    questions = data.results.map(q => ({
      q: decode(q.question),
      correct: decode(q.correct_answer),
      options: shuffle([decode(q.correct_answer), ...q.incorrect_answers.map(decode)]),
      category: decode(q.category)
    }));
    current = 0; score = 0; history = [];
    show('quiz-screen');
    renderQuestion();
  } catch(e) {
    err.textContent = e.message || 'Failed to load questions. Please try again.';
    err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Start Quiz';
  }
}

function startTimer() {
  stopTimer();
  const wrap = document.getElementById('timer-wrap');
  const fill = document.getElementById('timer-fill');
  const label = document.getElementById('timer-label');
  wrap.classList.add('visible');
  const circumference = 75.4;
  const duration = cfg.timerDur * 1000, start = performance.now();
  function frame(now) {
    const pct = Math.max(0, 1 - (now - start) / duration);
    fill.style.strokeDashoffset = circumference * (1 - pct);
    fill.style.stroke = pct > 0.5 ? 'var(--green)' : pct > 0.25 ? '#f0a500' : 'var(--red)';
    label.textContent = Math.ceil(pct * cfg.timerDur);
    if (pct <= 0) { stopTimer(); timeOut(); return; }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);
}

function stopTimer() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  document.getElementById('timer-wrap').classList.remove('visible');
}

function timeOut() {
  const q = questions[current];
  history.push({ q: q.q, chosen: null, correct: q.correct, isCorrect: false, timedOut: true });
  document.querySelectorAll('.opt-btn').forEach(b => {
    b.disabled = true;
    b.classList.add(b.dataset.answer === q.correct ? 'reveal-correct' : 'timed-out');
  });
  const nb = document.getElementById('next-btn');
  nb.textContent = current === questions.length-1 ? 'See Results' : 'Next Question →';
  nb.classList.add('show');
}

function renderQuestion() {
  const q = questions[current], total = questions.length;
  document.getElementById('prog').style.width = `${(current/total)*100}%`;
  document.getElementById('q-num').textContent = `Question ${current+1} of ${total}`;
  document.getElementById('q-score').textContent = score;
  document.getElementById('q-cat').textContent = q.category;
  document.getElementById('q-text').textContent = q.q;
  const opts = document.getElementById('options');
  opts.innerHTML = '';
  q.options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'opt-btn';
    b.textContent = opt;
    b.dataset.answer = opt;
    b.onclick = () => selectAnswer(b, opt, q.correct);
    opts.appendChild(b);
  });
  document.getElementById('next-btn').className = 'next-btn';
  if (cfg.timerOn) startTimer(); else stopTimer();
}

function selectAnswer(btn, chosen, correct) {
  stopTimer();
  const isCorrect = chosen === correct;
  if (isCorrect) score++;
  history.push({ q: questions[current].q, chosen, correct, isCorrect, timedOut: false });
  document.querySelectorAll('.opt-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.answer === correct) b.classList.add(b === btn && isCorrect ? 'correct' : 'reveal-correct');
    if (b === btn && !isCorrect) b.classList.add('wrong');
  });
  if (isCorrect) { btn.classList.remove('reveal-correct'); btn.classList.add('correct'); }
  document.getElementById('q-score').textContent = score;
  const nb = document.getElementById('next-btn');
  nb.textContent = current === questions.length-1 ? 'See Results' : 'Next Question →';
  nb.classList.add('show');
}

function nextQuestion() {
  current++;
  current >= questions.length ? showResults() : renderQuestion();
}

function showResults() {
  stopTimer();
  show('results-screen');
  const total = questions.length, pct = Math.round((score/total)*100);
  document.getElementById('final-score').textContent = score;
  document.getElementById('score-denom').textContent = `/${total}`;
  document.getElementById('score-pct').textContent = `${pct}% correct`;
  const verdicts = [[90,'Outstanding'],[70,'Great job'],[50,'Not bad'],[0,'Better luck next time']];
  document.getElementById('verdict').textContent = verdicts.find(([t]) => pct >= t)[1];
  const list = document.getElementById('review-list');
  list.innerHTML = '';
  history.forEach((h,i) => {
    const div = document.createElement('div'); div.className = 'review-item';
    let tag, ans;
    if (h.timedOut) { tag = `<span class="tag tag-timeout">⏱ Time Out</span>`; ans = `Correct: <strong>${h.correct}</strong>`; }
    else if (h.isCorrect) { tag = `<span class="tag tag-correct">✓ Correct</span>`; ans = `Correct: <strong>${h.correct}</strong>`; }
    else { tag = `<span class="tag tag-wrong">✗ Wrong</span>`; ans = `Your answer: <em>${h.chosen}</em> &nbsp;·&nbsp; Correct: <strong>${h.correct}</strong>`; }
    div.innerHTML = `<p class="review-q"><strong>Q${i+1}:</strong> ${h.q}</p><p class="review-ans">${tag}${ans}</p>`;
    list.appendChild(div);
  });
}

function reset() {
  stopTimer();
  show('start-screen');
  const btn = document.getElementById('start-btn');
  btn.disabled = false; btn.textContent = 'Start Quiz';
}

/* =========================================================
   MULTIPLAYER
   ========================================================= */

const db = () => firebase.database();

const mp = {
  roomCode: null,
  playerId: null,
  playerName: null,
  isHost: false,
  hostId: null,
  nameDestination: null,
  questions: [],
  currentQ: 0,
  mpScore: 0,
  mpRafId: null,
  answered: false,
  listeners: [],
  revealTimeout: null,
};

function mpEnsureAuth() {
  return new Promise((resolve, reject) => {
    const user = firebase.auth().currentUser;
    if (user) { resolve(user.uid); return; }
    firebase.auth().signInAnonymously().then(c => resolve(c.user.uid)).catch(reject);
  });
}

function mpEscape(s) {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function mpGenerateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function mpInitials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

// ---- Navigation ----

function mpGoName(destination) {
  mp.nameDestination = destination;
  document.getElementById('mp-name-input').value = '';
  document.getElementById('mp-name-err').style.display = 'none';
  show('mp-name');
  setTimeout(() => document.getElementById('mp-name-input').focus(), 100);
}

async function mpConfirmName() {
  const val = document.getElementById('mp-name-input').value.trim();
  const err = document.getElementById('mp-name-err');
  const btn = document.getElementById('mp-name-btn');
  if (!val) { err.textContent = 'Please enter a name.'; err.style.display = 'block'; return; }
  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    mp.playerId = await mpEnsureAuth();
  } catch(e) {
    err.textContent = 'Could not authenticate. Check your connection and try again.';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Continue';
    return;
  }
  btn.disabled = false; btn.textContent = 'Continue';
  mp.playerName = val;
  if (mp.nameDestination === 'host') {
    mpCreateRoom();
  } else {
    document.getElementById('mp-join-code').value = '';
    document.getElementById('mp-join-err').style.display = 'none';
    show('mp-join');
    setTimeout(() => document.getElementById('mp-join-code').focus(), 100);
  }
}

// ---- Host ----

async function mpCreateRoom() {
  const btn = document.getElementById('mp-name-btn');
  const err = document.getElementById('mp-name-err');
  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Creating…';

  const fbGet = (ref) => Promise.race([
    ref.get(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timed out. Check your databaseURL in the firebaseConfig inside index.html — it must match exactly what the Firebase console shows (e.g. https://YOUR_PROJECT-default-rtdb.firebaseio.com or https://YOUR_PROJECT-default-rtdb.REGION.firebasedatabase.app).')), 8000))
  ]);

  try {
    let code;
    for (let attempts = 0; attempts < 10; attempts++) {
      code = mpGenerateCode();
      const snap = await fbGet(db().ref(`rooms/${code}`));
      if (!snap.exists()) break;
      code = null;
    }
    if (!code) throw new Error('Could not generate a unique room code. Please try again.');

    mp.roomCode = code;
    mp.isHost = true;

    const playerEntry = { name: mp.playerName, score: 0, connected: true, answers: {} };
    await db().ref(`rooms/${code}`).set({
      status: 'lobby',
      hostId: mp.playerId,
      settings: { cat: cfg.cat, diff: cfg.diff, num: cfg.num, timerOn: cfg.timerOn, timerDur: cfg.timerDur },
      players: { [mp.playerId]: playerEntry }
    });

    db().ref(`rooms/${code}/players/${mp.playerId}/connected`).onDisconnect().set(false);
    db().ref(`rooms/${code}`).onDisconnect().remove();

    document.getElementById('host-room-code').textContent = code;
    btn.disabled = false; btn.textContent = 'Continue';
    const startBtn = document.getElementById('mp-start-btn');
    startBtn.disabled = false; startBtn.textContent = 'Start Game';
    document.getElementById('mp-host-err').style.display = 'none';
    show('mp-host');
    mpListenPlayers();
    mpListenStatus();
  } catch(e) {
    err.textContent = e.message || 'Failed to connect to Firebase. Check your config and that Realtime Database is enabled.';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Continue';
    mp.roomCode = null; mp.isHost = false;
  }
}

function mpListenPlayers() {
  const ref = db().ref(`rooms/${mp.roomCode}/players`);
  const handle = ref.on('value', snap => {
    const players = snap.val() || {};
    if (mp.isHost) {
      Object.entries(players).forEach(([id, p]) => {
        if (!p.connected && id !== mp.playerId) {
          db().ref(`rooms/${mp.roomCode}/players/${id}`).remove();
        }
      });
    }
    const hostList = document.getElementById('host-player-list');
    if (hostList) mpRenderPlayerList(hostList, players);
    const lobbyList = document.getElementById('lobby-player-list');
    if (lobbyList) mpRenderPlayerList(lobbyList, players);
    if (document.getElementById('mp-quiz').classList.contains('active')) {
      mpUpdateAnswerTags(players);
      if (mp.isHost) mpCheckAllAnswered(players);
    }
  });
  mp.listeners.push({ ref, handle, event: 'value' });
}

function mpRenderPlayerList(container, players) {
  container.innerHTML = '';
  Object.entries(players).filter(([,p]) => p.connected !== false).forEach(([id, p]) => {
    const div = document.createElement('div');
    div.className = 'mp-player-item';
    const avatar = document.createElement('div');
    avatar.className = 'mp-player-avatar';
    avatar.textContent = mpInitials(p.name);
    const nameSpan = document.createElement('span');
    nameSpan.className = 'mp-player-name';
    nameSpan.textContent = p.name;
    div.appendChild(avatar);
    div.appendChild(nameSpan);
    if (id === mp.playerId) {
      const badge = document.createElement('span');
      badge.className = 'mp-player-badge';
      badge.textContent = 'You';
      div.appendChild(badge);
    }
    container.appendChild(div);
  });
}

function mpListenStatus() {
  let quizStarted = false;
  let leaderboardShown = false;
  const ref = db().ref(`rooms/${mp.roomCode}/status`);
  const handle = ref.on('value', snap => {
    const status = snap.val();
    if (status === 'playing' && !quizStarted) { quizStarted = true; mpStartClientQuiz(); }
    if (status === 'results' && !leaderboardShown) { leaderboardShown = true; mpShowLeaderboard(); }
  });
  mp.listeners.push({ ref, handle, event: 'value' });
}

function mpListenHostConnection() {
  const ref = db().ref(`rooms/${mp.roomCode}/players/${mp.hostId}/connected`);
  const handle = ref.on('value', snap => {
    if (snap.val() === false) {
      const onLobby = document.getElementById('mp-lobby').classList.contains('active');
      const onQuiz = document.getElementById('mp-quiz').classList.contains('active');
      if (onLobby || onQuiz) {
        document.getElementById('mp-disconnected').classList.add('visible');
      }
    }
  });
  mp.listeners.push({ ref, handle, event: 'value' });
}

async function mpStartGame() {
  const btn = document.getElementById('mp-start-btn');
  const err = document.getElementById('mp-host-err');
  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Loading…';

  let url = `https://opentdb.com/api.php?amount=${cfg.num}&type=multiple`;
  if (cfg.cat !== 'any') url += `&category=${cfg.cat}`;
  if (cfg.diff !== 'any') url += `&difficulty=${cfg.diff}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.results || data.results.length === 0) throw new Error('No questions returned. Try different settings.');
    const qs = data.results.map(q => ({
      q: decode(q.question),
      correct: decode(q.correct_answer),
      options: shuffle([decode(q.correct_answer), ...q.incorrect_answers.map(decode)]),
      category: decode(q.category)
    }));

    await db().ref(`rooms/${mp.roomCode}`).update({
      questions: qs,
      currentQuestion: 0,
      settings: { cat: cfg.cat, diff: cfg.diff, num: cfg.num, timerOn: cfg.timerOn, timerDur: cfg.timerDur },
      status: 'playing'
    });
  } catch(e) {
    err.textContent = e.message || 'Failed to load questions.';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Start Game';
  }
}

// ---- Join ----

async function mpJoinRoom() {
  const code = document.getElementById('mp-join-code').value.trim().toUpperCase();
  const err = document.getElementById('mp-join-err');
  const btn = document.getElementById('mp-join-btn');
  err.style.display = 'none';

  if (code.length !== 6) { err.textContent = 'Enter a 6-character room code.'; err.style.display = 'block'; return; }

  btn.disabled = true; btn.textContent = 'Joining…';

  try {
    const snap = await db().ref(`rooms/${code}`).get();
    if (!snap.exists()) throw new Error('Room not found. Check the code and try again.');
    const room = snap.val();
    if (room.status !== 'lobby') throw new Error('This game has already started or ended.');
    const playerCount = Object.values(room.players || {}).filter(p => p.connected !== false).length;
    if (playerCount >= 6) throw new Error('This room is full (6 players max).');

    mp.roomCode = code;
    mp.isHost = false;
    mp.hostId = room.hostId;

    await db().ref(`rooms/${code}/players/${mp.playerId}`).set({
      name: mp.playerName, score: 0, connected: true, answers: {}
    });

    db().ref(`rooms/${code}/players/${mp.playerId}/connected`).onDisconnect().set(false);

    document.getElementById('lobby-room-code').textContent = code;
    btn.disabled = false; btn.textContent = 'Join';
    show('mp-lobby');
    mpListenPlayers();
    mpListenStatus();
    mpListenHostConnection();
  } catch(e) {
    err.textContent = e.message || 'Failed to join. Please try again.';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Join';
  }
}

// ---- Quiz (shared) ----

function mpStartClientQuiz() {
  mp.mpScore = 0;

  db().ref(`rooms/${mp.roomCode}`).get().then(snap => {
    const room = snap.val();
    mp.questions = room.questions || [];
    // Apply host settings locally for timer
    const s = room.settings || {};
    cfg.timerOn = s.timerOn || false;
    cfg.timerDur = s.timerDur || 0;

    show('mp-quiz');
    mpRenderMpQuestion(room.currentQuestion || 0);
    mpListenCurrentQuestion();
  });
}

function mpListenCurrentQuestion() {
  const ref = db().ref(`rooms/${mp.roomCode}/currentQuestion`);
  const handle = ref.on('value', snap => {
    const idx = snap.val();
    if (idx === null) return;
    if (idx !== mp.currentQ) {
      mp.currentQ = idx;
      mpRenderMpQuestion(idx);
    }
  });
  mp.listeners.push({ ref, handle, event: 'value' });
}

function mpRenderMpQuestion(idx) {
  const q = mp.questions[idx];
  if (!q) return;
  mp.answered = false;
  mp.currentQ = idx;

  const total = mp.questions.length;
  document.getElementById('mp-prog').style.width = `${(idx / total) * 100}%`;
  document.getElementById('mp-q-num').textContent = `Question ${idx + 1} of ${total}`;
  document.getElementById('mp-q-score').textContent = mp.mpScore;
  document.getElementById('mp-q-cat').textContent = q.category;
  document.getElementById('mp-q-text').textContent = q.q;
  document.getElementById('mp-waiting-others').style.display = 'none';

  const opts = document.getElementById('mp-options');
  opts.innerHTML = '';
  q.options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'opt-btn';
    b.textContent = opt;
    b.dataset.answer = opt;
    b.onclick = () => mpSelectAnswer(b, opt, q.correct, idx);
    opts.appendChild(b);
  });

  mpStopTimer();
  if (cfg.timerOn) mpStartTimer(idx);
}

function mpSelectAnswer(btn, chosen, correct, qIdx) {
  if (mp.answered) return;
  mp.answered = true;
  mpStopTimer();

  const isCorrect = chosen === correct;
  if (isCorrect) mp.mpScore++;
  document.getElementById('mp-q-score').textContent = mp.mpScore;

  document.querySelectorAll('#mp-options .opt-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.answer === correct) b.classList.add(b === btn && isCorrect ? 'correct' : 'reveal-correct');
    if (b === btn && !isCorrect) b.classList.add('wrong');
  });
  if (isCorrect) { btn.classList.remove('reveal-correct'); btn.classList.add('correct'); }

  db().ref(`rooms/${mp.roomCode}/players/${mp.playerId}/score`).set(mp.mpScore);
  db().ref(`rooms/${mp.roomCode}/players/${mp.playerId}/answers/${qIdx}`).set(chosen);

  document.getElementById('mp-waiting-others').style.display = 'flex';
}

function mpHandleTimeout(qIdx) {
  if (mp.answered) return;
  mp.answered = true;

  document.querySelectorAll('#mp-options .opt-btn').forEach(b => {
    b.disabled = true;
    const q = mp.questions[qIdx];
    b.classList.add(b.dataset.answer === q.correct ? 'reveal-correct' : 'timed-out');
  });

  db().ref(`rooms/${mp.roomCode}/players/${mp.playerId}/answers/${qIdx}`).set('__TIMEOUT__');
  document.getElementById('mp-waiting-others').style.display = 'flex';
}

function mpCheckAllAnswered(players) {
  if (!mp.isHost) return;
  const connected = Object.entries(players).filter(([,p]) => p.connected !== false);
  if (connected.length === 0) return;
  const allAnswered = connected.every(([id, p]) => p.answers && p.answers[mp.currentQ] !== undefined);
  if (!allAnswered) return;

  // Debounce: only fire once per question
  if (mp.revealTimeout) return;
  mp.revealTimeout = setTimeout(() => {
    mp.revealTimeout = null;
    const nextIdx = mp.currentQ + 1;
    if (nextIdx >= mp.questions.length) {
      db().ref(`rooms/${mp.roomCode}/status`).set('results');
    } else {
      db().ref(`rooms/${mp.roomCode}/currentQuestion`).set(nextIdx);
    }
  }, 3000);
}

function mpUpdateAnswerTags(players) {
  const qIdx = mp.currentQ;
  const connected = Object.entries(players).filter(([id, p]) => p.connected !== false && id !== mp.playerId);
  const allAnswered = Object.entries(players).filter(([,p]) => p.connected !== false)
    .every(([id, p]) => p.answers && p.answers[qIdx] !== undefined);

  if (!allAnswered) return;

  const opts = document.querySelectorAll('#mp-options .opt-btn');
  opts.forEach(b => {
    let tags = b.querySelector('.player-tags');
    if (!tags) { tags = document.createElement('div'); tags.className = 'player-tags'; b.appendChild(tags); }
    tags.innerHTML = '';
    connected.forEach(([id, p]) => {
      if (p.answers && p.answers[qIdx] === b.dataset.answer) {
        const tag = document.createElement('span');
        tag.className = 'player-tag';
        tag.textContent = p.name;
        tags.appendChild(tag);
      }
    });
  });
  document.getElementById('mp-waiting-others').style.display = 'none';
}

// ---- MP Timer ----

function mpStartTimer(qIdx) {
  mpStopTimer();
  const wrap = document.getElementById('mp-timer-wrap');
  const fill = document.getElementById('mp-timer-fill');
  const label = document.getElementById('mp-timer-label');
  wrap.classList.add('visible');
  const circumference = 75.4;
  const duration = cfg.timerDur * 1000, start = performance.now();
  function frame(now) {
    const pct = Math.max(0, 1 - (now - start) / duration);
    fill.style.strokeDashoffset = circumference * (1 - pct);
    fill.style.stroke = pct > 0.5 ? 'var(--green)' : pct > 0.25 ? '#f0a500' : 'var(--red)';
    label.textContent = Math.ceil(pct * cfg.timerDur);
    if (pct <= 0) { mpStopTimer(); mpHandleTimeout(qIdx); return; }
    mp.mpRafId = requestAnimationFrame(frame);
  }
  mp.mpRafId = requestAnimationFrame(frame);
}

function mpStopTimer() {
  if (mp.mpRafId) { cancelAnimationFrame(mp.mpRafId); mp.mpRafId = null; }
  const wrap = document.getElementById('mp-timer-wrap');
  if (wrap) wrap.classList.remove('visible');
}

// ---- Leaderboard ----

function mpShowLeaderboard() {
  mpStopTimer();
  db().ref(`rooms/${mp.roomCode}/players`).get().then(snap => {
    const players = snap.val() || {};
    const entries = Object.entries(players)
      .map(([id, p]) => ({ id, name: p.name, score: Number(p.score) || 0 }))
      .sort((a, b) => b.score - a.score);

    // Dense ranking: if tied, same rank; next rank is consecutive
    let rank = 1;
    entries.forEach((e, i) => {
      if (i > 0 && entries[i].score < entries[i - 1].score) rank = i + 1;
      e.rank = rank;
    });

    const list = document.getElementById('mp-lb-list');
    list.innerHTML = '';
    entries.forEach(e => {
      const div = document.createElement('div');
      let rankClass = '';
      if (e.rank === 1) rankClass = 'mp-lb-entry--1st';
      else if (e.rank === 2) rankClass = 'mp-lb-entry--2nd';
      else if (e.rank === 3) rankClass = 'mp-lb-entry--3rd';
      const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`;
      const isMe = e.id === mp.playerId;
      div.className = `mp-lb-entry ${rankClass}`;
      div.innerHTML = `<div class="mp-lb-rank">${medal}</div>
        <div class="mp-lb-name">${mpEscape(e.name)}${isMe ? '<span class="mp-lb-me">You</span>' : ''}</div>
        <div class="mp-lb-score">${e.score}</div>`;
      list.appendChild(div);
    });

    show('mp-leaderboard');
    // Mark room closed so no one can join late
    if (mp.isHost) db().ref(`rooms/${mp.roomCode}/status`).set('closed');
  });
}

// ---- Cleanup ----

function mpLeave() {
  mpStopTimer();
  if (mp.revealTimeout) { clearTimeout(mp.revealTimeout); mp.revealTimeout = null; }
  mp.listeners.forEach(({ ref, handle, event }) => ref.off(event, handle));
  mp.listeners = [];
  if (mp.roomCode && mp.playerId) {
    if (mp.isHost) {
      db().ref(`rooms/${mp.roomCode}`).remove();
    } else {
      db().ref(`rooms/${mp.roomCode}/players/${mp.playerId}/connected`).set(false);
    }
  }
  document.getElementById('mp-disconnected').classList.remove('visible');
  // Reset mp state
  Object.assign(mp, {
    roomCode: null, playerId: null, playerName: null, isHost: false, hostId: null,
    nameDestination: null, questions: [], currentQ: 0, mpScore: 0,
    mpRafId: null, answered: false, listeners: [], revealTimeout: null
  });
  show('start-screen');
}
