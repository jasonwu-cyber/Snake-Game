const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const statusEl = document.getElementById('status');
const statusDescEl = document.getElementById('status-desc');
const startBtn = document.getElementById('start-btn');

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 340;
const GRID_SIZE = 20;

canvas.style.width = `${LOGICAL_WIDTH}px`;
canvas.style.height = `${LOGICAL_HEIGHT}px`;

const dpr = window.devicePixelRatio || 1;
canvas.width = LOGICAL_WIDTH * dpr;
canvas.height = LOGICAL_HEIGHT * dpr;
ctx.scale(dpr, dpr);

const COLS = LOGICAL_WIDTH / GRID_SIZE; // 40
const ROWS = LOGICAL_HEIGHT / GRID_SIZE; // 17

let snake = [];
let dx = 1;
let dy = 0;
let food = { x: 0, y: 0 };
let score = 0;
let highScore = localStorage.getItem('snakeProtocolHighScore') || 0;
let gameLoop;
let isPlaying = false;
let moveQueue = [];

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'move') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'die') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

highScoreEl.textContent = String(highScore).padStart(3, '0');

function resetGame() {
    snake = [
        { x: 10, y: 8 },
        { x: 9, y: 8 },
        { x: 8, y: 8 }
    ];
    dx = 1;
    dy = 0;
    score = 0;
    moveQueue = [];
    scoreEl.textContent = '000';
    spawnFood();
    updateStatus('ACTIVE', 'ROUTING IN PROGRESS', 'status-active');
}

function spawnFood() {
    let valid = false;
    while (!valid) {
        food.x = Math.floor(Math.random() * COLS);
        food.y = Math.floor(Math.random() * ROWS);
        valid = true;
        for (let segment of snake) {
            if (segment.x === food.x && segment.y === food.y) {
                valid = false;
                break;
            }
        }
    }
}

function updateStatus(text, desc, className) {
    statusEl.textContent = text;
    statusDescEl.textContent = desc;
    statusEl.className = 'data-value status-text ' + (className || '');
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, LOGICAL_HEIGHT);
        ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(LOGICAL_WIDTH, i * GRID_SIZE);
        ctx.stroke();
    }
}

function draw() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawGrid();
    
    // Draw Food
    const fx = food.x * GRID_SIZE + GRID_SIZE / 2;
    const fy = food.y * GRID_SIZE + GRID_SIZE / 2;
    
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(fx, fy, GRID_SIZE/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(fx, fy, GRID_SIZE/4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Snake
    if (snake.length > 0) {
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = GRID_SIZE * 0.6;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        
        ctx.beginPath();
        ctx.moveTo(snake[0].x * GRID_SIZE + GRID_SIZE/2, snake[0].y * GRID_SIZE + GRID_SIZE/2);
        for (let i = 1; i < snake.length; i++) {
            ctx.lineTo(snake[i].x * GRID_SIZE + GRID_SIZE/2, snake[i].y * GRID_SIZE + GRID_SIZE/2);
        }
        ctx.stroke();

        ctx.fillStyle = '#1E3A8A';
        for (let i = 1; i < snake.length; i++) {
            ctx.beginPath();
            ctx.arc(snake[i].x * GRID_SIZE + GRID_SIZE/2, snake[i].y * GRID_SIZE + GRID_SIZE/2, GRID_SIZE * 0.2, 0, Math.PI*2);
            ctx.fill();
        }

        const hx = snake[0].x * GRID_SIZE;
        const hy = snake[0].y * GRID_SIZE;
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(hx + 2, hy + 2, GRID_SIZE - 4, GRID_SIZE - 4);
        
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 2;
        ctx.strokeRect(hx + 4, hy + 4, GRID_SIZE - 8, GRID_SIZE - 8);
    }
}

let lastTime = 0;
const TICK_RATE = 100;

function gameStep(timestamp) {
    if (!isPlaying) return;
    
    if (timestamp - lastTime > TICK_RATE) {
        lastTime = timestamp;
        
        if (moveQueue.length > 0) {
            const move = moveQueue.shift();
            dx = move.dx;
            dy = move.dy;
        }
        
        const head = { x: snake[0].x + dx, y: snake[0].y + dy };
        
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
            gameOver();
            return;
        }
        
        for (let i = 0; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                gameOver();
                return;
            }
        }
        
        snake.unshift(head);
        
        if (head.x === food.x && head.y === food.y) {
            score++;
            scoreEl.textContent = String(score).padStart(3, '0');
            playSound('eat');
            spawnFood();
        } else {
            snake.pop();
        }
        
        draw();
    }
    
    gameLoop = requestAnimationFrame(gameStep);
}

function gameOver() {
    isPlaying = false;
    playSound('die');
    updateStatus('ERROR', 'CONNECTION LOST', 'status-danger');
    startBtn.textContent = 'REBOOT_SYSTEM';
    startBtn.disabled = false;
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeProtocolHighScore', highScore);
        highScoreEl.textContent = String(highScore).padStart(3, '0');
    }

    ctx.fillStyle = 'rgba(225, 29, 72, 0.1)';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    ctx.fillStyle = '#E11D48';
    ctx.font = 'bold 30px "Share Tech Mono"';
    ctx.textAlign = 'center';
    ctx.fillText('SIGNAL LOST: ROUTING FAILED', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
}

window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
    
    if (!isPlaying) return;

    let lastMove = moveQueue.length > 0 ? moveQueue[moveQueue.length - 1] : {dx, dy};
    
    let newMove = null;
    if (e.key === 'ArrowUp' && lastMove.dy !== 1) newMove = { dx: 0, dy: -1 };
    if (e.key === 'ArrowDown' && lastMove.dy !== -1) newMove = { dx: 0, dy: 1 };
    if (e.key === 'ArrowLeft' && lastMove.dx !== 1) newMove = { dx: -1, dy: 0 };
    if (e.key === 'ArrowRight' && lastMove.dx !== -1) newMove = { dx: 1, dy: 0 };
    
    if (newMove) {
        playSound('move');
        if (moveQueue.length < 3) {
            moveQueue.push(newMove);
        }
    }
});

startBtn.addEventListener('click', () => {
    initAudio();
    if (!isPlaying) {
        resetGame();
        isPlaying = true;
        startBtn.disabled = true;
        startBtn.textContent = 'ROUTING...';
        lastTime = performance.now();
        gameLoop = requestAnimationFrame(gameStep);
    }
});

drawGrid();
