class GameSession {
    constructor() {
        this.reset();
    }

    reset() {
        this.started = false;
        this.question = null;
        this.answer = null;
        this.winner = null;
        this.round = 1;
        this.messages = [];
    }

    startRound(question, answer) {
        this.started = true;
        this.question = question;
        this.answer = answer.toLowerCase();
        this.winner = null;
    }

    endRound(winner) {
        this.started = false;
        this.winner = winner;
        this.round++;
        this.question = null;
        this.answer = null;
    }

    addMessage(player, message) {
        this.messages.push({
            player,
            message,
            timestamp: new Date()
        });
    }

    getState() {
        return {
            started: this.started,
            question: this.question,
            answer: this.answer,
            winner: this.winner,
            round: this.round,
            messages: this.messages
        };
    }
}

module.exports = GameSession; 