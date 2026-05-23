export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'student' | 'admin' | 'teacher' | 'super_admin';
}

export type UserRole = Profile['role'];
