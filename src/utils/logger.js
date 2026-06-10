const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs   = require('fs');

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const fmt = format.printf(({ level, message, timestamp, stack }) =>
  `${timestamp} [${level.toUpperCase()}]: ${stack || message}`
);

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.errors({ stack: true }), fmt),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.timestamp({ format: 'HH:mm:ss' }), fmt),
    }),
    new transports.File({ filename: path.join(logDir, 'error.log'),    level: 'error' }),
    new transports.File({ filename: path.join(logDir, 'combined.log') }),
  ],
});

module.exports = logger;
