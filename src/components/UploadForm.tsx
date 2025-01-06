import React, { useState } from 'react';
import { MapPin, Type } from 'lucide-react';
import type { UploadFormData } from '../types';
import ImageUpload from './ui/ImageUpload';

interface UploadFormProps {
  onSubmit: (data: UploadFormData) => void;
}

export default function UploadForm({ onSubmit }: UploadFormProps) {
  const [formData, setFormData] = useState<UploadFormData>({
    description: '',
    location: '',
    image: null,
  });
  const [preview, setPreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, image: file }));
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ description: '', location: '', image: null });
    setPreview(null);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="description" className="form-label d-flex align-items-center gap-2">
          <Type size={20} className="text-muted" />
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="form-control"
          placeholder="Describe the item you found..."
          required
          rows={3}
        />
      </div>

      <div className="mb-3">
        <label htmlFor="location" className="form-label d-flex align-items-center gap-2">
          <MapPin size={20} className="text-muted" />
          Location Found
        </label>
        <input
          type="text"
          id="location"
          value={formData.location}
          onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
          className="form-control"
          placeholder="e.g., Master Bedroom, Kitchen..."
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="image" className="form-label d-flex align-items-center gap-2">
          <input
            type="file"
            id="image"
            accept="image/*"
            onChange={handleImageChange}
            className="d-none"
            required
          />
        </label>
        <ImageUpload 
          preview={preview}
          onImageClick={() => document.getElementById('image')?.click()}
        />
      </div>

      <button type="submit" className="btn btn-primary w-100">
        Submit Finding
      </button>
    </form>
  );
}