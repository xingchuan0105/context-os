// PM2 配置文件
// 用于生产环境进程管理

module.exports = {
  apps: [
    {
      name: 'context-os',
      script: 'npm',
      args: 'start',
      cwd: '/path/to/context-os',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/context-os/error.log',
      out_file: '/var/log/context-os/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 日志轮转
      log_file_pattern: '/var/log/context-os/<app_name>-<date>.log',
    },
  ],
}
