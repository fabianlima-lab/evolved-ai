module.exports = {
  apps: [
    {
      name: 'evolved-backend',
      script: './src/server.js',
      cwd: '/opt/evolved-ai/backend',
      interpreter: 'node',
      interpreter_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 15,           // Stop restart loop after 15 crashes
      min_uptime: '10s',          // Must run 10s to count as "started"
      restart_delay: 2000,        // 2s between restarts (backoff)
      max_memory_restart: '512M', // Restart if memory exceeds 512MB
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DDTHH:mm:ss',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 10000,        // 10s to clean up before SIGKILL
      listen_timeout: 15000,      // 15s to start listening

      // Watch for unhandled crashes
      exp_backoff_restart_delay: 1000, // Exponential backoff on repeated crashes
    },
  ],
};
