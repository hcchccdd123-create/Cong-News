module.exports = {
  apps: [{
    name: 'cong-news-dev',
    script: 'server.js',
    watch: true,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3001,  // 开发环境使用不同端口
      LOG_LEVEL: 'debug'
    },
    error_file: './logs/dev-error.log',
    out_file: './logs/dev-out.log',
    merge_logs: true,
    time: true
  }]
};
