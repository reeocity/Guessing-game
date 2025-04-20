class PlayerManager {
    constructor() {
        this.players = [];
        this.scores = {};
        this.attempts = {};
        this.MAX_PLAYERS = 10; // Maximum number of players allowed
    }

    addPlayer(playerName) {
        // Validate player name
        if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
            throw new Error('Invalid player name');
        }

        // Check if game is full
        if (this.players.length >= this.MAX_PLAYERS) {
            throw new Error('Game is full');
        }

        // Check if player name is already taken
        if (this.players.includes(playerName)) {
            throw new Error('Player name already taken');
        }

        this.players.push(playerName);
        this.scores[playerName] = 0;
        this.attempts[playerName] = 0;
        return true;
    }

    removePlayer(playerName) {
        if (!playerName || !this.players.includes(playerName)) {
            throw new Error('Player not found');
        }

        const index = this.players.indexOf(playerName);
        this.players.splice(index, 1);
        delete this.scores[playerName];
        delete this.attempts[playerName];
        return true;
    }

    getNextGameMaster(currentGameMaster) {
        if (this.players.length === 0) return null;
        const currentIndex = this.players.indexOf(currentGameMaster);
        const nextIndex = (currentIndex + 1) % this.players.length;
        return this.players[nextIndex];
    }

    resetAttempts() {
        this.players.forEach(player => {
            this.attempts[player] = 0;
        });
    }

    awardPoints(player, points = 10) {
        if (!this.players.includes(player)) {
            throw new Error('Player not found');
        }
        this.scores[player] = (this.scores[player] || 0) + points;
        return this.scores[player];
    }

    getPlayerCount() {
        return this.players.length;
    }

    getScores() {
        return { ...this.scores }; // Return a copy to prevent direct modification
    }

    getPlayers() {
        return [...this.players]; // Return a copy to prevent direct modification
    }

    isValidPlayer(playerName) {
        return this.players.includes(playerName);
    }

    getPlayerAttempts(playerName) {
        if (!this.isValidPlayer(playerName)) {
            throw new Error('Player not found');
        }
        return this.attempts[playerName];
    }
}

module.exports = PlayerManager; 