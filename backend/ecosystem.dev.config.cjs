module.exports = {
  apps: [
    {
      name: 'context-os-backend',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'dev -p 3002',
      interpreter: 'node',
      env_file: '.env.local',
      env: {
        NODE_ENV: 'development',
        PORT: '3002',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      time: true,
    },
  ],
}
