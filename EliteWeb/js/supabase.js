// Supabase Client Configuration
const SUPABASE_URL = 'https://ceidvdnmyeqfyxgqdvve.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlaWR2ZG5teWVxZnl4Z3FkdnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzg1NDEsImV4cCI6MjA5MTYxNDU0MX0.VDzi19Thmx8xLC_fCmbrSkZBYmXC9MZQhXVEIuLq0HU';

// Initialize Supabase client (loaded via CDN script tag)
// Usage: include <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> before this file
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== Auth Helpers =====

async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
}

async function getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

async function getProfile() {
    const session = await getSession();
    if (!session) return null;
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
    if (error) throw error;
    // If profile doesn't exist yet, try to create it
    if (!data) {
        const meta = session.user.user_metadata || {};
        const { data: newProfile, error: insertErr } = await supabaseClient
            .from('profiles')
            .upsert({
                id: session.user.id,
                full_name: meta.full_name || session.user.email?.split('@')[0] || '',
                role: meta.role || 'student'
            })
            .select()
            .single();
        if (insertErr) {
            console.error('Auto-create profile failed:', insertErr);
            return null;
        }
        return newProfile;
    }
    return data;
}

// ===== Auth Guards =====

async function requireAuth(allowedRole) {
    const session = await getSession();
    if (!session) {
        window.location.href = allowedRole === 'admin' ? 'admin_login.html' : 'login.html';
        return null;
    }
    const profile = await getProfile();
    if (!profile || (allowedRole && profile.role !== allowedRole)) {
        await signOut();
        window.location.href = allowedRole === 'admin' ? 'admin_login.html' : 'login.html';
        return null;
    }
    return profile;
}

// ===== Data Helpers =====

async function getStudentCourses(studentId) {
    const { data, error } = await supabaseClient
        .from('enrollments')
        .select('*, courses(*)')
        .eq('student_id', studentId)
        .order('enrolled_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function getLearningHistory(studentId) {
    const { data, error } = await supabaseClient
        .from('learning_history')
        .select('*, courses(name)')
        .eq('student_id', studentId)
        .order('learned_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function getEvaluations(studentId) {
    const { data, error } = await supabaseClient
        .from('evaluations')
        .select('*')
        .eq('student_id', studentId)
        .order('evaluated_at', { ascending: false });
    if (error) throw error;
    return data;
}

// ===== Admin Data Helpers =====

async function getAllStudents() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function getAllCourses() {
    const { data, error } = await supabaseClient
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function getAllEnrollments() {
    const { data, error } = await supabaseClient
        .from('enrollments')
        .select('*, profiles(full_name, student_code, email:id), courses(name)')
        .order('enrolled_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function getCourseEnrollments(courseId) {
    const { data, error } = await supabaseClient
        .from('enrollments')
        .select('*, profiles(full_name, student_code)')
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function removeEnrollment(enrollmentId) {
    const { error } = await supabaseClient
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);
    if (error) throw error;
}

async function addLearningHistory(data) {
    const { error } = await supabaseClient
        .from('learning_history')
        .insert(data);
    if (error) throw error;
}

async function getStats() {
    const { count: studentCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
    const { count: courseCount } = await supabaseClient.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'active');
    return { studentCount, courseCount };
}

// ===== Exercise Helpers =====

async function getAllExercises() {
    const { data, error } = await supabaseClient
        .from('exercises')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function getExerciseById(id) {
    const { data, error } = await supabaseClient
        .from('exercises')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

async function createExercise(exerciseData) {
    const { data, error } = await supabaseClient
        .from('exercises')
        .insert(exerciseData)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function updateExercise(id, updates) {
    const { data, error } = await supabaseClient
        .from('exercises')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function deleteExercise(id) {
    const { error } = await supabaseClient
        .from('exercises')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// ===== Submission Helpers =====

async function submitExerciseResult(exerciseId, studentId, answers, result, totalScore, maxScore) {
    const { data, error } = await supabaseClient
        .from('submissions')
        .insert({
            exercise_id: exerciseId,
            student_id: studentId,
            answers: answers,
            result: result,
            total_score: totalScore,
            max_score: maxScore
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function getStudentSubmissions(studentId) {
    const { data, error } = await supabaseClient
        .from('submissions')
        .select('*, exercises(title, difficulty, question_count)')
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function getExerciseSubmissions(exerciseId) {
    const { data, error } = await supabaseClient
        .from('submissions')
        .select('*, profiles(full_name, student_code)')
        .eq('exercise_id', exerciseId)
        .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function getStudentSubmissionForExercise(studentId, exerciseId) {
    const { data, error } = await supabaseClient
        .from('submissions')
        .select('*')
        .eq('student_id', studentId)
        .eq('exercise_id', exerciseId)
        .order('submitted_at', { ascending: false })
        .limit(1);
    if (error) throw error;
    return data.length > 0 ? data[0] : null;
}

// ===== Course Admin Helpers =====

async function createCourse(data) {
    const { data: newCourse, error } = await supabaseClient
        .from('courses')
        .insert([data])
        .select()
        .single();
    if (error) throw error;
    return newCourse;
}

async function updateCourse(id, data) {
    const { error } = await supabaseClient
        .from('courses')
        .update(data)
        .eq('id', id);
    if (error) throw error;
}

async function deleteCourse(id) {
    const { error } = await supabaseClient
        .from('courses')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// ===== Student Admin Helpers =====

// Secondary client using in-memory storage to prevent logging out admin when creating students
const supabaseAdminMode = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});

async function createStudentAccount(email, password, profileData) {
    // Note: Due to RLS, handle_new_user trigger on auth.users will automatically create the profile row
    const { data, error } = await supabaseAdminMode.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: profileData.full_name,
                role: 'student'
            }
        }
    });
    if (error) throw error;
    
    // Wait slightly to ensure trigger has executed
    await new Promise(r => setTimeout(r, 500));
    
    // Update the profile with remaining data (student_code, phone)
    if (data.user) {
        await supabaseClient.from('profiles').update({
            student_code: profileData.student_code,
            phone: profileData.phone
        }).eq('id', data.user.id);
    }
    return data;
}

async function updateStudentProfile(userId, profileData) {
    const { error } = await supabaseClient
        .from('profiles')
        .update(profileData)
        .eq('id', userId);
    if (error) throw error;
}

async function deleteStudent(userId) {
    // Only deletes profile due to missing service_role_key. 
    // Auth account remains but disabled functionally.
    const { error } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', userId);
    if (error) throw error;
}

// ===== Code Generation & Enrollments =====

async function getNextStudentCodeSequence(prefix) {
    // Returns the next sequence number for a given prefix (e.g., EL26...)
    const likePattern = `${prefix}%`;
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('student_code')
        .like('student_code', likePattern);
        
    if (error) throw error;
    
    if (!data || data.length === 0) return 1;
    
    // Find highest sequence
    let maxSeq = 0;
    data.forEach(p => {
        if (!p.student_code) return;
        const seqStr = p.student_code.substring(prefix.length);
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
        }
    });
    
    return maxSeq + 1;
}

async function enrollStudent(studentId, courseId) {
    const { error } = await supabaseClient
        .from('enrollments')
        .insert([{ student_id: studentId, course_id: courseId }]);
    if (error) throw error;
}

// ===== App Settings (Centralized API Key) =====

async function getAppSetting(key) {
    const { data, error } = await supabaseClient
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
}

async function setAppSetting(key, value) {
    const { error } = await supabaseClient
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
}

async function getGeminiApiKey() {
    return await getAppSetting('gemini_api_key');
}

async function setGeminiApiKey(value) {
    await setAppSetting('gemini_api_key', value);
}

// ===== Teacher Helpers =====

async function getAllTeachers() {
    const { data, error } = await supabaseClient
        .from('teachers')
        .select('*')
        .order('full_name', { ascending: true });
    if (error) throw error;
    return data;
}

async function createTeacher(teacherData) {
    const { data, error } = await supabaseClient
        .from('teachers')
        .insert([teacherData])
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function updateTeacher(id, teacherData) {
    const { error } = await supabaseClient
        .from('teachers')
        .update(teacherData)
        .eq('id', id);
    if (error) throw error;
}

async function deleteTeacher(id) {
    const { error } = await supabaseClient
        .from('teachers')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// ===== Lesson Helpers =====

async function getCourseLessons(courseId) {
    const { data, error } = await supabaseClient
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('lesson_number', { ascending: true });
    if (error) throw error;
    return data;
}

async function createLesson(lessonData) {
    const { data, error } = await supabaseClient
        .from('lessons')
        .insert([lessonData])
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function updateLesson(id, lessonData) {
    const { error } = await supabaseClient
        .from('lessons')
        .update(lessonData)
        .eq('id', id);
    if (error) throw error;
}

async function deleteLesson(id) {
    const { error } = await supabaseClient
        .from('lessons')
        .delete()
        .eq('id', id);
    if (error) throw error;
}
