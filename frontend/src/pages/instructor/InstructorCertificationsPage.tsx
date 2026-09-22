import InstructorLayout from './InstructorLayout';
import { CertificationsTab } from './InstructorProfilePage';

// blueprint 2.7 — teaching credentials (InstructorCertification), a
// DIFFERENT entity from Competency Certifications (2.8). The actual feature
// (list + upload) was already built as a tab inside InstructorProfilePage.tsx
// (blueprint 2.2), but the sidebar's dedicated "My Certifications" link
// (/instructor/certifications) was never wired to its own page and still
// showed Coming Soon — this thin wrapper reuses that same tab component
// rather than forking it, so the sidebar link finally matches reality.

export default function InstructorCertificationsPage() {
  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">My Certifications</h1>
          <p className="mn-db-welcome-sub">Teaching credentials, licences, and professional training you hold</p>
        </div>
      </div>
      <CertificationsTab />
    </InstructorLayout>
  );
}
