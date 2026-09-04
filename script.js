const boardElement = document.getElementById("board");
const quitBtn = document.getElementById('quit');
const restartBtn = document.getElementById('restart');
const cancelBtn = document.getElementById('cancel');
const backwardBtn = document.getElementById('backward');
const forwardBtn = document.getElementById('forward');
let enPassantTarget = null;

// ─── Game State ───────────────────────────────────────────────
const board = [
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P"],
    ["R", "N", "B", "Q", "K", "B", "N", "R"]
];

const startingBoard = [
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P"],
    ["R", "N", "B", "Q", "K", "B", "N", "R"]
];

const pieces = {
    "r": "&#9820;", "n": "&#9822;", "b": "&#9821;",
    "q": "&#9819;", "k": "&#9818;", "p": "&#9823;",
    "R": "&#9814;", "N": "&#9816;", "B": "&#9815;",
    "Q": "&#9813;", "K": "&#9812;", "P": "&#9817;"
};

// ─── Move History Log ─────────────────────────────────────────
let moveLog = [];
let futureMoveLog = [];

function renderMoveHistoryList() {
    const list = document.getElementById('move-history-list');
    if (!list) return;

    list.innerHTML = '';
    let lastWhiteMove = null;

    moveLog.forEach((move) => {
        if (move.color === 'white') {
            const entry = document.createElement('div');
            entry.className = 'move-entry';

            const num = document.createElement('span');
            num.className = 'move-number';
            num.textContent = `${Math.floor((moveLog.indexOf(move)) / 2) + 1}.`;

            const whiteMove = document.createElement('span');
            whiteMove.className = 'move-white';
            whiteMove.textContent = move.notation;

            entry.appendChild(num);
            entry.appendChild(whiteMove);
            list.appendChild(entry);
            lastWhiteMove = entry;
        } else if (lastWhiteMove) {
            const blackMove = document.createElement('span');
            blackMove.className = 'move-black';
            blackMove.textContent = move.notation;
            lastWhiteMove.appendChild(blackMove);
        }
    });

    list.scrollTop = list.scrollHeight;
}

function toChessNotation(piece, fromRow, fromCol, toRow, toCol, isCapture, isCastle) {
    if (isCastle) return toCol === 6 ? 'O-O' : 'O-O-O';
    const colLetters = ['a','b','c','d','e','f','g','h'];
    const toFile = colLetters[toCol];
    const toRank = 8 - toRow;
    const fromFile = colLetters[fromCol];
    const p = piece.toLowerCase();
    if (p === 'p') {
        if (isCapture) return `${fromFile}x${toFile}${toRank}`;
        return `${toFile}${toRank}`;
    }
    const letter = piece.toUpperCase();
    if (isCapture) return `${letter}x${toFile}${toRank}`;
    return `${letter}${toFile}${toRank}`;
}

function addMoveToHistory(notation, color) {
    moveLog.push({ notation, color });
    renderMoveHistoryList();
}

// ─── Sound Effects ────────────────────────────────────────────
const sounds = {
    move: new Audio('audio/move.mp3'),
    capture: new Audio('audio/capture.mp3'),
    check: new Audio('audio/check.mp3'),
    checkmate: new Audio('audio/checkmate.mp3'),
};

function playSound(type) {
    const sound = sounds[type];
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(() => {});
}

// ─── Castling Rights ──────────────────────────────────────────
let castlingRights = {
    whiteKing: true, whiteRookA: true, whiteRookH: true,
    blackKing: true, blackRookA: true, blackRookH: true,
};

let selectedSquare = null;
const playerColor = localStorage.getItem('chess-player-color') || 'white';
const gameMode = localStorage.getItem('chess-game-mode') || 'two-player';
document.body.setAttribute('data-player-color', playerColor);
let currentTurn = 'white';
let moveHistory = [];
let future = [];
const TIME_PER_PLAYER = 600;
let timers = { white: TIME_PER_PLAYER, black: TIME_PER_PLAYER };
let timerInterval = null;
let gameIsOver = false;

function isBoardFlipped() {
    return gameMode === 'computer' && playerColor === 'black';
}

function getActualBoardCoords(displayRow, displayCol) {
    if (!isBoardFlipped()) return { row: displayRow, col: displayCol };
    return { row: 7 - displayRow, col: 7 - displayCol };
}

function getLegalMovesForColor(color) {
    const moves = [];
    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = board[fromRow][fromCol];
            if (!piece) continue;
            const isFriendly = color === 'white'
                ? piece === piece.toUpperCase()
                : piece === piece.toLowerCase();
            if (!isFriendly) continue;

            for (let toRow = 0; toRow < 8; toRow++) {
                for (let toCol = 0; toCol < 8; toCol++) {
                    if (isValidMove(fromRow, fromCol, toRow, toCol)) {
                        moves.push({ fromRow, fromCol, toRow, toCol });
                    }
                }
            }
        }
    }
    return moves;
}

const PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
};

function cloneBoardState(sourceBoard = board) {
    return sourceBoard.map(row => [...row]);
}

function getPieceSquareBonus(piece, row, col) {
    const value = PIECE_VALUES[piece.toLowerCase()];
    const centerDistance = Math.abs(3.5 - col) + Math.abs(3.5 - row);
    let bonus = 0;

    if (piece.toLowerCase() === 'p') {
        bonus += (piece === 'P') ? (7 - row) * 4 : row * 4;
    }
    if (piece.toLowerCase() === 'n' || piece.toLowerCase() === 'b') {
        bonus += (8 - centerDistance) * 3;
    }
    if (piece.toLowerCase() === 'r' || piece.toLowerCase() === 'q') {
        bonus += (8 - centerDistance) * 2;
    }
    if (piece.toLowerCase() === 'k') {
        bonus += (row < 2 || row > 5) ? 15 : 0;
    }

    return value * 0.08 + bonus;
}

function evaluateBoardForColor(state, perspectiveColor) {
    let score = 0;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state[row][col];
            if (!piece) continue;

            const pieceValue = PIECE_VALUES[piece.toLowerCase()];
            const isPerspectivePiece = perspectiveColor === 'white'
                ? piece === piece.toUpperCase()
                : piece === piece.toLowerCase();

            const positionalBonus = getPieceSquareBonus(piece, row, col);
            const direction = isPerspectivePiece ? 1 : -1;
            score += direction * (pieceValue + positionalBonus);
        }
    }

    return score;
}

function simulateMoveOnState(state, fromRow, fromCol, toRow, toCol) {
    const nextState = cloneBoardState(state);
    const movingPiece = nextState[fromRow][fromCol];
    const capturedPiece = nextState[toRow][toCol];

    if ((movingPiece === 'P' || movingPiece === 'p') && Math.abs(toRow - fromRow) === 2) {
        // no-op for this heuristic; attack logic is handled by the main move validation path
    }

    nextState[toRow][toCol] = movingPiece;
    nextState[fromRow][fromCol] = '';

    if ((movingPiece === 'P' && toRow === 0) || (movingPiece === 'p' && toRow === 7)) {
        nextState[toRow][toCol] = movingPiece === 'P' ? 'Q' : 'q';
    }

    if ((movingPiece === 'P' || movingPiece === 'p') &&
        fromCol !== toCol && capturedPiece === '' &&
        ((movingPiece === 'P' && fromRow === 3 && toRow === 2) ||
         (movingPiece === 'p' && fromRow === 4 && toRow === 5))) {
        const capturedRow = movingPiece === 'P' ? fromRow : fromRow;
        nextState[capturedRow][toCol] = '';
    }

    if ((movingPiece === 'K' || movingPiece === 'k') && Math.abs(toCol - fromCol) === 2) {
        const rookFromCol = toCol > fromCol ? 7 : 0;
        const rookToCol = toCol > fromCol ? 5 : 3;
        const rook = nextState[fromRow][rookFromCol];
        nextState[fromRow][rookToCol] = rook;
        nextState[fromRow][rookFromCol] = '';
    }

    return { nextState, capturedPiece };
}

function isKingInCheckState(state, color) {
    const kingChar = color === 'white' ? 'K' : 'k';
    let kingRow = -1;
    let kingCol = -1;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (state[row][col] === kingChar) {
                kingRow = row;
                kingCol = col;
                break;
            }
        }
        if (kingRow !== -1) break;
    }

    if (kingRow === -1) return true;

    const enemyColor = color === 'white' ? 'black' : 'white';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state[row][col];
            if (!piece) continue;
            const isEnemy = enemyColor === 'white'
                ? piece === piece.toUpperCase()
                : piece === piece.toLowerCase();
            if (!isEnemy) continue;

            const startPiece = piece.toLowerCase();
            const rowDiff = kingRow - row;
            const colDiff = kingCol - col;
            const absRow = Math.abs(rowDiff);
            const absCol = Math.abs(colDiff);

            let attack = false;
            if (startPiece === 'p') {
                const dir = piece === 'P' ? -1 : 1;
                attack = absCol === 1 && rowDiff === dir;
            } else if (startPiece === 'n') {
                attack = (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
            } else if (startPiece === 'b' || startPiece === 'r' || startPiece === 'q') {
                if (startPiece === 'b' && absRow === absCol) attack = true;
                if (startPiece === 'r' && (rowDiff === 0 || colDiff === 0)) attack = true;
                if (startPiece === 'q' && ((rowDiff === 0 || colDiff === 0) || absRow === absCol)) attack = true;
                if (attack) {
                    const rowStep = rowDiff === 0 ? 0 : rowDiff / Math.abs(rowDiff);
                    const colStep = colDiff === 0 ? 0 : colDiff / Math.abs(colDiff);
                    let checkRow = row + rowStep;
                    let checkCol = col + colStep;
                    let blocked = false;
                    while (checkRow !== kingRow || checkCol !== kingCol) {
                        if (state[checkRow][checkCol] !== '') { blocked = true; break; }
                        checkRow += rowStep;
                        checkCol += colStep;
                    }
                    attack = !blocked;
                }
            } else if (startPiece === 'k') {
                attack = absRow <= 1 && absCol <= 1 && (absRow + absCol) > 0;
            }

            if (attack) return true;
        }
    }

    return false;
}

// ─── Minimax Search (state-based, never touches the live board) ───
// How deep the AI looks ahead, in half-moves (plies). Higher = stronger but slower.
const AI_SEARCH_DEPTH = 3;

// Pure movement-pattern generator for a hypothetical state — no self-check
// filtering (that's applied separately), and deliberately no castling: castling
// rights aren't tracked per-hypothetical-state, so modeling it several moves
// into an imagined future isn't reliable. It's still always available as a REAL
// move whenever it's actually legal — see findBestMoveForColor below, which
// generates the computer's actual candidate moves from the real board.
function getPseudoLegalDestinationsInState(state, row, col) {
    const piece = state[row][col];
    if (!piece) return [];
    const isWhite = piece === piece.toUpperCase();
    const p = piece.toLowerCase();
    const destinations = [];
    const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
    const isEnemy = (target) => target && (isWhite ? target === target.toLowerCase() : target === target.toUpperCase());

    if (p === 'p') {
        const dir = isWhite ? -1 : 1;
        const startRow = isWhite ? 6 : 1;
        if (onBoard(row + dir, col) && state[row + dir][col] === '') {
            destinations.push({ row: row + dir, col });
            if (row === startRow && state[row + dir * 2][col] === '') {
                destinations.push({ row: row + dir * 2, col });
            }
        }
        [-1, 1].forEach(dc => {
            const r = row + dir, c = col + dc;
            if (onBoard(r, c) && isEnemy(state[r][c])) destinations.push({ row: r, col: c });
        });
        return destinations;
    }

    if (p === 'n') {
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => {
            const r = row + dr, c = col + dc;
            if (onBoard(r, c) && (!state[r][c] || isEnemy(state[r][c]))) destinations.push({ row: r, col: c });
        });
        return destinations;
    }

    if (p === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr, c = col + dc;
                if (onBoard(r, c) && (!state[r][c] || isEnemy(state[r][c]))) destinations.push({ row: r, col: c });
            }
        }
        return destinations;
    }

    const directions = [];
    if (p === 'r' || p === 'q') directions.push([-1,0],[1,0],[0,-1],[0,1]);
    if (p === 'b' || p === 'q') directions.push([-1,-1],[-1,1],[1,-1],[1,1]);
    directions.forEach(([dr, dc]) => {
        let r = row + dr, c = col + dc;
        while (onBoard(r, c)) {
            if (!state[r][c]) {
                destinations.push({ row: r, col: c });
            } else {
                if (isEnemy(state[r][c])) destinations.push({ row: r, col: c });
                break;
            }
            r += dr; c += dc;
        }
    });
    return destinations;
}

// All legal moves for `color` in a hypothetical state — pseudo-legal moves,
// filtered to exclude any that would leave that color's own king in check.
function getLegalMovesInState(state, color) {
    const moves = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state[row][col];
            if (!piece) continue;
            const isFriendly = color === 'white' ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
            if (!isFriendly) continue;

            getPseudoLegalDestinationsInState(state, row, col).forEach(dest => {
                const { nextState } = simulateMoveOnState(state, row, col, dest.row, dest.col);
                if (!isKingInCheckState(nextState, color)) {
                    moves.push({ fromRow: row, fromCol: col, toRow: dest.row, toCol: dest.col });
                }
            });
        }
    }
    return moves;
}

// Recursive minimax with alpha-beta pruning. Always evaluates from aiColor's
// perspective; colorToMove alternates each ply and determines whether this
// level is trying to maximize or minimize that score.
function minimax(state, depth, alpha, beta, aiColor, colorToMove) {
    if (depth === 0) {
        return evaluateBoardForColor(state, aiColor);
    }

    const moves = getLegalMovesInState(state, colorToMove);

    if (moves.length === 0) {
        if (isKingInCheckState(state, colorToMove)) {
            // colorToMove is checkmated right here — great if that's the opponent, terrible if it's us
            return colorToMove === aiColor ? -100000 : 100000;
        }
        return 0; // stalemate
    }

    // Checking captures first lets alpha-beta prune far more branches
    moves.sort((a, b) => {
        const aCap = state[a.toRow][a.toCol] !== '' ? 1 : 0;
        const bCap = state[b.toRow][b.toCol] !== '' ? 1 : 0;
        return bCap - aCap;
    });

    const isMaximizing = colorToMove === aiColor;
    const nextColor = colorToMove === 'white' ? 'black' : 'white';
    let best = isMaximizing ? -Infinity : Infinity;

    for (const move of moves) {
        const { nextState } = simulateMoveOnState(state, move.fromRow, move.fromCol, move.toRow, move.toCol);
        const value = minimax(nextState, depth - 1, alpha, beta, aiColor, nextColor);

        if (isMaximizing) {
            if (value > best) best = value;
            if (best > alpha) alpha = best;
        } else {
            if (value < best) best = value;
            if (best < beta) beta = best;
        }

        if (beta <= alpha) break; // prune — the rest of this branch can't matter
    }

    return best;
}

// Picks the computer's actual move. Candidate moves come from the REAL board
// via getLegalMovesForColor, so castling/en passant/promotion are all
// correctly available as real choices — only the deeper hypothetical search
// (minimax above) simplifies those.
function findBestMoveForColor(color, depth) {
    const moves = getLegalMovesForColor(color);
    if (!moves.length) return null;

    moves.sort((a, b) => {
        const aCap = board[a.toRow][a.toCol] !== '' ? 1 : 0;
        const bCap = board[b.toRow][b.toCol] !== '' ? 1 : 0;
        return bCap - aCap;
    });

    const opponentColor = color === 'white' ? 'black' : 'white';
    let bestMove = moves[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    moves.forEach(move => {
        const { nextState } = simulateMoveOnState(board, move.fromRow, move.fromCol, move.toRow, move.toCol);
        const score = minimax(nextState, depth - 1, alpha, beta, color, opponentColor);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
        if (bestScore > alpha) alpha = bestScore;
    });

    return bestMove;
}

function triggerComputerMove() {
    if (gameMode !== 'computer' || gameIsOver || currentTurn === playerColor) return;

    const bestMove = findBestMoveForColor(currentTurn, AI_SEARCH_DEPTH);
    if (!bestMove) return;

    selectedSquare = [bestMove.fromRow, bestMove.fromCol];
    setTimeout(() => {
        if (gameMode !== 'computer' || gameIsOver || currentTurn === playerColor) return;
        handleClick(bestMove.toRow, bestMove.toCol, true);
    }, 450);
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTimers() {
    const whiteTimer = document.getElementById('white-timer');
    const blackTimer = document.getElementById('black-timer');
    const whitePanel = document.getElementById('timer-white');
    const blackPanel = document.getElementById('timer-black');

    if (whiteTimer) whiteTimer.textContent = formatTime(timers.white);
    if (blackTimer) blackTimer.textContent = formatTime(timers.black);
    if (whitePanel) whitePanel.classList.toggle('active', currentTurn === 'white' && !gameIsOver);
    if (blackPanel) blackPanel.classList.toggle('active', currentTurn === 'black' && !gameIsOver);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function startTimer() {
    stopTimer();
    if (gameIsOver) return;

    timerInterval = setInterval(() => {
        if (gameIsOver) {
            stopTimer();
            return;
        }

        const activeColor = currentTurn;
        if (timers[activeColor] > 0) {
            timers[activeColor] -= 1;
            updateTimers();
        }

        if (timers[activeColor] <= 0) {
            stopTimer();
            gameIsOver = true;
            const winner = activeColor === 'white' ? 'Black' : 'White';
            setTimeout(() => alert(`Time's up! ${winner} wins! ⏰`), 100);
            updateTimers();
        }
    }, 1000);

    updateTimers();
}

// ─── Render ───────────────────────────────────────────────────
function renderBoard() {
    boardElement.innerHTML = '';

    for (let displayRow = 0; displayRow < 8; displayRow++) {
        for (let displayCol = 0; displayCol < 8; displayCol++) {
            const { row, col } = getActualBoardCoords(displayRow, displayCol);
            const square = document.createElement('div');
            square.dataset.row = row;
            square.dataset.col = col;

            square.classList.add((row + col) % 2 === 0 ? "light" : "dark");

            const currentPiece = board[row][col];
            if (currentPiece === 'K' && isInCheck('white') && !selectedSquare) square.classList.add('in-check');
            if (currentPiece === 'k' && isInCheck('black') && !selectedSquare) square.classList.add('in-check');

            if (selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col) {
                square.classList.add('selected');
            }

            if (isBoardFlipped()) {
                if (displayRow === 7) {
                    const topNote = document.createElement('span');
                    topNote.className = 'notation side';
                    topNote.textContent = String.fromCharCode(97 + (7 - displayCol));
                    square.appendChild(topNote);
                }

                if (displayCol === 0) {
                    const sideNote = document.createElement('span');
                    sideNote.className = 'notation top';
                    sideNote.textContent = displayRow + 1;
                    square.appendChild(sideNote);
                }
            } else {
                if (row === 7) {
                    const topNote = document.createElement('span');
                    topNote.className = 'notation side';
                    topNote.textContent = String.fromCharCode(97 + col);
                    square.appendChild(topNote);
                }

                if (col === 0) {
                    const sideNote = document.createElement('span');
                    sideNote.className = 'notation top';
                    sideNote.textContent = 8 - row;
                    square.appendChild(sideNote);
                }
            }

            const piece = board[row][col];
            if (piece) {
                const pieceEl = document.createElement('span');
                pieceEl.className = 'piece';
                pieceEl.classList.add(piece === piece.toUpperCase() ? 'white' : 'black');
                pieceEl.innerHTML = pieces[piece];

                if (piece === 'K' && isInCheck('white') && !selectedSquare) pieceEl.classList.add('king-in-check');
                if (piece === 'k' && isInCheck('black') && !selectedSquare) pieceEl.classList.add('king-in-check');

                square.appendChild(pieceEl);
            }

            square.addEventListener('click', () => handleClick(row, col));
            boardElement.appendChild(square);
        }
    }

    renderMaterialTrays();
}

// ─── Material Trays ─────────────────────────────────────────────
// Recomputed from the current board every render — no separate tracking
// array to keep in sync with Backward/Forward, since the board itself is
// already the single source of truth.
//
// Known limitation: a pawn that promotes disappears from the pawn count
// without being captured, so it can misleadingly show up here as "1 pawn
// captured" in that rare case. Not worth the extra bookkeeping to fix for
// a purely informational display.
const STARTING_PIECE_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const MATERIAL_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const TRAY_DISPLAY_ORDER = ['q', 'r', 'b', 'n', 'p']; // heaviest first

function renderMaterialTrays() {
    const whiteTray = document.getElementById('material-white');
    const blackTray = document.getElementById('material-black');
    if (!whiteTray || !blackTray) return;

    const currentCounts = { white: {}, black: {} };
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece || piece.toLowerCase() === 'k') continue;
            const type = piece.toLowerCase();
            const side = piece === piece.toUpperCase() ? 'white' : 'black';
            currentCounts[side][type] = (currentCounts[side][type] || 0) + 1;
        }
    }

    // Pieces missing from a side's starting set were (almost always) captured by the opponent
    const capturedByWhite = []; // black pieces white has taken
    const capturedByBlack = []; // white pieces black has taken
    TRAY_DISPLAY_ORDER.forEach(type => {
        const missingFromBlack = Math.max(0, STARTING_PIECE_COUNTS[type] - (currentCounts.black[type] || 0));
        for (let i = 0; i < missingFromBlack; i++) capturedByWhite.push(type);

        const missingFromWhite = Math.max(0, STARTING_PIECE_COUNTS[type] - (currentCounts.white[type] || 0));
        for (let i = 0; i < missingFromWhite; i++) capturedByBlack.push(type);
    });

    const scoreWhite = capturedByWhite.reduce((sum, t) => sum + MATERIAL_VALUE[t], 0);
    const scoreBlack = capturedByBlack.reduce((sum, t) => sum + MATERIAL_VALUE[t], 0);
    const advantage = scoreWhite - scoreBlack;

    const buildTrayHTML = (capturedTypes, capturedPieceIsBlack) => {
        return capturedTypes.map(type => {
            const glyph = capturedPieceIsBlack ? pieces[type] : pieces[type.toUpperCase()];
            const colorClass = capturedPieceIsBlack ? 'black' : 'white';
            return `<span class="piece ${colorClass}">${glyph}</span>`;
        }).join('');
    };

    whiteTray.innerHTML = buildTrayHTML(capturedByWhite, true) +
        (advantage > 0 ? `<span class="advantage">+${advantage}</span>` : '');
    blackTray.innerHTML = buildTrayHTML(capturedByBlack, false) +
        (advantage < 0 ? `<span class="advantage">+${-advantage}</span>` : '');
}

// ─── Piece Slide Animation ────────────────────────────────────
function animateMove(fromRect, toRow, toCol) {
    const toSquare = document.querySelector(`[data-row='${toRow}'][data-col='${toCol}']`);
    const toEl = toSquare ? toSquare.querySelector('.piece') : null;
    if (!toEl) return;

    const toRect = toEl.getBoundingClientRect();
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;

    toEl.style.animation = 'none';
    toEl.style.zIndex = '999';
    toEl.style.transition = 'none';
    toEl.style.transform = `translate(${dx}px, ${dy}px)`;
    toEl.getBoundingClientRect(); // force reflow

    requestAnimationFrame(() => {
        toEl.style.transition = 'transform 0.25s ease';
        toEl.style.transform = 'translate(0, 0)';
        toEl.addEventListener('transitionend', () => {
            toEl.style.transition = '';
            toEl.style.transform = '';
            toEl.style.zIndex = '';
        }, { once: true });
    });
}

// ─── Board Diffing (for Backward/Forward animation) ────────────
// Compares two board states and figures out which pieces actually slid from
// one square to another (same piece letter: gone from A, now at B) versus
// which just appeared or disappeared outright (a revived capture, or a
// pawn losing its promotion). Handles normal moves, captures, and castling
// automatically — it doesn't need to know what kind of move it was.
function getBoardSlides(oldBoard, newBoard) {
    const removed = [];
    const added = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const oldPiece = oldBoard[row][col];
            const newPiece = newBoard[row][col];
            if (oldPiece === newPiece) continue;
            if (oldPiece) removed.push({ row, col, piece: oldPiece });
            if (newPiece) added.push({ row, col, piece: newPiece, used: false });
        }
    }

    const slides = [];
    removed.forEach(r => {
        const match = added.find(a => a.piece === r.piece && !a.used);
        if (match) {
            match.used = true;
            slides.push({ fromRow: r.row, fromCol: r.col, toRow: match.row, toCol: match.col });
        }
    });

    return slides;
}

// Captures each slide's current on-screen position BEFORE the board mutates,
// then (after renderBoard() has redrawn everything) plays the FLIP animation
// for each one. Used by Backward/Forward, mirroring how handleClick does it.
function animateSlides(slides) {
    return slides
        .map(s => {
            const el = boardElement.querySelector(`[data-row="${s.fromRow}"][data-col="${s.fromCol}"] .piece`);
            return el ? { rect: el.getBoundingClientRect(), toRow: s.toRow, toCol: s.toCol } : null;
        })
        .filter(Boolean);
}

// ─── Theme Switcher ───────────────────────────────────────────
const themebuttons = document.querySelectorAll('.theme-btn');
themebuttons.forEach(btn => {
    btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        applyTheme(theme);
        localStorage.setItem('chess-theme', theme);
    });
});

function applyTheme(theme) {
    if (theme === 'classic') {
        document.body.removeAttribute('data-theme');
    } else {
        document.body.setAttribute('data-theme', theme);
    }
    themebuttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

applyTheme(localStorage.getItem('chess-theme') || 'classic');

// ─── Click Handler ────────────────────────────────────────────
function handleClick(row, col, isComputerMove = false) {
    if (gameIsOver) return; // game has ended — ignore all further clicks
    if (gameMode === 'computer' && !isComputerMove && currentTurn !== playerColor) return;

    try {

    const piece = board[row][col];
    const iswhite = piece && piece === piece.toUpperCase();
    const isblack = piece && piece === piece.toLowerCase();
    let isCapture = false;
    let fromRect = null;

    if (!selectedSquare) {
        // First click — select own piece
        if ((currentTurn === 'white' && iswhite) ||
            (currentTurn === 'black' && isblack)) {
            selectedSquare = [row, col];
            renderBoard(); // ← only render to show green highlight
        }
        return; // ← always return after first click
    }

    // Second click onwards
    const [selectedRow, selectedCol] = selectedSquare;

    // Same square → deselect
    if (selectedRow === row && selectedCol === col) {
        selectedSquare = null;
        renderBoard();
        return;
    }

    // Another friendly piece → reselect
    if ((currentTurn === 'white' && iswhite) ||
        (currentTurn === 'black' && isblack)) {
        selectedSquare = [row, col];
        renderBoard();
        return;
    }

    // Validate move
    if (!isValidMove(selectedRow, selectedCol, row, col)) {
        selectedSquare = null;
        renderBoard();
        return;
    }

    // Capture piece's position BEFORE re-rendering
    const movingPieceEl = boardElement.querySelector(
        `[data-row="${selectedRow}"][data-col="${selectedCol}"] .piece`
    );
    fromRect = movingPieceEl ? movingPieceEl.getBoundingClientRect() : null;

    // ✅ Save notation info BEFORE board changes
    const movingPiece = board[selectedRow][selectedCol];
    const isEnPassantCapture = (movingPiece === 'P' || movingPiece === 'p') &&
        !!enPassantTarget &&
        row === enPassantTarget[0] &&
        col === enPassantTarget[1] &&
        board[row][col] === '';
    isCapture = board[row][col] !== '' || isEnPassantCapture;
    const isCastle = (movingPiece === 'K' || movingPiece === 'k') &&
                      Math.abs(col - selectedCol) === 2;
    const notation = toChessNotation(movingPiece, selectedRow, selectedCol, row, col, isCapture, isCastle);
    const whoMoved = currentTurn;

    // En passant — remove captured pawn BEFORE moving
    if (isEnPassantCapture) {
        const capturedPawnRow = movingPiece === 'P' ? row + 1 : row - 1;
        board[capturedPawnRow][col] = '';
    }

    // Execute move
    future = [];
    futureMoveLog = [];
    moveHistory.push(board.map(r => [...r]));
    board[row][col] = board[selectedRow][selectedCol];
    board[selectedRow][selectedCol] = '';

    // Castling — move the rook (and animate it too, so it doesn't just snap into place)
    const kingMoved = board[row][col];
    let castleRookAnim = null;
    if ((kingMoved === 'K' || kingMoved === 'k') && Math.abs(col - selectedCol) === 2) {
        const rookFromCol = col === 6 ? 7 : 0;
        const rookToCol = col === 6 ? 5 : 3;

        // Capture the rook's CURRENT on-screen position BEFORE we move it —
        // same trick we use for the king's fromRect above
        const rookEl = boardElement.querySelector(
            `[data-row="${row}"][data-col="${rookFromCol}"] .piece`
        );
        const rookFromRect = rookEl ? rookEl.getBoundingClientRect() : null;

        board[row][rookToCol] = board[row][rookFromCol];
        board[row][rookFromCol] = '';

        if (rookFromRect) {
            castleRookAnim = { rect: rookFromRect, toRow: row, toCol: rookToCol };
        }
    }

    // Update castling rights
    const moved = board[row][col];
    if (moved === 'K') castlingRights.whiteKing = false;
    if (moved === 'k') castlingRights.blackKing = false;
    if (selectedRow === 7 && selectedCol === 0) castlingRights.whiteRookA = false;
    if (selectedRow === 7 && selectedCol === 7) castlingRights.whiteRookH = false;
    if (selectedRow === 0 && selectedCol === 0) castlingRights.blackRookA = false;
    if (selectedRow === 0 && selectedCol === 7) castlingRights.blackRookH = false;

    // Track en passant
    const movedPiece = board[row][col];
    if ((movedPiece === 'P' || movedPiece === 'p') && Math.abs(row - selectedRow) === 2) {
        enPassantTarget = [(row + selectedRow) / 2, col];
    } else {
        enPassantTarget = null;
    }

    // Switch turns
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    selectedSquare = null;
    startTimer();

    const promotedPiece = board[row][col];
    if ((promotedPiece === 'P' && row === 0) || (promotedPiece === 'p' && row === 7)) {
        // whoMoved is the color that just made this move — captured BEFORE the turn
        // switch above. That's the correct way to know if this was the computer's
        // own promotion. currentTurn has already flipped by this point, so checking
        // against it here (as the old code did) answers "whose turn is it NEXT",
        // not "who just moved" — that was backwards.
        const promotionColor = promotedPiece === 'P' ? 'white' : 'black';
        const isComputersOwnMove = gameMode === 'computer' && whoMoved !== playerColor;

        renderBoard();
        if (fromRect) animateMove(fromRect, row, col);
        playSound(isCapture ? 'capture' : 'move');
        handlePromotion(row, col, promotionColor, isComputersOwnMove, (chosenPiece) => {
            // Now that we know the chosen piece, log the complete notation (e.g. "e8=Q")
            addMoveToHistory(notation + '=' + chosenPiece.toUpperCase(), whoMoved);
            finishTurnAfterMove(fromRect, row, col, isCapture);
        });
        return;
    }

    // Non-promotion moves log immediately; promotion moves log above, once the piece is known
    addMoveToHistory(notation, whoMoved);

    finishTurnAfterMove(fromRect, row, col, isCapture, castleRookAnim);

    } catch (err) {
        // A crash anywhere above lands here instead of silently freezing the game.
        // This is the exact error + stack trace to look for in DevTools → Console.
        console.error('Move crashed:', err);
        stopTimer();
        gameIsOver = true;
        alert('Something went wrong with that move. Open the browser Console (F12) and copy the red error text — that tells us exactly what broke. Click Restart to start a new game.');
    }
}

// ─── Move Validation ──────────────────────────────────────────
function isValidMove(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    const target = board[toRow][toCol];

    if (target && (
        (piece === piece.toUpperCase() && target === target.toUpperCase()) ||
        (piece === piece.toLowerCase() && target === target.toLowerCase())
    )) return false;

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRow = Math.abs(rowDiff);
    const absCol = Math.abs(colDiff);
    const p = piece.toLowerCase();

    let moveOk = false;

    if (p === 'r') {
        if (rowDiff !== 0 && colDiff !== 0) return false;
        moveOk = !hasBlockingPiece(fromRow, fromCol, toRow, toCol);
    }
    else if (p === 'b') {
        if (absRow !== absCol) return false;
        moveOk = !hasBlockingPiece(fromRow, fromCol, toRow, toCol);
    }
    else if (p === 'q') {
        const isStraight = rowDiff === 0 || colDiff === 0;
        const isDiagonal = absRow === absCol;
        if (!isStraight && !isDiagonal) return false;
        moveOk = !hasBlockingPiece(fromRow, fromCol, toRow, toCol);
    }
    else if (p === 'n') {
        moveOk = (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
    }
    else if (p === 'k') {
        if (absRow <= 1 && absCol <= 1 && (absRow + absCol) > 0) {
            moveOk = true;
        }
        else if (absRow === 0 && absCol === 2) {
            const isWhite = piece === 'K';
            const kingRow = isWhite ? 7 : 0;
            if (fromRow !== kingRow || fromCol !== 4) { moveOk = false; }
            else if (toCol === 6) {
                const canCastle = isWhite
                    ? castlingRights.whiteKing && castlingRights.whiteRookH
                    : castlingRights.blackKing && castlingRights.blackRookH;
                if (!canCastle) { moveOk = false; }
                else if (board[kingRow][5] !== '' || board[kingRow][6] !== '') { moveOk = false; }
                else if (isInCheck(isWhite ? 'white' : 'black')) { moveOk = false; }
                else if (isSquareUnderAttack(kingRow, 5, isWhite ? 'white' : 'black')) { moveOk = false; }
                else if (isSquareUnderAttack(kingRow, 6, isWhite ? 'white' : 'black')) { moveOk = false; }
                else { moveOk = true; }
            }
            else if (toCol === 2) {
                const canCastle = isWhite
                    ? castlingRights.whiteKing && castlingRights.whiteRookA
                    : castlingRights.blackKing && castlingRights.blackRookA;
                if (!canCastle) { moveOk = false; }
                else if (board[kingRow][1] !== '' || board[kingRow][2] !== '' || board[kingRow][3] !== '') { moveOk = false; }
                else if (isInCheck(isWhite ? 'white' : 'black')) { moveOk = false; }
                else if (isSquareUnderAttack(kingRow, 3, isWhite ? 'white' : 'black')) { moveOk = false; }
                else if (isSquareUnderAttack(kingRow, 2, isWhite ? 'white' : 'black')) { moveOk = false; }
                else { moveOk = true; }
            }
            else { moveOk = false; }
        }
        else { moveOk = false; }
    }
    else if (p === 'p') {
        const direction = piece === 'P' ? -1 : 1;
        const startRow = piece === 'P' ? 6 : 1;
        if (colDiff === 0 && rowDiff === direction && !target)
            moveOk = true;
        else if (colDiff === 0 && rowDiff === direction * 2 && fromRow === startRow && !target)
            moveOk = !hasBlockingPiece(fromRow, fromCol, toRow, toCol);
        else if (absCol === 1 && rowDiff === direction && target)
            moveOk = true;
        else if (absCol === 1 && rowDiff === direction &&
                 enPassantTarget &&
                 toRow === enPassantTarget[0] &&
                 toCol === enPassantTarget[1]) {
            moveOk = true;
        }
        else moveOk = false;
    }

    if (!moveOk) return false;

    const saved = board[toRow][toCol];
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = '';
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    const leavesInCheck = isInCheck(color);
    board[fromRow][fromCol] = piece;
    board[toRow][toCol] = saved;

    return !leavesInCheck;
}

// ─── Attack Helpers ───────────────────────────────────────────
function isSquareUnderAttack(row, col, defendingColor) {
    const enemyColor = defendingColor === 'white' ? 'black' : 'white';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            const isEnemy = enemyColor === 'white'
                ? piece === piece.toUpperCase()
                : piece === piece.toLowerCase();
            if (!isEnemy) continue;
            if (canAttackSquare(r, c, row, col)) return true;
        }
    }
    return false;
}

function canAttackSquare(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRow = Math.abs(rowDiff);
    const absCol = Math.abs(colDiff);
    const p = piece.toLowerCase();

    if (p === 'r') {
        if (rowDiff !== 0 && colDiff !== 0) return false;
        return !hasBlockingPiece(fromRow, fromCol, toRow, toCol);
    }
    if (p === 'b') {
        if (absRow !== absCol) return false;
        return !hasBlockingPiece(fromRow, fromCol, toRow, toCol);
    }
    if (p === 'q') {
        const isStraight = rowDiff === 0 || colDiff === 0;
        const isDiagonal = absRow === absCol;
        if (!isStraight && !isDiagonal) return false;
        return !hasBlockingPiece(fromRow, fromCol, toRow, toCol);
    }
    if (p === 'n') return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
    if (p === 'k') return absRow <= 1 && absCol <= 1 && (absRow + absCol) > 0;
    if (p === 'p') {
        const direction = piece === 'P' ? -1 : 1;
        return absCol === 1 && rowDiff === direction;
    }
    return false;
}

// ─── Blocking Piece ───────────────────────────────────────────
function hasBlockingPiece(fromRow, fromCol, toRow, toCol) {
    const rowStep = fromRow === toRow ? 0 : (toRow - fromRow) / Math.abs(toRow - fromRow);
    const colStep = fromCol === toCol ? 0 : (toCol - fromCol) / Math.abs(toCol - fromCol);
    let r = fromRow + rowStep;
    let c = fromCol + colStep;
    while (r !== toRow || c !== toCol) {
        if (board[r][c] !== '') return true;
        r += rowStep;
        c += colStep;
    }
    return false;
}

// ─── Check Detection ──────────────────────────────────────────
function findKing(color) {
    const kingLetter = color === 'white' ? 'K' : 'k';
    for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++)
            if (board[row][col] === kingLetter) return [row, col];
}

function isInCheck(color) {
    const king = findKing(color);
    if (!king) return false; // defensive — never crash if a king can't be found
    const [kingRow, kingCol] = king;
    const enemyColor = color === 'white' ? 'black' : 'white';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;
            const isEnemy = enemyColor === 'white'
                ? piece === piece.toUpperCase()
                : piece === piece.toLowerCase();
            if (!isEnemy) continue;
            // canAttackSquare checks the raw attack PATTERN only — no self-check
            // filtering. isValidMove (the old version of this line) also filters out
            // moves that would leave the ATTACKER's own king in check, which wrongly
            // hides real checks from pinned pieces: a pinned piece can't legally
            // move, but it still attacks/defends the square it's pinned along.
            if (canAttackSquare(row, col, kingRow, kingCol)) return true;
        }
    }
    return false;
}

function hasLegalMoves(color) {
    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = board[fromRow][fromCol];
            if (!piece) continue;
            const isFriendly = color === 'white'
                ? piece === piece.toUpperCase()
                : piece === piece.toLowerCase();
            if (!isFriendly) continue;
            for (let toRow = 0; toRow < 8; toRow++)
                for (let toCol = 0; toCol < 8; toCol++)
                    if (isValidMove(fromRow, fromCol, toRow, toCol)) return true;
        }
    }
    return false;
}

// ─── Insufficient Material Draw ────────────────────────────────
// True when NEITHER side has enough pieces left to force checkmate under any
// sequence of legal moves — a standard automatic draw, independent of whose
// turn it is or whether anyone currently has any legal moves. Checked every
// move, since it can happen mid-game (e.g. after a big trade), not just
// through stalemate.
function isInsufficientMaterial() {
    const pieces = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.toLowerCase() !== 'k') pieces.push({ piece, row, col });
        }
    }

    // A pawn, rook, or queen can always eventually help force mate — not a draw
    if (pieces.some(p => 'pqr'.includes(p.piece.toLowerCase()))) return false;

    if (pieces.length === 0) return true; // King vs King
    if (pieces.length === 1) return true; // King + one minor piece vs King (either side)

    if (pieces.length === 2) {
        const bothBishops = pieces.every(p => p.piece.toLowerCase() === 'b');
        if (!bothBishops) return false; // e.g. two knights, or bishop + knight — not automatically a draw
        // King + Bishop vs King + Bishop is only a forced draw if both bishops
        // sit on the same square color (light or dark) — bishops on opposite
        // colors can never even attack each other's squares, so mating nets
        // built from opposite-colored bishops remain theoretically possible.
        const squareColor = p => (p.row + p.col) % 2;
        return squareColor(pieces[0]) === squareColor(pieces[1]);
    }

    return false; // 3+ minor pieces left — not automatically insufficient
}

function finishTurnAfterMove(fromRect, row, col, isCapture, extraAnim) {
    if (isInsufficientMaterial()) {
        stopTimer();
        gameIsOver = true;
        updateTimers();
        renderBoard();
        if (fromRect) animateMove(fromRect, row, col);
        if (extraAnim) animateMove(extraAnim.rect, extraAnim.toRow, extraAnim.toCol);
        playSound('move');
        setTimeout(() => alert(`Draw! Neither side has enough material to checkmate. 🤝`), 100);
        return;
    }

    if (!hasLegalMoves(currentTurn)) {
        stopTimer();
        gameIsOver = true;
        updateTimers();
        renderBoard();
        if (fromRect) animateMove(fromRect, row, col);
        if (extraAnim) animateMove(extraAnim.rect, extraAnim.toRow, extraAnim.toCol);
        const winner = currentTurn === 'white' ? 'Black' : 'White';
        if (isInCheck(currentTurn)) {
            playSound('checkmate');
            setTimeout(() => alert(`Checkmate! ${winner} wins! 🏆`), 100);
        } else {
            playSound('move');
            setTimeout(() => alert(`Stalemate! It's a draw! 🤝`), 100);
        }
        return;
    }

    if (isInCheck(currentTurn)) {
        playSound('check');
    } else if (isCapture) {
        playSound('capture');
    } else {
        playSound('move');
    }

    renderBoard();
    if (fromRect) animateMove(fromRect, row, col);
    if (extraAnim) animateMove(extraAnim.rect, extraAnim.toRow, extraAnim.toCol);

    if (gameMode === 'computer' && !gameIsOver && currentTurn !== playerColor) {
        triggerComputerMove();
    }
}

// ─── Pawn Promotion ───────────────────────────────────────────
function handlePromotion(row, col, color, isComputerMove, onComplete) {
    const modal = document.getElementById('promotion-modal');
    const overlay = document.getElementById('promotion-overlay');
    const choices = document.getElementById('promotion-choices');
    if (!modal || !overlay || !choices) return false;

    const promotionPieces = color === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

    if (isComputerMove) {
        const chosenPiece = promotionPieces[0]; // always queen — no need to ask the human to choose for the AI
        board[row][col] = chosenPiece;
        if (onComplete) onComplete(chosenPiece);
        return false;
    }

    choices.innerHTML = '';
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');

    promotionPieces.forEach(p => {
        const btn = document.createElement('button');
        btn.innerHTML = pieces[p];
        btn.addEventListener('click', () => {
            board[row][col] = p;
            modal.classList.add('hidden');
            overlay.classList.add('hidden');
            if (onComplete) onComplete(p);
        });
        choices.appendChild(btn);
    });

    return true;
}

// ─── Buttons ──────────────────────────────────────────────────
cancelBtn.addEventListener('click', () => {
    selectedSquare = null;
    renderBoard();
});

restartBtn.addEventListener('click', () => {
    for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++)
            board[row][col] = startingBoard[row][col];
    moveHistory = [];
    future = [];
    moveLog = [];
    futureMoveLog = [];
    enPassantTarget = null;
    currentTurn = 'white';
    selectedSquare = null;
    gameIsOver = false;
    timers = { white: TIME_PER_PLAYER, black: TIME_PER_PLAYER };
    castlingRights = {
        whiteKing: true, whiteRookA: true, whiteRookH: true,
        blackKing: true, blackRookA: true, blackRookH: true
    };
    document.getElementById('move-history-list').innerHTML = '';
    updateTimers();
    startTimer();
    renderBoard();

    if (gameMode === 'computer' && playerColor === 'black') {
        triggerComputerMove();
    }
});

quitBtn.addEventListener('click', () => {
    if (window.confirm('Are you sure you want to quit?')) {
        window.location.href = 'index.html';
    }
});

backwardBtn.addEventListener('click', () => {
    if (moveHistory.length === 0) return;

    const lastMove = moveLog[moveLog.length - 1];
    if (lastMove) {
        futureMoveLog.push(lastMove);
        moveLog.pop();
    }

    future.push(board.map(row => [...row]));
    const lastBoard = moveHistory.pop();

    // Figure out what's about to visually move, and grab its CURRENT on-screen
    // position — this has to happen before the board array changes below.
    const slides = getBoardSlides(board, lastBoard);
    const anims = animateSlides(slides);

    for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++)
            board[row][col] = lastBoard[row][col];
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    selectedSquare = null;
    renderMoveHistoryList();
    renderBoard();

    anims.forEach(a => animateMove(a.rect, a.toRow, a.toCol));
});

forwardBtn.addEventListener('click', () => {
    if (future.length === 0) return;

    const nextMove = futureMoveLog.pop();
    if (nextMove) moveLog.push(nextMove);

    moveHistory.push(board.map(row => [...row]));
    const nextBoard = future.pop();

    const slides = getBoardSlides(board, nextBoard);
    const anims = animateSlides(slides);

    for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++)
            board[row][col] = nextBoard[row][col];
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    selectedSquare = null;
    renderMoveHistoryList();
    renderBoard();

    anims.forEach(a => animateMove(a.rect, a.toRow, a.toCol));
});

// ─── Start ────────────────────────────────────────────────────
updateTimers();
startTimer();
renderBoard();

if (gameMode === 'computer' && playerColor === 'black') {
    triggerComputerMove();
}