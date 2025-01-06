# CleanFind

A property management system for tracking changeovers, findings, and maintenance across multiple properties.

## Architecture

### Core Services

- **AuthService**: Handles user authentication and authorization using Supabase Auth
- **FindingsService**: Manages findings, images, and notes
- **ChangeoverService**: Handles changeover scheduling and status management
- **PropertyService**: Manages property details and access control
- **RoomService**: Handles room management and contents
- **IconService**: Provides consistent icon usage throughout the app

### Database Schema

#### Properties
- Properties owned by users
- Supports multiple access levels (owner, cleaner, maintenance, admin)
- Tracks calendar sync status and utilities

#### Changeovers
- Scheduled cleaning/maintenance events
- Status tracking (scheduled, in_progress, complete)
- Shareable links for external access

#### Findings
- Items found during changeovers
- Multiple image support with upload timestamps
- Notes and status tracking
- Links to room contents

#### Rooms
- Property subdivisions
- Contents inventory
- Wall and lighting details

### Key Features

1. **Property Management**
   - Multiple properties per user
   - Room and utility tracking
   - Calendar integration

2. **Changeover Scheduling**
   - Date-based scheduling
   - Status tracking
   - Shareable access links

3. **Finding Reports**
   - Multi-image uploads
   - Status tracking (pending, fixed, won't fix)
   - Notes and comments
   - Content item linking

4. **Room Contents**
   - Inventory tracking
   - Image galleries
   - Finding history

### Security

- Row Level Security (RLS) policies for all tables
- Property-based access control
- Secure file uploads
- Share token system for external access

### UI Components

#### Core Components
- Modal system for dialogs
- Collapsible sections
- Image carousels
- Status badges

#### Forms
- Finding upload
- Room contents
- Property management
- Changeover scheduling

### File Structure

```
src/
├── js/
│   ├── auth/           # Authentication logic
│   ├── components/     # UI components
│   │   ├── auth/       # Auth-related components
│   │   ├── changeover/ # Changeover components
│   │   ├── findings/   # Finding components
│   │   ├── property/   # Property components
│   │   ├── room/       # Room components
│   │   └── ui/         # Shared UI components
│   ├── lib/           # Core libraries
│   ├── services/      # Business logic
│   └── utils/         # Helper functions
└── styles/           # CSS styles
```

### Technologies

- **Frontend**: Vanilla JavaScript with Bootstrap
- **Backend**: Supabase (PostgreSQL + Row Level Security)
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth
- **Icons**: Lucide Icons

### Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

### Environment Variables

Required environment variables in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Migrations

Migrations are managed through Supabase and handle:
- Schema creation and updates
- RLS policies
- Functions and triggers
- Access control
- Data consistency

### Best Practices

1. **Security**
   - Always use RLS policies
   - Validate user access
   - Sanitize user input

2. **Performance**
   - Optimize database queries
   - Use appropriate indexes
   - Lazy load components

3. **Code Organization**
   - Separate concerns
   - Use services for business logic
   - Keep components focused

4. **Error Handling**
   - Consistent error messages
   - User-friendly alerts
   - Proper error logging

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### License

MIT License