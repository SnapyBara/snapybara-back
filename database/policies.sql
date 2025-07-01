-- Database Policies for User Management and Security
-- Execute these SQL commands in your Supabase SQL Editor

-- 1. Enable Row Level Security on auth.users (already enabled by default)
-- This ensures users can only access their own data

-- 2. Create profiles table for additional user information
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Create function to handle profile updates
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to automatically update updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 8. Example policies for other tables (points of interest, photos, etc.)

-- Points of Interest table (example)
CREATE TABLE IF NOT EXISTS points_of_interest (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  category TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE points_of_interest ENABLE ROW LEVEL SECURITY;

-- Public points are viewable by everyone
CREATE POLICY "Public points are viewable by everyone"
ON points_of_interest FOR SELECT
USING (is_public = true);

-- Users can view their own points
CREATE POLICY "Users can view own points"
ON points_of_interest FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own points
CREATE POLICY "Users can create own points"
ON points_of_interest FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own points
CREATE POLICY "Users can update own points"
ON points_of_interest FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own points
CREATE POLICY "Users can delete own points"
ON points_of_interest FOR DELETE
USING (auth.uid() = user_id);

-- 9. Photos table (example)
CREATE TABLE IF NOT EXISTS photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  point_id UUID REFERENCES points_of_interest(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Public photos are viewable by everyone
CREATE POLICY "Public photos are viewable by everyone"
ON photos FOR SELECT
USING (is_public = true);

-- Users can view their own photos
CREATE POLICY "Users can view own photos"
ON photos FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own photos
CREATE POLICY "Users can create own photos"
ON photos FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own photos
CREATE POLICY "Users can update own photos"
ON photos FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos"
ON photos FOR DELETE
USING (auth.uid() = user_id);

-- 10. Reviews table (example)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  point_id UUID REFERENCES points_of_interest(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, point_id) -- One review per user per point
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Reviews are viewable by everyone
CREATE POLICY "Reviews are viewable by everyone"
ON reviews FOR SELECT
USING (true);

-- Users can create their own reviews
CREATE POLICY "Users can create own reviews"
ON reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
ON reviews FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
ON reviews FOR DELETE
USING (auth.uid() = user_id);

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS points_of_interest_location_idx ON points_of_interest(latitude, longitude);
CREATE INDEX IF NOT EXISTS points_of_interest_user_id_idx ON points_of_interest(user_id);
CREATE INDEX IF NOT EXISTS points_of_interest_category_idx ON points_of_interest(category);
CREATE INDEX IF NOT EXISTS photos_user_id_idx ON photos(user_id);
CREATE INDEX IF NOT EXISTS photos_point_id_idx ON photos(point_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_point_id_idx ON reviews(point_id);

-- 12. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
