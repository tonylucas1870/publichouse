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
    let recorder = null;

    // Set up video metadata loading
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Try to get supported MIME type
      const mimeTypes = [
        'video/mp4;codecs=h264',
        'video/webm;codecs=h264',
        'video/webm'
      ];

      let mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) {
        reject(new Error('No supported video format found'));
        return;
      }

      console.debug('VideoUtils: Using MIME type', { mimeType });

      try {
        // Configure MediaRecorder with supported type
        recorder = new MediaRecorder(canvas.captureStream(30), {
          mimeType,
          videoBitsPerSecond: 2500000 // 2.5 Mbps
        });

        // Start video playback
        video.play();
      } catch (error) {
        console.error('VideoUtils: MediaRecorder error:', error);
        reject(error);
      }
    };

    // When video can play, start recording
    video.oncanplay = () => {
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Create file with correct MIME type
        const outputType = recorder.mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
        const extension = outputType === 'video/mp4' ? '.mp4' : '.webm';
        
        const blob = new Blob(chunks, { type: outputType });
        console.debug('VideoUtils: Created converted video', {
          type: outputType,
          size: blob.size,
          extension
        });

        const mp4File = new File([blob], file.name.replace(/\.[^/.]+$/, '.mp4'), {
          type: outputType
        });
        resolve(mp4File);
      };

      // Start recording
      recorder.start();

      // Draw video frames to canvas
      function drawFrame() {
        if (video.ended || video.paused) {
          recorder.stop();
          canvas.captureStream().getTracks().forEach(track => track.stop());
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
  // Check for QuickTime/MOV files
  return file.type === 'video/quicktime' || 
         file.name.toLowerCase().endsWith('.mov');
}