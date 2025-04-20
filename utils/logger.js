const config = require('../config/gameConfig');

class Logger {
    static log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        switch (level.toLowerCase()) {
            case 'error':
                console.error(logMessage, data);
                break;
            case 'warn':
                console.warn(logMessage, data);
                break;
            case 'info':
                console.info(logMessage, data);
                break;
            case 'debug':
                console.debug(logMessage, data);
                break;
            default:
                console.log(logMessage, data);
        }
    }

    static error(message, data = {}) {
        this.log('error', message, data);
    }

    static warn(message, data = {}) {
        this.log('warn', message, data);
    }

    static info(message, data = {}) {
        this.log('info', message, data);
    }

    static debug(message, data = {}) {
        this.log('debug', message, data);
    }

    static gameEvent(event, data = {}) {
        this.info(`Game Event: ${event}`, data);
    }

    static playerEvent(event, player, data = {}) {
        this.info(`Player Event: ${event}`, { player, ...data });
    }
}

module.exports = Logger; 