export interface Group {
  id: string;
  name: string;
  description?: string | null;
  departmentId?: string | null;
  leaderId?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  memberCount: number;
  department?: { id: string; name: string } | null;
  leader?: { id: string; fullName: string; email: string; avatar?: string | null } | null;
  members?: GroupMember[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  userId: string;
  role?: string | null;
  joinedAt: string;
  user?: { id: string; fullName: string; email: string; avatar?: string | null };
}
