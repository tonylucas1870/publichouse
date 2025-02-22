-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Create table for iCal feed access tokens
create table if not exists ical_feed_access (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references properties(id) on delete cascade,
  token uuid not null unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add RLS policies
alter table ical_feed_access enable row level security;

create policy "Users can view their own feed tokens"
  on ical_feed_access for select
  using (auth.uid() = user_id);

create policy "Users can create their own feed tokens"
  on ical_feed_access for insert
  with check (auth.uid() = user_id);

-- Add indexes
create index ical_feed_access_user_id_idx on ical_feed_access(user_id);
create index ical_feed_access_token_idx on ical_feed_access(token);

-- Create the moddatetime function if it doesn't exist
create extension if not exists moddatetime;

-- Add trigger for updated_at
drop trigger if exists handle_updated_at on ical_feed_access;
create trigger handle_updated_at before update on ical_feed_access
  for each row execute procedure moddatetime (updated_at);
