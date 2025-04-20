const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
require('dotenv').config();

// Import modules
const PlayerManager = require("./modules/player");
const GameSession = require("./modules/gameSession");
const GameTimer = require("./modules/timer");
const QuestionManager = require("./modules/question");

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" 
      ? process.env.CORS_ORIGIN_PROD 
      : process.env.CORS_ORIGIN_DEV,
    methods: ["GET", "POST"],
    credentials: true
  },
  path: process.env.SOCKET_PATH,
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT),
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL)
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Initialize game components
const playerManager = new PlayerManager();
const gameSession = new GameSession();
const gameTimer = new GameTimer();
const questionManager = new QuestionManager();

function endGame(winner) {
    // Stop the timer
    gameTimer.stop();

    // End the current round
    gameSession.endRound(winner);
    
    // Award points if there's a winner who's not the game master
    if (winner && winner !== playerManager.getNextGameMaster(winner)) {
        playerManager.awardPoints(winner);
    }
    
    // Create end message
    const endMessage = winner 
        ? winner === playerManager.getNextGameMaster(winner)
            ? `Game master ${winner} guessed correctly! The answer was: ${questionManager.getAnswer()}`
            : `${winner} won round ${gameSession.round}! The answer was: ${questionManager.getAnswer()}`
        : `Time's up for round ${gameSession.round}! The answer was: ${questionManager.getAnswer()}`;
    
    // Add to chat
    gameSession.addMessage("System", endMessage);
    io.emit("newMessage", gameSession.messages[gameSession.messages.length - 1]);
    
    // Get the new game master before sending game end event
    const newGameMaster = playerManager.getNextGameMaster(winner);
    
    // Send game end event to all players
    io.emit("gameEnded", {
        winner,
        answer: questionManager.getAnswer(),
        scores: playerManager.getScores(),
        timeExpired: !winner,
        gameMaster: newGameMaster,
        round: gameSession.round,
        isGameMasterWinner: winner === newGameMaster
    });

    // Reset for next round
    questionManager.clear();
    playerManager.resetAttempts();

    // Notify all players of the new game state
    io.emit("gameUpdated", {
        players: playerManager.getPlayers(),
        gameMaster: newGameMaster,
        scores: playerManager.getScores(),
        round: gameSession.round,
        gameState: 'waiting'  // Always set to waiting after round ends
    });
}

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    let currentPlayer = null;

    socket.on("joinGame", (playerName) => {
        try {
            if (!gameSession.started) {
                if (playerManager.addPlayer(playerName)) {
                    currentPlayer = playerName;
                    const gameMaster = playerManager.getNextGameMaster(null);
                    io.emit("gameUpdated", {
                        players: playerManager.getPlayers(),
                        gameMaster: gameMaster,
                        scores: playerManager.getScores(),
                        round: gameSession.round,
                        gameState: 'waiting'
                    });
                }
            }
        } catch (error) {
            socket.emit("error", error.message);
        }
    });

    socket.on("startGame", ({ question, answer }) => {
        try {
            const currentGameMaster = playerManager.getNextGameMaster(null);
            if (currentPlayer === currentGameMaster && playerManager.getPlayerCount() > 2) {
                questionManager.setQuestion(question, answer);
                gameSession.startRound(question, answer);
                
                // Start the timer
                gameTimer.start((timeLeft) => {
                    io.emit("timeUpdate", timeLeft);
                    if (timeLeft <= 0) {
                        endGame(null);
                    }
                });

                io.emit("gameStarted", {
                    question,
                    timeLeft: gameTimer.getTimeLeft(),
                    round: gameSession.round,
                    gameMaster: currentGameMaster
                });

                gameSession.addMessage("System", `Round ${gameSession.round} started! Question: ${question}`);
                io.emit("newMessage", gameSession.messages[gameSession.messages.length - 1]);

                // Update game state for all players
                io.emit("gameUpdated", {
                    players: playerManager.getPlayers(),
                    gameMaster: currentGameMaster,
                    scores: playerManager.getScores(),
                    round: gameSession.round,
                    gameState: 'playing'
                });
            } else if (playerManager.getPlayerCount() <= 2) {
                socket.emit("error", "Need more than 2 players to start the game");
            } else if (currentPlayer !== currentGameMaster) {
                socket.emit("error", "Only the game master can start the game");
            }
        } catch (error) {
            socket.emit("error", error.message);
        }
    });

    socket.on("submitAnswer", ({ player, answer }) => {
        if (gameSession.started && !gameSession.winner && playerManager.attempts[player] < 3) {
            playerManager.attempts[player]++;
            
            if (questionManager.checkAnswer(answer)) {
                endGame(player);
            } else {
                const attemptsLeft = 3 - playerManager.attempts[player];
                socket.emit("wrongAnswer", `Incorrect! ${attemptsLeft} attempts left.`);
                
                if (playerManager.attempts[player] >= 3) {
                    socket.emit("outOfAttempts", "No more attempts left!");
                }
            }
        }
    });

    socket.on("sendMessage", ({ player, message }) => {
        if (playerManager.getPlayers().includes(player)) {
            gameSession.addMessage(player, message);
            io.emit("newMessage", gameSession.messages[gameSession.messages.length - 1]);
        }
    });

    socket.on("disconnect", () => {
        if (currentPlayer) {
            playerManager.removePlayer(currentPlayer);
            io.emit("gameUpdated", {
                players: playerManager.getPlayers(),
                gameMaster: playerManager.getNextGameMaster(null),
                scores: playerManager.getScores(),
                round: gameSession.round
            });
        }
        console.log("User disconnected");
    });
});

// Update the server.listen to work with Vercel
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`CORS origin: ${process.env.NODE_ENV === "production" ? process.env.CORS_ORIGIN_PROD : process.env.CORS_ORIGIN_DEV}`);
});

// Export the Express API
module.exports = app;
