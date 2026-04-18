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
    select: v => { cfg.cat = v; document.getElementById('cat-display').textContent = v === 'any' ? 'Any' : (categories.find(c => String(c.id) === v)||{name:'Any'}).name; }
  },
  difficulty: {
    title: 'Difficulty',
    options: () => [{val:'any',label:'Any'},{val:'easy',label:'Easy'},{val:'medium',label:'Medium'},{val:'hard',label:'Hard'}],
    current: () => cfg.diff,
    select: v => { cfg.diff = v; document.getElementById('diff-display').textContent = v === 'any' ? 'Any' : v[0].toUpperCase()+v.slice(1); }
  },
  questions: {
    title: 'Number of Questions',
    options: () => [5,10,15,20].map(n => ({ val: n, label: `${n} Questions` })),
    current: () => cfg.num,
    select: v => { cfg.num = v; document.getElementById('num-display').textContent = v; }
  },
  timerDur: {
    title: 'Time Limit',
    options: () => [{val:0,label:'Off'},{val:15,label:'15 seconds'},{val:30,label:'30 seconds'},{val:60,label:'60 seconds'}],
    current: () => cfg.timerDur,
    select: v => { cfg.timerDur = v; cfg.timerOn = v > 0; document.getElementById('timerDur-display').textContent = v === 0 ? 'Off' : `${v} seconds`; }
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
    b.classList.add(b.innerHTML === q.correct ? 'reveal-correct' : 'timed-out');
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
  document.getElementById('q-text').innerHTML = q.q;
  const opts = document.getElementById('options');
  opts.innerHTML = '';
  q.options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'opt-btn'; b.innerHTML = opt;
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
    if (b.innerHTML === correct) b.classList.add(b === btn && isCorrect ? 'correct' : 'reveal-correct');
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
