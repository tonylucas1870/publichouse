/**
 * Check if a URL points to a video file
 */
export function isVideo(url) {
  if (!url) return false;
  const urlStr = typeof url === 'string' ? url : url.url;
  return urlStr.toLowerCase().includes('.mp4') || 
         urlStr.toLowerCase().includes('.mov') ||
         urlStr.toLowerCase().includes('.webm');
}

/**
 * Get content type from file or URL
 */
export function getContentType(fileOrUrl) {
  if (!fileOrUrl) return null;
  
  // Handle File objects
  if (fileOrUrl instanceof File) {
    // Special handling for MOV files
    if (fileOrUrl.type === 'video/quicktime') {
      return 'video';
    }
    return fileOrUrl.type.split('/')[0]; // Returns 'image' or 'video'
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
  const dimensions = size === 'small' ? 'height: 1.2em; width: auto' : 
                    size === 'medium' ? 'width: 100px; height: 100px' :
                    'width: 200px; height: 200px';

  if (type === 'video') {
    return `
      <div class="rounded bg-light d-flex align-items-center justify-content-center" 
           style="${dimensions}">
        ${showPlayIcon ? '<i class="fas fa-play"></i>' : ''}
      </div>
    `;
  }

  return `
    <img src="${url}" 
         alt="Media thumbnail" 
         class="rounded" 
         style="${dimensions}; object-fit: ${size === 'small' ? 'contain' : 'cover'}">
  `;
}