import 'dotenv/config'
import { setupGlobalConsoleTimestamps } from './core/logger.js'
import { startServer } from './api/server.js'

setupGlobalConsoleTimestamps()

startServer().catch(error => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
