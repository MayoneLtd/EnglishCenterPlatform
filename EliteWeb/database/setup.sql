-- =============================================
-- Elite Language Center — Database Schema
-- AN TOÀN: Chạy bao nhiêu lần cũng được, không lỗi
-- =============================================

-- 0. Xác nhận tất cả user chưa confirm email
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
    student_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Courses table
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    teacher_name TEXT DEFAULT '',
    total_lessons INT DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'upcoming', 'completed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    enrolled_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Learning History table
CREATE TABLE IF NOT EXISTS learning_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_name TEXT NOT NULL,
    duration_minutes INT DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'in_progress')),
    learned_at DATE DEFAULT CURRENT_DATE
);

-- 5. Evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    overall_score DECIMAL(3,1) DEFAULT 0,
    reading DECIMAL(3,1) DEFAULT 0,
    listening DECIMAL(3,1) DEFAULT 0,
    writing DECIMAL(3,1) DEFAULT 0,
    speaking DECIMAL(3,1) DEFAULT 0,
    comment TEXT DEFAULT '',
    teacher_name TEXT DEFAULT '',
    evaluated_at DATE DEFAULT CURRENT_DATE
);

-- =============================================
-- Admin Check Function (Bypass RLS to prevent infinite recursion)
-- =============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    is_adm BOOLEAN;
BEGIN
    SELECT role = 'admin' INTO is_adm FROM profiles WHERE id = auth.uid();
    RETURN COALESCE(is_adm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin can view all profiles" ON profiles FOR SELECT USING (public.is_admin());
-- Học viên không được phép tự update profile nữa
-- CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can update all profiles" ON profiles FOR ALL USING (public.is_admin());

-- Courses
DROP POLICY IF EXISTS "Anyone can view courses" ON courses;
DROP POLICY IF EXISTS "Admin can manage courses" ON courses;

CREATE POLICY "Anyone can view courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Admin can manage courses" ON courses FOR ALL USING (public.is_admin());

-- Enrollments
DROP POLICY IF EXISTS "Student can view own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admin can manage enrollments" ON enrollments;

CREATE POLICY "Student can view own enrollments" ON enrollments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admin can manage enrollments" ON enrollments FOR ALL USING (public.is_admin());

-- Learning History
DROP POLICY IF EXISTS "Student can view own history" ON learning_history;
DROP POLICY IF EXISTS "Admin can manage history" ON learning_history;

CREATE POLICY "Student can view own history" ON learning_history FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admin can manage history" ON learning_history FOR ALL USING (public.is_admin());

-- Evaluations
DROP POLICY IF EXISTS "Student can view own evaluations" ON evaluations;
DROP POLICY IF EXISTS "Admin can manage evaluations" ON evaluations;

CREATE POLICY "Student can view own evaluations" ON evaluations FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admin can manage evaluations" ON evaluations FOR ALL USING (public.is_admin());

-- =============================================
-- Auto-create profile on signup (trigger)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 6. Exercises table (Admin tạo bài tập bằng AI)
-- =============================================
CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    grade TEXT DEFAULT 'Chung',
    difficulty TEXT DEFAULT 'Trung bình' CHECK (difficulty IN ('Dễ', 'Trung bình', 'Khó')),
    question_count INT DEFAULT 0,
    questions JSONB NOT NULL DEFAULT '[]',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Submissions table (Student nộp bài)
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}',
    result JSONB DEFAULT NULL,
    total_score DECIMAL(5,2) DEFAULT 0,
    max_score DECIMAL(5,2) DEFAULT 10,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for exercises
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view exercises" ON exercises;
DROP POLICY IF EXISTS "Admin can manage exercises" ON exercises;

CREATE POLICY "Anyone can view exercises" ON exercises FOR SELECT USING (true);
CREATE POLICY "Admin can manage exercises" ON exercises FOR ALL USING (public.is_admin());

-- RLS for submissions
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student can view own submissions" ON submissions;
DROP POLICY IF EXISTS "Student can insert own submissions" ON submissions;
DROP POLICY IF EXISTS "Admin can view all submissions" ON submissions;

CREATE POLICY "Student can view own submissions" ON submissions FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Student can insert own submissions" ON submissions FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Admin can view all submissions" ON submissions FOR SELECT USING (public.is_admin());

-- =============================================
-- Seed Data: Courses (chỉ thêm nếu bảng trống)
-- =============================================
INSERT INTO courses (name, description, teacher_name, total_lessons, status)
SELECT * FROM (VALUES
    ('Luyện thi IELTS - Target 7.0', 'Lộ trình tối ưu hóa giúp đạt Target 7.0+, học thuật chuyên sâu và chiến thuật làm bài hiệu quả.', 'Mr. David', 36, 'active'),
    ('Tiếng Anh Giao Tiếp Cơ Bản', 'Nền tảng vững chắc để tự tin giao tiếp trong môi trường quốc tế.', 'Ms. Sarah', 20, 'active'),
    ('Luyện thi IELTS - Target 6.5', 'Khóa học phù hợp cho người mới bắt đầu hành trình chinh phục IELTS.', 'Ms. Emily', 30, 'active'),
    ('Tiếng Anh Doanh Nghiệp', 'Thiết kế dành riêng cho người đi làm, trang bị kỹ năng ngoại ngữ chuyên nghiệp.', 'Mr. James', 24, 'upcoming')
) AS v(name, description, teacher_name, total_lessons, status)
WHERE NOT EXISTS (SELECT 1 FROM courses LIMIT 1);

-- =============================================
-- 8. App Settings table (Admin quản lý API key tập trung)
-- =============================================
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read settings" ON app_settings;
DROP POLICY IF EXISTS "Admin can manage settings" ON app_settings;

CREATE POLICY "Anyone can read settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage settings" ON app_settings FOR ALL USING (public.is_admin());

-- =============================================
-- 9. Teachers table
-- =============================================
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    specialty TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view teachers" ON teachers;
DROP POLICY IF EXISTS "Admin can manage teachers" ON teachers;

CREATE POLICY "Anyone can view teachers" ON teachers FOR SELECT USING (true);
CREATE POLICY "Admin can manage teachers" ON teachers FOR ALL USING (public.is_admin());

-- Seed teachers from existing course data (only if table is empty)
INSERT INTO teachers (full_name)
SELECT DISTINCT teacher_name FROM courses WHERE teacher_name IS NOT NULL AND teacher_name != ''
AND NOT EXISTS (SELECT 1 FROM teachers LIMIT 1);

-- =============================================
-- 10. Lessons table (Bài giảng theo buổi)
-- =============================================
CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_number INT NOT NULL DEFAULT 1,
    title TEXT NOT NULL DEFAULT '',
    lesson_date DATE,
    video_url TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    preparation TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view lessons" ON lessons;
DROP POLICY IF EXISTS "Admin can manage lessons" ON lessons;

CREATE POLICY "Anyone can view lessons" ON lessons FOR SELECT USING (true);
CREATE POLICY "Admin can manage lessons" ON lessons FOR ALL USING (public.is_admin());
