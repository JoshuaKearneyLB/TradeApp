-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('customer', 'professional');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE job_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE job_urgency AS ENUM ('low', 'medium', 'high', 'emergency');
CREATE TYPE notification_type AS ENUM ('new_job', 'job_accepted', 'job_completed', 'message', 'rating');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  account_status account_status DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Professional profiles table
CREATE TABLE professional_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  hourly_rate DECIMAL(10, 2),
  availability_radius_km INTEGER DEFAULT 20,
  location GEOGRAPHY(POINT, 4326),
  is_available BOOLEAN DEFAULT true,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  total_jobs_completed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_professional_location ON professional_profiles USING GIST(location);
CREATE INDEX idx_professional_user ON professional_profiles(user_id);

-- Service categories table
CREATE TABLE service_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Professional skills table (many-to-many)
CREATE TABLE professional_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES service_categories(id),
  years_experience INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(professional_id, category_id)
);

CREATE INDEX idx_skills_professional ON professional_skills(professional_id);
CREATE INDEX idx_skills_category ON professional_skills(category_id);

-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id),
  professional_id UUID REFERENCES users(id),
  category_id INTEGER NOT NULL REFERENCES service_categories(id),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  address TEXT NOT NULL,
  status job_status DEFAULT 'pending',
  urgency job_urgency DEFAULT 'medium',
  estimated_budget DECIMAL(10, 2),
  scheduled_date TIMESTAMP,
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_jobs_professional ON jobs(professional_id);
CREATE INDEX idx_jobs_category ON jobs(category_id);
CREATE INDEX idx_jobs_location ON jobs USING GIST(location);

-- Ratings table
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID UNIQUE NOT NULL REFERENCES jobs(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  professional_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ratings_professional ON ratings(professional_id);
CREATE INDEX idx_ratings_job ON ratings(job_id);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  receiver_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_job ON messages(job_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id, is_read);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type notification_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  related_job_id UUID REFERENCES jobs(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Seed service categories
INSERT INTO service_categories (name, description) VALUES
  ('Plumbing', 'Plumbing repairs, installations, and maintenance'),
  ('Electrical', 'Electrical repairs, wiring, and installations'),
  ('HVAC', 'Heating, ventilation, and air conditioning services'),
  ('Carpentry', 'Woodworking, furniture repair, and carpentry'),
  ('Painting', 'Interior and exterior painting services'),
  ('Landscaping', 'Lawn care, gardening, and landscaping'),
  ('Roofing', 'Roof repairs and installations'),
  ('Cleaning', 'Home and office cleaning services'),
  ('Appliance Repair', 'Repair of household appliances'),
  ('Locksmith', 'Lock installation, repair, and emergency lockout services');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_professional_profiles_updated_at BEFORE UPDATE ON professional_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update professional average rating
CREATE OR REPLACE FUNCTION update_professional_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE professional_profiles
  SET average_rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM ratings
    WHERE professional_id = NEW.professional_id
  )
  WHERE user_id = NEW.professional_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_trigger AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_professional_rating();
