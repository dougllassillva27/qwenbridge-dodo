import 'dotenv/config'
import { startServer } from './api/server.js'

// Add timestamp to all console logs
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

function getTimestamp() {
  const now = new Date();
  const str = now.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo', 
    year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', second: '2-digit', 
    hour12: false 
  });
  const parts = str.replace(',', '').split(' ');
  if (parts.length === 2) {
    const [d, m, y] = parts[0].split('/');
    if (y && m && d) return `[${y}-${m}-${d} ${parts[1]}]`;
  }
  return `[${str}]`;
}

console.log = function (...args) {
  originalLog.apply(console, [getTimestamp(), ...args]);
};

console.error = function (...args) {
  originalError.apply(console, [getTimestamp(), ...args]);
};

console.warn = function (...args) {
  originalWarn.apply(console, [getTimestamp(), ...args]);
};

console.info = function (...args) {
  originalInfo.apply(console, [getTimestamp(), ...args]);
};

startServer().catch(error => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
