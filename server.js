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

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Configure CORS for Socket.IO with enhanced settings
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: false,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6, // 1MB
  path: '/socket.io/',
  serveClient: true,
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 2048
  }
});

// Add middleware to handle connection errors
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (socket.handshake.headers.origin === undefined) {
    return next(new Error('Origin not allowed'));
  }
  next();
});

// Error handling for the Socket.IO server
io.engine.on("connection_error", (err) => {
  console.log('Connection error:', err.req);
  console.log('Error code:', err.code);
  console.log('Error message:', err.message);
  console.log('Error context:', err.context);
});

// Serve Socket.IO client
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

// Initialize game components
const playerManager = new PlayerManager();
const gameSession = new GameSession();
const gameTimer = new GameTimer();
const questionManager = new QuestionManager();

// Track current game master
let currentGameMaster = null;

function updateGameMaster(newGameMaster) {
    currentGameMaster = newGameMaster;
    console.log("Game master updated to:", currentGameMaster);
    // Notify all players of the new game master
    io.emit("gameMasterUpdated", {
        gameMaster: currentGameMaster,
        players: playerManager.getPlayers(),
        scores: playerManager.getScores()
    });
}

function endGame(winner) {
    // Stop the timer
    gameTimer.stop();

    // End the current round
    gameSession.endRound(winner);
    
    // Award points if there's a winner who's not the game master
    if (winner && winner !== currentGameMaster) {
        playerManager.awardPoints(winner);
    }
    
    // Create end message
    const endMessage = winner 
        ? winner === currentGameMaster
            ? `Game master ${winner} guessed correctly! The answer was: ${questionManager.getAnswer()}`
            : `${winner} won round ${gameSession.round}! The answer was: ${questionManager.getAnswer()}`
        : `Time's up for round ${gameSession.round}! The answer was: ${questionManager.getAnswer()}`;
    
    // Add to chat
    gameSession.addMessage("System", endMessage);
    io.emit("newMessage", gameSession.messages[gameSession.messages.length - 1]);
    
    // Get the new game master
    const newGameMaster = playerManager.getNextGameMaster(currentGameMaster);
    
    // Update the game master
    updateGameMaster(newGameMaster);
    
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
        gameState: 'waiting'
    });
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Set up heartbeat to detect stale connections
  const heartbeat = setInterval(() => {
    socket.emit('ping');
  }, 25000);

  socket.on('pong', () => {
    socket.isAlive = true;
  });

  // Clean up on disconnect
  socket.on("disconnect", (reason) => {
    clearInterval(heartbeat);
    console.log(`Client ${socket.id} disconnected. Reason: ${reason}`);
    
    // Remove player from game if they were in one
    if (currentPlayer) {
        playerManager.removePlayer(currentPlayer);
        // If the disconnected player was the game master, assign a new one
        if (currentPlayer === currentGameMaster) {
            const newGameMaster = playerManager.getNextGameMaster(currentGameMaster);
            updateGameMaster(newGameMaster);
        }
        io.emit("gameUpdated", {
            players: playerManager.getPlayers(),
            gameMaster: currentGameMaster,
            scores: playerManager.getScores(),
            round: gameSession.round
        });
    }
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error(`Socket ${socket.id} error:`, error);
    socket.disconnect(true);
  });

  let currentPlayer = null;

  socket.on("joinGame", (playerName) => {
    try {
      if (!gameSession.started) {
        if (playerManager.addPlayer(playerName)) {
          currentPlayer = playerName;
          // Set initial game master if none exists
          if (!currentGameMaster) {
            const initialGameMaster = playerManager.getNextGameMaster(null);
            updateGameMaster(initialGameMaster);
          }
          io.emit("gameUpdated", {
            players: playerManager.getPlayers(),
            gameMaster: currentGameMaster,
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
      console.log("Start game attempt by:", currentPlayer);
      console.log("Current game master:", currentGameMaster);
      console.log("Player count:", playerManager.getPlayerCount());
      
      if (currentPlayer === currentGameMaster && playerManager.getPlayerCount() > 2) {
        console.log("Starting game with question:", question);
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
        console.log("Not enough players to start game");
        socket.emit("error", "Need more than 2 players to start the game");
      } else if (currentPlayer !== currentGameMaster) {
        console.log("Player is not the game master");
        socket.emit("error", "Only the game master can start the game");
      }
    } catch (error) {
      console.error("Error starting game:", error);
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
});

// Periodic cleanup of stale connections
setInterval(() => {
  io.sockets.sockets.forEach((socket) => {
    if (socket.isAlive === false) {
      return socket.disconnect(true);
    }
    socket.isAlive = false;
    socket.emit('ping');
  });
}, 30000);

// Export the Express API
module.exports = app;

// Start the server only if not running in a serverless environment
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
