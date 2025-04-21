// Load Socket.IO client
const socket = io({
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['polling', 'websocket'],
    path: '/socket.io/',
    withCredentials: false,
    forceNew: true
});

// Connect to the server
socket.connect();

// Handle connection errors
socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    addMessage("System", "❌ Connection error. Trying to reconnect...");
});

socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected after', attemptNumber, 'attempts');
    addMessage("System", "✅ Reconnected to the server!");
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('Reconnection attempt', attemptNumber);
    addMessage("System", `🔄 Reconnection attempt ${attemptNumber}...`);
});

socket.on('reconnect_error', (error) => {
    console.error('Reconnection error:', error);
    addMessage("System", "❌ Reconnection failed. Trying again...");
});

socket.on('reconnect_failed', () => {
    console.error('Reconnection failed');
    addMessage("System", "❌ Could not reconnect to the server. Please refresh the page.");
});

let currentPlayer = null;
let attemptsLeft = 3;

// Join game
document.getElementById("joinGame").addEventListener("click", () => {
    const playerName = document.getElementById("playerName").value.trim();
    if (playerName) {
        currentPlayer = playerName;
        socket.emit("joinGame", playerName);
        document.getElementById("joinGame").disabled = true;
        document.getElementById("playerName").disabled = true;
    }
});

// Update game state
socket.on("gameUpdated", (data) => {
    console.log("Game updated:", data);
    updatePlayersList(data.players, data.gameMaster);
    updateScoresList(data.scores);
    document.getElementById("playerCount").textContent = data.players.length;
    
    // Update game master controls visibility
    const gameMasterSection = document.getElementById("gameMasterSection");
    if (currentPlayer === data.gameMaster) {
        gameMasterSection.style.display = "block";
        addMessage("System", "👑 You are now the game master!");
    } else {
        gameMasterSection.style.display = "none";
    }
    
    // Update game state
    if (data.gameState === 'waiting') {
        document.getElementById("gameSession").style.display = "none";
    }
});

// Start game
document.getElementById("startGame").addEventListener("click", () => {
    const question = document.getElementById("question").value.trim();
    const answer = document.getElementById("answer").value.trim();
    
    console.log("Attempting to start game with:", { question, answer });
    
    if (question && answer) {
        socket.emit("startGame", { question, answer });
        document.getElementById("question").value = "";
        document.getElementById("answer").value = "";
    } else {
        console.log("Missing question or answer");
        addMessage("System", "❌ Please enter both a question and an answer!");
    }
});

// Handle game start response
socket.on("gameStarted", (data) => {
    console.log("Game started with data:", data);
    document.getElementById("gameSession").style.display = "block";
    document.getElementById("questionDisplay").textContent = data.question;
    document.getElementById("timeLeft").textContent = `⏱️ Time left: ${data.timeLeft} seconds`;
    document.getElementById("attemptsLeft").textContent = "🎯 Attempts left: 3";
    attemptsLeft = 3;
    
    // Ensure round number is properly displayed
    const roundNumber = data.round || 1;
    addMessage("System", `🎮 Round ${roundNumber} started! Good luck everyone!`);
    
    // Focus on answer input for players
    if (currentPlayer !== data.gameMaster) {
        document.getElementById("userAnswer").focus();
    }
});

// Time update
socket.on("timeUpdate", (timeLeft) => {
    document.getElementById("timeLeft").textContent = `⏱️ Time left: ${timeLeft} seconds`;
});

// Submit answer
document.getElementById("submitAnswer").addEventListener("click", () => {
    const userAnswer = document.getElementById("userAnswer").value.trim();
    if (userAnswer) {
        socket.emit("submitAnswer", { player: currentPlayer, answer: userAnswer });
        document.getElementById("userAnswer").value = "";
    }
});

// Add Enter key handler for answer submission
document.getElementById("userAnswer").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault(); // Prevent default form submission
        const userAnswer = e.target.value.trim();
        if (userAnswer) {
            socket.emit("submitAnswer", { player: currentPlayer, answer: userAnswer });
            e.target.value = "";
        }
    }
});

// Wrong answer
socket.on("wrongAnswer", (message) => {
    attemptsLeft--;
    document.getElementById("attemptsLeft").textContent = `Attempts left: ${attemptsLeft}`;
    addMessage("System", message);
});

// Out of attempts
socket.on("outOfAttempts", (message) => {
    addMessage("System", message);
    document.getElementById("submitAnswer").disabled = true;
});

// Add popup HTML to the page
const popupHTML = `
    <div id="answerPopup" class="popup">
        <div class="popup-content">
            <span class="close-popup">&times;</span>
            <h2>Round Answer</h2>
            <p id="popupAnswer"></p>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', popupHTML);

// Add popup styles
const style = document.createElement('style');
style.textContent = `
    .popup {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
        z-index: 1000;
    }
    .popup-content {
        background-color: #fefefe;
        margin: 15% auto;
        padding: 20px;
        border: 1px solid #888;
        width: 80%;
        max-width: 500px;
        border-radius: 8px;
        position: relative;
    }
    .close-popup {
        position: absolute;
        right: 10px;
        top: 5px;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
    }
    .close-popup:hover {
        color: red;
    }
`;
document.head.appendChild(style);

// Add popup functionality
document.querySelector('.close-popup').addEventListener('click', () => {
    document.getElementById('answerPopup').style.display = 'none';
});

socket.on("gameEnded", (data) => {
    // Hide game session
    document.getElementById("gameSession").style.display = "none";
    document.getElementById("submitAnswer").disabled = false;
    
    // Add game end message to chat
    let endMessage;
    if (data.winner) {
        if (data.isGameMasterWinner) {
            endMessage = `🎯 Game master ${data.winner} guessed correctly! The answer was: ${data.answer}`;
        } else {
            endMessage = `🏆 ${data.winner} won round ${data.round}! The answer was: ${data.answer}`;
        }
    } else {
        endMessage = `⏰ Time's up for round ${data.round}! The answer was: ${data.answer}`;
        // Show popup if no one answered
        document.getElementById('popupAnswer').textContent = `The answer was: ${data.answer}`;
        document.getElementById('answerPopup').style.display = 'block';
    }
    
    addMessage("System", endMessage);
    
    // Update scores
    updateScoresList(data.scores);
    
    // Handle game master controls
    const gameMasterSection = document.getElementById("gameMasterSection");
    const startGameButton = document.getElementById("startGame");
    const questionInput = document.getElementById("question");
    const answerInput = document.getElementById("answer");
    
    if (currentPlayer === data.gameMaster) {
        gameMasterSection.style.display = "block";
        startGameButton.disabled = false;
        questionInput.disabled = false;
        answerInput.disabled = false;
        addMessage("System", `👑 You are now the game master for round ${data.round + 1}!`);
        
        // Clear previous question and answer
        questionInput.value = "";
        answerInput.value = "";
        
        // Focus on question input for new game master
        questionInput.focus();
    } else {
        gameMasterSection.style.display = "none";
    }
});

// Handle game master updates
socket.on("gameMasterUpdated", (data) => {
    console.log("Game master updated:", data.gameMaster);
    updatePlayersList(data.players, data.gameMaster);
    updateScoresList(data.scores);
    
    // Update game master controls visibility
    const gameMasterSection = document.getElementById("gameMasterSection");
    if (currentPlayer === data.gameMaster) {
        gameMasterSection.style.display = "block";
        addMessage("System", "👑 You are now the game master!");
    } else {
        gameMasterSection.style.display = "none";
    }
});

// Handle errors
socket.on("error", (message) => {
    console.error("Server error:", message);
    addMessage("System", `❌ Error: ${message}`);
});

// Helper functions
function updatePlayersList(players, gameMaster) {
    const playersList = document.getElementById("playersList");
    playersList.innerHTML = "";
    players.forEach(player => {
        const li = document.createElement("li");
        li.textContent = player;
        if (player === gameMaster) {
            li.classList.add("game-master");
        }
        playersList.appendChild(li);
    });
}

function updateScoresList(scores) {
    const scoresList = document.getElementById("scoresList");
    scoresList.innerHTML = "";
    Object.entries(scores).forEach(([player, score]) => {
        const li = document.createElement("li");
        li.textContent = `${player}: ${score} points`;
        scoresList.appendChild(li);
    });
}

function addMessage(sender, message, isError = false) {
    const messagesDiv = document.getElementById("messages");
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");
    
    if (sender === currentPlayer) {
        messageDiv.classList.add("sent");
    } else if (sender !== "System") {
        messageDiv.classList.add("received");
    }
    
    if (isError) {
        messageDiv.classList.add("error");
    }
    
    const senderSpan = document.createElement("div");
    senderSpan.classList.add("sender");
    senderSpan.textContent = sender;
    
    const messageSpan = document.createElement("div");
    messageSpan.textContent = message;
    
    const timeSpan = document.createElement("div");
    timeSpan.classList.add("time");
    timeSpan.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(messageSpan);
    messageDiv.appendChild(timeSpan);
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Chat functionality
document.getElementById("userAnswer").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        const message = e.target.value.trim();
        if (message) {
            socket.emit("submitAnswer", { player: currentPlayer, answer: message });
            e.target.value = "";
        }
    }
});

socket.on("newMessage", (message) => {
    addMessage(message.player, message.message);
});
