/**
 * Utility functions for video handling
 */

/**
 * Convert a video file to MP4 format
 * @param {File} file - The video file to convert
 * @returns {Promise<File>} The converted MP4 file
 */
export async function convertToMP4(file) {
  return new Promise((resolve, reject) => {
    // Create video element to load the file
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;

    // Create canvas and context for recording
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set up video metadata loading
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Start video playback
      video.play();
    };

    // When video can play, start recording
    video.oncanplay = () => {
      // Configure MediaRecorder
      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=h264',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });

      const chunks = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Create MP4 file from chunks
        const mp4Blob = new Blob(chunks, { type: 'video/mp4' });
        const mp4File = new File([mp4Blob], file.name.replace(/\.[^/.]+$/, '.mp4'), {
          type: 'video/mp4'
        });
        resolve(mp4File);
      };

      // Start recording
      mediaRecorder.start();

      // Draw video frames to canvas
      function drawFrame() {
        if (video.ended || video.paused) {
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      }

      drawFrame();
    };

    // Handle errors
    video.onerror = () => {
      reject(new Error('Failed to load video file'));
    };

    // Load the video file
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Check if a file needs conversion
 */
export function needsConversion(file) {
  return file.type === 'video/quicktime';
}