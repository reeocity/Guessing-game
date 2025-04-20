module.exports = {
    // Game settings
    MAX_PLAYERS: 10,
    TIME_LIMIT: 60, // seconds
    MAX_ATTEMPTS: 3,
    POINTS_PER_WIN: 10,
    
    // Game states
    GAME_STATES: {
        WAITING: 'waiting',
        PLAYING: 'playing',
        ENDED: 'ended'
    },
    
    // Messages
    MESSAGES: {
        GAME_FULL: 'Game is full',
        INVALID_NAME: 'Invalid player name',
        NAME_TAKEN: 'Player name already taken',
        NOT_ENOUGH_PLAYERS: 'Need at least 3 players to start the game',
        ONLY_GAME_MASTER: 'Only the game master can start the game',
        GAME_STARTED: 'Game started',
        GAME_ENDED: 'Game ended',
        ROUND_STARTED: 'Round started',
        ROUND_ENDED: 'Round ended',
        TIME_UP: 'Time\'s up',
        CORRECT_ANSWER: 'Correct answer',
        WRONG_ANSWER: 'Wrong answer',
        OUT_OF_ATTEMPTS: 'No more attempts left'
    },
    
    // UI settings
    UI: {
        POPUP_DURATION: 5000, // milliseconds
        MESSAGE_DURATION: 3000, // milliseconds
        ANIMATION_DURATION: 500 // milliseconds
    }
}; 