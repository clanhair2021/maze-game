/* ==========================================
   ⚙️ システム環境・難易度の設定
   ========================================== */
const CONFIG = {
    userStrokeColor: "rgba(0, 0, 255, 0.6)",  /* プレイヤーが引く線の色 */
    adminStrokeColor: "rgba(255, 0, 0, 0.6)", /* 管理者がなぞる時の色 */
    strokeWidth: 6,                           /* 線の太さ */
    goalTolerance: 30,                        /* ゴール判定の甘さ（半径のピクセル数） */
    startTolerance: 120                       /* スタート判定の甘さ（離れても許されるピクセル数） */
};

/* ==========================================
   変数・要素の定義
   ========================================== */
const menuPage = document.getElementById('menu-page');
const gamePage = document.getElementById('game-page');
const wrapper = document.getElementById('maze-wrapper');
const container = document.getElementById('canvas-container');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const mazeBg = document.getElementById('maze-bg');

const adminControls = document.getElementById('admin-controls');
const ctrlImageMode = document.getElementById('ctrl-image-mode');
const ctrlTraceMode = document.getElementById('ctrl-trace-mode');

const uiHeader = document.getElementById('ui-header');
const floatingMenuBtn = document.getElementById('floating-menu-btn');
const pageTitle = document.getElementById('page-title');
const guideText = document.getElementById('guide-text');

const hiddenCanvas = document.getElementById('hidden-canvas');
const hiddenCtx = hiddenCanvas.getContext('2d');
const imgAnswerObj = new Image();

let isDrawing = false;
let isAdminMode = false;
let adminSubMode = 'imageMode'; 
let hasJudged = false; 
let isLandscape = false; 
let currentMode = 'draw'; 

let scale = 1; let panX = 0; let panY = 0;
let startTouchDistance = 0; let lastTouchX = 0; let lastTouchY = 0;

let strokeHistory = []; 
let currentStroke = []; 
let judgeSystemType = 'trace'; 
let savedRoute = [];

let mazeStartPoint = null;
let mazeGoalPoint = null;
let setupStep = 'none';

/* ==========================================
   初期化・画像読み込み
   ========================================== */
window.onload = function() {
    const localImage = localStorage.getItem('maze_image');
    const localRoute = localStorage.getItem('maze_route');
    const localSystem = localStorage.getItem('judge_system');
    const localAnsImg = localStorage.getItem('maze_answer_image');
    const localStart = localStorage.getItem('maze_start_pt');
    const localGoal = localStorage.getItem('maze_goal_pt');

    if (localImage) { mazeBg.src = localImage; mazeBg.style.display = 'block'; }
    if (localSystem) { judgeSystemType = localSystem; }
    if (judgeSystemType === 'trace' && localRoute) { savedRoute = JSON.parse(localRoute); }
    if (judgeSystemType === 'color' && localAnsImg) { imgAnswerObj.src = localAnsImg; }
    if (localStart) mazeStartPoint = JSON.parse(localStart);
    if (localGoal) mazeGoalPoint = JSON.parse(localGoal);
};

mazeBg.onload = function() {
    if (mazeBg.naturalWidth > mazeBg.naturalHeight) {
        isLandscape = true; wrapper.classList.add('landscape'); 
    } else {
        isLandscape = false; wrapper.classList.remove('landscape');
    }
    adjustCanvasSize();
};

function adjustCanvasSize() {
    const width = mazeBg.clientWidth; const height = mazeBg.clientHeight;
    canvas.width = width; canvas.height = height;
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    redrawAllHistory(); 
}

function updateTransform() {
    let baseRotate = isLandscape ? 'rotate(90deg) ' : '';
    wrapper.style.transform = `${baseRotate}translate(${panX}px, ${panY}px) scale(${scale})`;
}

function resetTransform() {
    scale = 1; panX = 0; panY = 0; updateTransform();
}

function setMode(mode) {
    currentMode = mode;
    document.getElementById('btn-draw').classList.toggle('selected', mode === 'draw');
    document.getElementById('btn-zoom').classList.toggle('selected', mode === 'zoom');
}

function setSetupStep(step) {
    setupStep = step;
    const statusLabel = document.getElementById('setup-status');
    if (step === 'start') statusLabel.innerText = "迷路のスタート地点を1回タップしてください";
    if (step === 'goal') statusLabel.innerText = "迷路のゴール地点を1回タップしてください";
}

function toggleFullscreenMode(goFullscreen) {
    if (goFullscreen) {
        uiHeader.style.display = 'none'; guideText.style.display = 'none';
        if(isAdminMode) adminControls.style.display = 'none';
        floatingMenuBtn.style.display = 'block';
        container.classList.add('fullscreen');
    } else {
        uiHeader.style.display = 'block'; guideText.style.display = 'block';
        if(isAdminMode) adminControls.style.display = 'block';
        floatingMenuBtn.style.display = 'none';
        container.classList.remove('fullscreen');
    }
    setTimeout(adjustCanvasSize, 300);
}

/* ==========================================
   画像アップロードイベント
   ========================================== */
document.getElementById('img-question').addEventListener('change', (e) => { loadImgToBg(e.target.files[0]); });
document.getElementById('img-single').addEventListener('change', (e) => { loadImgToBg(e.target.files[0]); });
document.getElementById('img-answer').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        imgAnswerObj.src = event.target.result;
        localStorage.setItem('maze_answer_image', event.target.result);
    };
    reader.readAsDataURL(file);
});

function loadImgToBg(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        mazeBg.src = event.target.result;
        mazeBg.style.display = 'block';
        localStorage.setItem('maze_image', event.target.result);
    };
    reader.readAsDataURL(file);
}

/* ==========================================
   画面遷移
   ========================================== */
function startGame() {
    isAdminMode = false; setupStep = 'none';
    pageTitle.innerText = "美容室CLanからの挑戦状";
    setMode('draw'); adminControls.style.display = 'none';
    toggleFullscreenMode(false);
    menuPage.classList.remove('active'); gamePage.classList.add('active');
    resetTransform(); setTimeout(adjustCanvasSize, 50); setTimeout(resetCanvas, 60);
}

function openAdmin(mode) {
    isAdminMode = true; adminSubMode = mode; setupStep = 'none';
    pageTitle.innerText = mode === 'imageMode' ? "画像2枚一発登録" : "なぞりお手本登録";
    document.getElementById('setup-status').innerText = "キャンバス上をタップして位置を指定してください";
    setMode('draw');
    adminControls.style.display = 'block';
    ctrlImageMode.style.display = mode === 'imageMode' ? 'block' : 'none';
    ctrlTraceMode.style.display = mode === 'traceMode' ? 'block' : 'none';
    toggleFullscreenMode(false);
    menuPage.classList.remove('active'); gamePage.classList.add('active');
    resetTransform(); setTimeout(adjustCanvasSize, 50); setTimeout(resetCanvas, 60);
}

function goBackMenu() { toggleFullscreenMode(false); gamePage.classList.remove('active'); menuPage.classList.add('active'); }
function resetCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); strokeHistory = []; currentStroke = []; hasJudged = false; redrawAllHistory(); }

/* ==========================================
   描画ロジック
   ========================================== */
function redrawAllHistory() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateTransform();
    
    if (isAdminMode && adminSubMode === 'imageMode') {
        if (mazeStartPoint) { ctx.beginPath(); ctx.arc(mazeStartPoint.x, mazeStartPoint.y, 12, 0, Math.PI*2); ctx.fillStyle = "rgba(40, 167, 69, 0.6)"; ctx.fill(); }
        if (mazeGoalPoint) { ctx.beginPath(); ctx.arc(mazeGoalPoint.x, mazeGoalPoint.y, 12, 0, Math.PI*2); ctx.fillStyle = "rgba(220, 53, 69, 0.6)"; ctx.fill(); }
    }

    for (let stroke of strokeHistory) {
        if (stroke.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        ctx.lineWidth = CONFIG.strokeWidth / scale;
        ctx.strokeStyle = isAdminMode ? CONFIG.adminStrokeColor : CONFIG.userStrokeColor; 
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        
        for (let i = 1; i < stroke.length; i++) { ctx.lineTo(stroke[i].x, stroke[i].y); }
        ctx.stroke();
    }
}

function undoLastLine() {
    if (strokeHistory.length > 0) {
        strokeHistory.pop(); 
        redrawAllHistory();
    }
}

function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect(); const touch = e.touches[0];
    let clientX = touch.clientX - rect.left; let clientY = touch.clientY - rect.top;
    let x = clientX * (canvas.width / rect.width); let y = clientY * (canvas.height / rect.height);
    return { x, y };
}

/* ==========================================
   タッチイベントリスナー
   ========================================== */
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (currentMode === 'zoom' || e.touches.length >= 2) {
        isDrawing = false;
        if (e.touches.length >= 2) {
            startTouchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        } else { lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; }
        return;
    }

    const pos = getTouchPos(e);

    if (isAdminMode && setupStep !== 'none') {
        isDrawing = false;
        if (setupStep === 'start') {
            mazeStartPoint = { x: pos.x, y: pos.y };
            alert("スタート位置を設定しました");
        } else if (setupStep === 'goal') {
            mazeGoalPoint = { x: pos.x, y: pos.y };
            alert("ゴール位置を設定しました");
        }
        setupStep = 'none';
        document.getElementById('setup-status').innerText = "設定が完了しました。保存を行ってください。";
        redrawAllHistory();
        return;
    }

    if (!isAdminMode && hasJudged) return; 
    isDrawing = true;
    currentStroke = [pos]; 
    
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = CONFIG.strokeWidth / scale; 
    ctx.strokeStyle = isAdminMode ? CONFIG.adminStrokeColor : CONFIG.userStrokeColor; 
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    if (!isAdminMode) { checkRealtimeGoalTouch(pos.x, pos.y); }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (currentMode === 'zoom' || e.touches.length >= 2) {
        if (e.touches.length >= 2) {
            let currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            if (startTouchDistance > 0) { scale = Math.max(1, Math.min(scale * (currentDistance / startTouchDistance), 4)); startTouchDistance = currentDistance; updateTransform(); }
        } else {
            let deltaX = e.touches[0].clientX - lastTouchX; let deltaY = e.touches[0].clientY - lastTouchY;
            if (isLandscape) { panX += deltaY; panY -= deltaX; } else { panX += deltaX; panY += deltaY; }
            lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; updateTransform();
        }
        return;
    }

    if (!isDrawing) return;
    if (!isAdminMode && hasJudged) return;
    
    const pos = getTouchPos(e);
    currentStroke.push(pos); 
    ctx.lineTo(pos.x, pos.y); ctx.stroke();

    if (!isAdminMode) { checkRealtimeGoalTouch(pos.x, pos.y); }
});

canvas.addEventListener('touchend', () => {
    if (isDrawing && currentStroke.length > 0) { strokeHistory.push(currentStroke); }
    isDrawing = false; startTouchDistance = 0;
});

/* ==========================================
   データ保存ロジック
   ========================================== */
function saveImageModeData() {
    if(!mazeBg.src || !imgAnswerObj.src) { alert("問題と答えの両方の画像をセットしてください。"); return; }
    if(!mazeStartPoint || !mazeGoalPoint) { alert("スタート位置とゴール位置を画面上で指定してください。"); return; }
    
    localStorage.setItem('judge_system', 'color');
    judgeSystemType = 'color';
    localStorage.setItem('maze_start_pt', JSON.stringify(mazeStartPoint));
    localStorage.setItem('maze_goal_pt', JSON.stringify(mazeGoalPoint));
    
    alert("画像、およびスタート・ゴール位置の登録が完了しました！");
    goBackMenu();
}

function getAllPoints() { return strokeHistory.flat(); }

function saveTraceModeData() {
    const allPts = getAllPoints();
    if (allPts.length < 5) { alert("ルートがなぞられていません。"); return; }
    savedRoute = allPts.filter((_, index) => index % 3 === 0);
    savedRoute.push(allPts[allPts.length - 1]);
    localStorage.setItem('maze_route', JSON.stringify(savedRoute));
    localStorage.setItem('judge_system', 'trace');
    judgeSystemType = 'trace';
    alert("手動なぞりルートの保存が完了しました！");
    goBackMenu();
}

function checkRealtimeGoalTouch(x, y) {
    if (hasJudged) return;

    if (judgeSystemType === 'color') {
        if (!mazeGoalPoint) return;
        const dist = Math.hypot(x - mazeGoalPoint.x, y - mazeGoalPoint.y);
        if (dist < CONFIG.goalTolerance) {
            isDrawing = false; hasJudged = true;
            setTimeout(checkAnswerColor, 100);
        }
    } 
    else if (judgeSystemType === 'trace') {
        if (savedRoute.length === 0) return;
        const correctEnd = savedRoute[savedRoute.length - 1];
        if (Math.hypot(x - correctEnd.x, y - correctEnd.y) < CONFIG.strokeWidth * 10) {
            isDrawing = false; hasJudged = true;
            setTimeout(checkAnswerTrace, 100);
        }
    }
}

/* ==========================================
   判定システム
   ========================================== */
function checkAnswerColor() {
    hiddenCanvas.width = canvas.width; hiddenCanvas.height = canvas.height;
    hiddenCtx.drawImage(imgAnswerObj, 0, 0, canvas.width, canvas.height);
    
    const allPts = getAllPoints();
    if (mazeStartPoint && allPts.length > 0) {
        const firstPt = allPts[0];
        if (Math.hypot(firstPt.x - mazeStartPoint.x, firstPt.y - mazeStartPoint.y) > CONFIG.startTolerance) {
            alert("残念！スタート地点から正しく描き始められていないようです。");
            hasJudged = false; return;
        }
    }

    let crossWallDetected = false;
    for (let stroke of strokeHistory) {
        if (stroke.length < 2) continue;
        for (let i = 0; i < stroke.length - 1; i++) {
            let pt1 = stroke[i]; let pt2 = stroke[i+1];
            for(let k=0; k<=5; k++) {
                let ratio = k / 5;
                let checkX = pt1.x + (pt2.x - pt1.x) * ratio;
                let checkY = pt1.y + (pt2.y - pt1.y) * ratio;
                const pixel = hiddenCtx.getImageData(Math.floor(checkX), Math.floor(checkY), 1, 1).data;
                const isBlackWall = pixel[0] < 60 && pixel[1] < 60 && pixel[2] < 60 && pixel[3] > 200;
                if (isBlackWall) { crossWallDetected = true; break; }
            }
            if (crossWallDetected) break;
        }
        if (crossWallDetected) break;
    }

    if (crossWallDetected) {
        alert("残念！途中で壁を跨いでワープしてしまっています。\n「1つ戻る」ボタンで今の線を消してやり直せます！");
        hasJudged = false; 
    } else {
        alert("正解！おめでとうございます！");
        resetCanvas(); toggleFullscreenMode(false);
    }
}

function checkAnswerTrace() {
    const allPts = getAllPoints();
    const userStart = allPts[0]; const correctStart = savedRoute[0];
    if (Math.hypot(userStart.x - correctStart.x, userStart.y - correctStart.y) > CONFIG.startTolerance) {
        alert("残念！スタート位置から正しくなぞれていないみたい。"); 
        hasJudged = false; return;
    }

    let currentTargetIndex = 0; let maxReachedIndex = 0;
    for (let uPt of allPts) {
        if (currentTargetIndex < savedRoute.length) {
            if (Math.hypot(uPt.x - savedRoute[currentTargetIndex].x, uPt.y - savedRoute[currentTargetIndex].y) < CONFIG.startTolerance) {
                currentTargetIndex++;
                if (currentTargetIndex > maxReachedIndex) { maxReachedIndex = currentTargetIndex; }
            }
        }
    }
    
    if ((maxReachedIndex / savedRoute.length) >= 0.80) { 
        alert("正解！おめでとうございます！"); resetCanvas(); toggleFullscreenMode(false);
    } else { 
        alert("残念！正しいルートを大きく外れてしまっているようです。\n「1つ戻る」ボタンで戻ってやり直せますよ！"); hasJudged = false;
    }
}
