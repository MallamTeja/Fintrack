const { spawn } = require('child_process');

console.log('Starting FinTrack Application...');

const backend = spawn('npm', ['start'], { cwd: './backend', shell: true, stdio: 'inherit' });

backend.on('error', (err) => {
  console.error('Failed to start backend:', err);
});

backend.on('close', (code) => {
  console.log(`Backend process exited with code ${code}`);
});

setTimeout(() => {
  const frontend = spawn('npm', ['start'], { cwd: './frontend', shell: true, stdio: 'inherit' });

  frontend.on('error', (err) => {
    console.error('Failed to start frontend:', err);
  });

  frontend.on('close', (code) => {
    console.log(`Frontend process exited with code ${code}`);
  });

  console.log('FinTrack application is starting up!');
  console.log('Backend: http://localhost:5001/api');
  console.log('Frontend: http://localhost:3000');
}, 6000);
