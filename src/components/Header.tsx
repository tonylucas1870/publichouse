import React from 'react';
import { Camera } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white shadow-sm mb-4">
      <nav className="navbar navbar-light">
        <div className="container">
          <span className="navbar-brand d-flex align-items-center gap-2">
            <Camera className="text-primary" size={32} />
            <span className="h3 mb-0">CleanFind</span>
          </span>
        </div>
      </nav>
    </header>
  );
}