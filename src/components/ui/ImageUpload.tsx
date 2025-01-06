import React from 'react';
import { Upload } from 'lucide-react';

interface ImageUploadProps {
  preview: string | null;
  onImageClick: () => void;
}

export default function ImageUpload({ preview, onImageClick }: ImageUploadProps) {
  return (
    <div 
      onClick={onImageClick}
      className="upload-area p-4 text-center"
    >
      {preview ? (
        <img 
          src={preview} 
          alt="Preview" 
          className="img-fluid rounded" 
          style={{ maxHeight: '200px' }}
        />
      ) : (
        <div className="py-4">
          <Upload size={32} className="text-muted mb-2" />
          <p className="text-muted mb-0">Click to upload an image</p>
        </div>
      )}
    </div>
  );
}