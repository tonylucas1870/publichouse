import React, { useState } from 'react';
import Header from './components/Header';
import UploadForm from './components/UploadForm';
import FindingsList from './components/FindingsList';
import type { Finding, UploadFormData } from './types';

function App() {
  const [findings, setFindings] = useState<Finding[]>([
    {
      id: '1',
      imageUrl: 'https://images.unsplash.com/photo-1611067584071-de90f808b6e4?auto=format&fit=crop&w=800&q=80',
      description: 'Gold ring found under the couch',
      location: 'Living Room',
      dateFound: '2024-03-12',
      status: 'pending'
    },
    {
      id: '2',
      imageUrl: 'https://images.unsplash.com/photo-1542295669297-4d352b042bca?auto=format&fit=crop&w=800&q=80',
      description: 'Vintage watch in desk drawer',
      location: 'Home Office',
      dateFound: '2024-03-11',
      status: 'claimed'
    }
  ]);

  const handleSubmit = (data: UploadFormData) => {
    const newFinding: Finding = {
      id: Date.now().toString(),
      imageUrl: URL.createObjectURL(data.image!),
      description: data.description,
      location: data.location,
      dateFound: new Date().toISOString().split('T')[0],
      status: 'pending'
    };
    setFindings(prev => [newFinding, ...prev]);
  };

  return (
    <div className="min-vh-100 bg-light">
      <Header />
      <main className="container py-4">
        <div className="row g-4">
          <div className="col-12 col-lg-4">
            <div className="card">
              <div className="card-body">
                <h2 className="card-title h5 mb-4">Report New Finding</h2>
                <UploadForm onSubmit={handleSubmit} />
              </div>
            </div>
          </div>
          
          <div className="col-12 col-lg-8">
            <h2 className="h5 mb-4">Recent Findings</h2>
            <FindingsList findings={findings} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;