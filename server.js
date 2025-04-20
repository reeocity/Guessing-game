const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let gameSession = {
    players: [],
    gameMaster: null,
    question: null,
    answer: null,
    started: false,
    scores: {},
    attempts: {},      // Track attempts per player
    timer: null,       // Game timer
    timeLeft: 60,      // Time left in seconds
    messages: [],      // Chat messages
    winner: null,      // Track winner
    round: 1          // Start with round 1
};

function resetGameSession() {
    gameSession = {
        players: [],
        gameMaster: null,
        question: null,
        answer: null,
        started: false,
        scores: {},
        attempts: {},
        timer: null,
        timeLeft: 60,
        messages: [],
        winner: null,
        round: 1       // Reset to round 1
    };
}

function endGame(winner) {
    // Clear the timer first
    if (gameSession.timer) {
        clearInterval(gameSession.timer);
        gameSession.timer = null;
    }

    gameSession.started = false;
    gameSession.winner = winner;
    
    // Only award points if the winner is not the game master
    if (winner && winner !== gameSession.gameMaster) {
        gameSession.scores[winner] = (gameSession.scores[winner] || 0) + 10;
    }
    
    // Create end message
    const endMessage = winner 
        ? winner === gameSession.gameMaster
            ? `Game master ${winner} guessed correctly! The answer was: ${gameSession.answer}`
            : `${winner} won round ${gameSession.round}! The answer was: ${gameSession.answer}`
        : `Time's up for round ${gameSession.round}! The answer was: ${gameSession.answer}`;
    
    // Add to chat
    const chatMessage = {
        player: "System",
        message: endMessage,
        timestamp: new Date()
    };
    gameSession.messages.push(chatMessage);
    io.emit("newMessage", chatMessage);
    
    // Rotate game master
    if (gameSession.players.length > 0) {
        const currentMasterIndex = gameSession.players.indexOf(gameSession.gameMaster);
        const nextMasterIndex = (currentMasterIndex + 1) % gameSession.players.length;
        gameSession.gameMaster = gameSession.players[nextMasterIndex];
    }
    
    // Send game end event to all players
    io.emit("gameEnded", {
        winner,
        answer: gameSession.answer,
        scores: gameSession.scores,
        timeExpired: !winner,
        gameMaster: gameSession.gameMaster,
        round: gameSession.round,
        isGameMasterWinner: winner === gameSession.gameMaster
    });

    // Increment round number
    gameSession.round++;
    
    // Reset game state for next round
    gameSession.question = null;
    gameSession.answer = null;
    gameSession.winner = null;
    gameSession.timeLeft = 60;
    gameSession.started = false;  // Ensure game is not started
    
    // Reset attempts for all players
    gameSession.players.forEach(player => {
        gameSession.attempts[player] = 0;
    });

    // Notify all players of the new game master
    io.emit("gameUpdated", {
        players: gameSession.players,
        gameMaster: gameSession.gameMaster,
        scores: gameSession.scores,
        round: gameSession.round
    });
}

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    let currentPlayer = null;

    socket.on("joinGame", (playerName) => {
        if (!gameSession.started) {
            if (!gameSession.players.includes(playerName)) {
                currentPlayer = playerName;
                gameSession.players.push(playerName);
                gameSession.scores[playerName] = 0;
                gameSession.attempts[playerName] = 0;
                
                if (!gameSession.gameMaster) {
                    gameSession.gameMaster = playerName;
                }
                
                io.emit("gameUpdated", gameSession);
            }
        }
    });

    socket.on("startGame", ({ question, answer }) => {
        if (currentPlayer === gameSession.gameMaster && gameSession.players.length > 2) {
            // Clear any existing timer
            if (gameSession.timer) {
                clearInterval(gameSession.timer);
                gameSession.timer = null;
            }

            gameSession.question = question;
            gameSession.answer = answer.toLowerCase();
            gameSession.started = true;
            gameSession.timeLeft = 60;
            gameSession.winner = null;
            
            // Reset attempts for all players
            gameSession.players.forEach(player => {
                gameSession.attempts[player] = 0;
            });

            // Start game timer
            gameSession.timer = setInterval(() => {
                gameSession.timeLeft--;
                io.emit("timeUpdate", gameSession.timeLeft);
                
                if (gameSession.timeLeft <= 0) {
                    endGame(null);
                }
            }, 1000);

            io.emit("gameStarted", {
                question,
                timeLeft: gameSession.timeLeft,
                round: gameSession.round
            });

            // Add game start message
            const startMessage = {
                player: "System",
                message: `Round ${gameSession.round} started! Question: ${question}`,
                timestamp: new Date()
            };
            gameSession.messages.push(startMessage);
            io.emit("newMessage", startMessage);
        } else if (gameSession.players.length <= 2) {
            socket.emit("error", "Need more than 2 players to start the game");
        } else if (currentPlayer !== gameSession.gameMaster) {
            socket.emit("error", "Only the game master can start the game");
        }
    });

    socket.on("submitAnswer", ({ player, answer }) => {
        if (gameSession.started && !gameSession.winner && gameSession.attempts[player] < 3) {
            gameSession.attempts[player]++;
            
            if (answer.toLowerCase() === gameSession.answer) {
                endGame(player);
            } else {
                const attemptsLeft = 3 - gameSession.attempts[player];
                socket.emit("wrongAnswer", `Incorrect! ${attemptsLeft} attempts left.`);
                
                if (gameSession.attempts[player] >= 3) {
                    socket.emit("outOfAttempts", "No more attempts left!");
                }
            }
        }
    });

    socket.on("sendMessage", ({ player, message }) => {
        if (gameSession.players.includes(player)) {
            const chatMessage = {
                player,
                message,
                timestamp: new Date()
            };
            gameSession.messages.push(chatMessage);
            io.emit("newMessage", chatMessage);
        }
    });

    socket.on("disconnect", () => {
        if (currentPlayer) {
            const index = gameSession.players.indexOf(currentPlayer);
            if (index > -1) {
                gameSession.players.splice(index, 1);
                delete gameSession.scores[currentPlayer];
                delete gameSession.attempts[currentPlayer];
                
                // If game master disconnects, assign new game master
                if (currentPlayer === gameSession.gameMaster && gameSession.players.length > 0) {
                    gameSession.gameMaster = gameSession.players[0];
                }
                
                // If all players left, reset game session
                if (gameSession.players.length === 0) {
                    resetGameSession();
                }
                
                io.emit("gameUpdated", gameSession);
            }
        }
        console.log("User disconnected");
    });
});

server.listen(5000, () => {
    console.log("Server running on http://localhost:5000");
});
