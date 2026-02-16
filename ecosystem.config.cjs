module.exports = {
  apps: [
    {
      name: 'eai-api',
      script: './src/server.js',
      cwd: '/home/deploy/evolved-ai/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      error_file: '/home/deploy/evolved-ai/logs/api-error.log',
      out_file: '/home/deploy/evolved-ai/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'eai-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/deploy/evolved-ai/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      error_file: '/home/deploy/evolved-ai/logs/web-error.log',
      out_file: '/home/deploy/evolved-ai/logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    }
  ]
};
