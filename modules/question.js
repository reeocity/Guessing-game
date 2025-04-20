class QuestionManager {
    constructor() {
        this.question = null;
        this.answer = null;
    }

    setQuestion(question, answer) {
        this.question = question;
        this.answer = answer.toLowerCase();
    }

    checkAnswer(playerAnswer) {
        return playerAnswer.toLowerCase() === this.answer;
    }

    getQuestion() {
        return this.question;
    }

    getAnswer() {
        return this.answer;
    }

    clear() {
        this.question = null;
        this.answer = null;
    }
}

module.exports = QuestionManager; 