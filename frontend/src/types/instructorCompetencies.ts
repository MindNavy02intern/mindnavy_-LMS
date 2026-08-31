// Instructor "My Competencies & Skills" domain types — source of truth:
// backend/src/services/instructorCompetencies.service.js.

export interface MySkillRow {
  mappingId:   string;
  skillId:     string;
  skillName:   string;
  description: string | null;
  level:       'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  status:      'ACTIVE' | 'ARCHIVED';
  courseId:    string;
  courseTitle: string | null;
}

export type CompetencyCertStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export interface MyCompetencyCertification {
  id:              string;
  userId:          string;
  skillId:         string;
  skillName:       string | null;
  frameworkId:     string | null;
  frameworkName:   string | null;
  status:          CompetencyCertStatus;
  effectiveStatus: CompetencyCertStatus;
  issuedAt:        string;
  expiresAt:       string | null;
  revokedAt:       string | null;
  verificationCode: string;
}
