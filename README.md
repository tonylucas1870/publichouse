# CleanFind

A property management system for tracking changeovers, findings, and maintenance across multiple properties.

## Features

### Property Management
- Multiple properties per user with role-based access control
- Room and utility tracking
- Calendar integration with iCal/ICS support
- Automatic changeover scheduling

### Changeovers
- Schedule and track cleaning/maintenance events
- Status tracking (scheduled, in_progress, complete)
- Shareable links for external access
- Automatic task creation from property templates

### Findings
- Report and track items found during changeovers
- Multi-image and video upload support
- Notes and comments system
- Content item linking
- Share links for individual findings
- Status tracking (pending, open, blocked, won't fix, fixed)

### Room Management
- Room inventory tracking
- Wall and lighting details
- Content item management with images
- Finding history per room/item

### Notifications
- Email notifications for key events
- Configurable notification preferences
- Support for multiple notification types:
  - Changeover created/status changed
  - Finding created/status changed
  - New comments/media added

## Technology Stack

### Frontend
- Vanilla JavaScript with Bootstrap 5
- Real-time updates via Supabase Realtime
- Responsive design
- Icon system using Font Awesome

### Backend
- Supabase (PostgreSQL + Row Level Security)
- Supabase Auth with email/password
- Supabase Storage for media files
- Supabase Edge Functions for:
  - Stripe integration
  - Email notifications
  - Calendar sync

### Security
- Row Level Security (RLS) policies
- Property-based access control
- Secure file uploads
- Share token system for external access
- Anonymous user support

## Project Structure

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
│   │   ├── settings/   # User settings components
│   │   └── ui/         # Shared UI components
│   ├── lib/           # Core libraries
│   ├── services/      # Business logic
│   ├── utils/         # Helper functions
│   └── views/         # View initialization
└── styles/           # CSS styles
```

## Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Database Schema

### Core Tables
- `properties`: Property details and settings
- `rooms`: Room management
- `room_details`: Room contents and specifications
- `changeovers`: Scheduling and status
- `findings`: Item tracking and management
- `tasks`: Standard property tasks
- `utilities`: Property utility tracking

### Access Control
- `property_access`: Role-based access control
- `anonymous_users`: Support for anonymous access

### Subscription
- `subscription_tiers`: Available subscription plans
- `subscriptions`: User subscriptions
- `subscription_history`: Subscription changes

### Notifications
- `notification_preferences`: User notification settings
- `notification_queue`: Notification processing
- `notification_templates`: Email templates

## Security Features

### Row Level Security
- Property-based access control
- Share token validation
- Anonymous user support
- Role-based permissions

### Access Levels
- Owner: Full access to property
- Admin: Property management
- Cleaner: Changeover access
- Anonymous: Limited access via share tokens

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License