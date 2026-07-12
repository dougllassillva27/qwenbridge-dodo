export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DANGER' | 'CAPTCHA' | 'SLEEP' | 'WAKEUP' | 'AUTH' | 'RATE-LIMIT' | 'SESSION';

export const Logger = {
  log(level: LogLevel, message: string) {
    const now = new Date();
    // Formato: YYYY-MM-DD HH:mm:ss
    const timestamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    const formattedMessage = `[${timestamp}] [${level}] ${message}`;

    switch (level) {
      case 'ERROR':
      case 'DANGER':
        console.error(formattedMessage);
        break;
      case 'WARN':
      case 'RATE-LIMIT':
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
        break;
    }
  },

  info(...args: any[]) { this.log('INFO', args.join(' ')); },
  warn(...args: any[]) { this.log('WARN', args.join(' ')); },
  error(...args: any[]) { this.log('ERROR', args.join(' ')); },
  success(...args: any[]) { this.log('SUCCESS', args.join(' ')); },
  danger(...args: any[]) { this.log('DANGER', args.join(' ')); },
  captcha(...args: any[]) { this.log('CAPTCHA', args.join(' ')); },
  sleep(...args: any[]) { this.log('SLEEP', args.join(' ')); },
  wakeup(...args: any[]) { this.log('WAKEUP', args.join(' ')); },
  auth(...args: any[]) { this.log('AUTH', args.join(' ')); },
  rateLimit(...args: any[]) { this.log('RATE-LIMIT', args.join(' ')); },
  session(...args: any[]) { this.log('SESSION', args.join(' ')); }
};
