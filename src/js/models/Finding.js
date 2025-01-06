export class Finding {
  constructor({ id, imageUrl, description, location, dateFound, status }) {
    this.id = id || Date.now().toString();
    this.imageUrl = imageUrl;
    this.description = description;
    this.location = location;
    this.dateFound = dateFound || new Date().toISOString().split('T')[0];
    this.status = status || 'pending';
  }

  static createFromForm(formData, imageUrl) {
    return new Finding({
      imageUrl,
      description: formData.get('description'),
      location: formData.get('location')
    });
  }
}