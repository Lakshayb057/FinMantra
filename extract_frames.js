const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');

const inputVideo = path.join(__dirname, 'look_at_the_screen_shot_for_th (1).mp4');
const outputDir = path.join(__dirname, 'frames');

// Extract 1 frame per second
const cmd = `"${ffmpegPath}" -i "${inputVideo}" -vf "fps=2" -q:v 2 "${path.join(outputDir, 'frame_%03d.jpg')}"`;
console.log('Running:', cmd);
try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('Frames extracted successfully!');
} catch(e) {
  console.error('Error:', e.message);
}
