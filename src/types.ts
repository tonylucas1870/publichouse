export interface Finding {
  id: string;
  imageUrl: string;
  description: string;
  location: string;
  dateFound: string;
  status: 'pending' | 'claimed' | 'disposed';
}

export interface UploadFormData {
  description: string;
  location: string;
  image: File | null;
}