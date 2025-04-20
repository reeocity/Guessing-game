class GameTimer {
    constructor(timeLimit = 60) {
        this.timeLimit = timeLimit;
        this.timeLeft = timeLimit;
        this.timer = null;
        this.callback = null;
    }

    start(callback) {
        this.callback = callback;
        this.timeLeft = this.timeLimit;
        this.timer = setInterval(() => {
            this.timeLeft--;
            if (this.callback) {
                this.callback(this.timeLeft);
            }
            if (this.timeLeft <= 0) {
                this.stop();
            }
        }, 1000);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    reset() {
        this.stop();
        this.timeLeft = this.timeLimit;
    }

    getTimeLeft() {
        return this.timeLeft;
    }
}

module.exports = GameTimer; 