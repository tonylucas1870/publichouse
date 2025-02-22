# Supabase Configuration and Infrastructure

This directory contains the database schema, infrastructure configuration, and serverless functions for the Public House project.

## Directory Structure

```
supabase/
├── config.toml         # Main Supabase configuration
├── storage.json        # Storage bucket definitions
├── schema_dump.sql     # Latest schema dump
├── migrations/        
│   ├── 20250222214712_complete_schema_snapshot.sql
│   └── archive/        # Historical migrations
└── functions/          # Edge functions
```

## Database Schema

### Current Schema Snapshot

On 2025-02-22, we consolidated all previous migrations into a single snapshot file. This snapshot serves as the new baseline and includes:

- All tables and their structures
- Functions and triggers
- RLS policies
- Extensions (pg_cron, pg_net, pgsodium, moddatetime, pg_graphql)
- Roles and permissions

New migrations should be added after this snapshot with appropriate timestamps.

## Storage Infrastructure

### Buckets

The project uses the following storage buckets:
- `findings/` - Property inspection findings and attachments
- `furniture/` - Furniture inventory photos and documents
- `contents/` - Property contents and inventory items
- `tasks/` - Task-related attachments and documents

Storage configuration is maintained in `storage.json` with appropriate RLS policies.

## Edge Functions

### Property Management
- `analyze-airbnb` - Analyzes Airbnb listing data
- `analyze-video` - Processes property video content
- `fetch-airbnb` - Retrieves Airbnb listing information
- `fetch-calendar` - Fetches external calendar data
- `sync-calendars` - Synchronizes calendar data across platforms
- `serve-ical` - Serves iCal feeds for property calendars

### Notifications and Tasks
- `process-notifications` - Handles system notifications and alerts

### Payment Processing
- `create-checkout-session` - Initializes Stripe checkout sessions
- `create-portal-session` - Creates Stripe customer portal sessions
- `stripe-webhook` - Handles Stripe webhook events

## Configuration

### Project Settings
- Project ID: `publichouse`
- API Port: 54321
- Database Port: 54322
- Analytics Port: 54327

### Security Features
- Row Level Security (RLS) enabled
- Email signup enabled
- Double confirmation for email changes

## Development

### Local Development
The project uses Supabase CLI for local development. Key commands:
```bash
supabase start    # Start local development
supabase db dump  # Create database dumps
supabase deploy   # Deploy changes
```

### Migrations
New migrations should follow the timestamp naming convention:
```bash
YYYYMMDDHHMMSS_descriptive_name.sql
```
