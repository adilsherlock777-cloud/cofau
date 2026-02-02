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
      PYTHONUNBUFFERED: '1',
      GOOGLE_GEMINI_API_KEY: 'AIzaSyBpzW_w0s7BK0zfQb3KeP_uqgSUxBATh44',
      MONGO_URL: 'mongodb+srv://moinmisba92:quickSell%40121@quicksellify.mdhrm.mongodb.net/quickSellify?retryWrites=true&w=majority&appName=quickSellify',
      SECRET_KEY: 'your-secret-key-change-in-production-12345678',
      SIGHTENGINE_API_USER: '144214407',
      SIGHTENGINE_API_SECRET: 'JYA4RySafgQeKMUqnNGiQcdBFBuTKDk9'
    },
    error_file: '/root/backend/backend/logs/pm2-error.log',
    out_file: '/root/backend/backend/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};

