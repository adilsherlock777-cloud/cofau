module.exports = {
  apps: [{
    name: 'cofau-backend',
    script: 'venv/bin/uvicorn',
    args: 'app:app --host 0.0.0.0 --port 8000',
    cwd: '/root/backend/backend',
    interpreter: 'none',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PYTHONUNBUFFERED: '1'
    },
    error_file: '/root/backend/backend/logs/pm2-error.log',
    out_file: '/root/backend/backend/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};

