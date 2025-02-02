/**
 * Utility functions for handling media files
 */

/**
 * Check if a URL points to a video file
 */
export function isVideo(url) {
  if (!url) return false;
  const urlStr = typeof url === 'string' ? url : url.url;
  return urlStr.toLowerCase().includes('.mp4') || urlStr.toLowerCase().includes('.webm');
}

/**
 * Get content type from file or URL
 */
export function getContentType(fileOrUrl) {
  if (!fileOrUrl) return null;
  
  // Handle File objects
  if (fileOrUrl instanceof File) {
    return fileOrUrl.type;
  }
  
  // Handle URLs
  const url = typeof fileOrUrl === 'string' ? fileOrUrl : fileOrUrl.url;
  if (isVideo(url)) {
    return 'video';
  }
  return 'image';
}

/**
 * Render a media thumbnail
 */
export function renderMediaThumbnail({ url, size = 'medium', showPlayIcon = true }) {
  const type = getContentType(url);
  const dimensions = size === 'small' ? 'width: 60px; height: 60px' : 
                    size === 'medium' ? 'width: 100px; height: 100px' :
                    'width: 200px; height: 200px';

  if (type === 'video') {
    return `
      <div class="rounded bg-light d-flex align-items-center justify-content-center" 
           style="${dimensions}">
        ${showPlayIcon ? '<i class="fas fa-play-circle fa-2x text-muted"></i>' : ''}
      </div>
    `;
  }

  return `
    <img src="${url}" 
         alt="Media thumbnail" 
         class="rounded" 
         style="${dimensions}; object-fit: cover">
  `;
}

/**
 * Calculates SHA-256 hash of a file
 * @param {File} file The file to hash
 * @returns {Promise<string>} The hex-encoded hash
 */
export async function calculateFileHash(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        resolve(hashHex);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}