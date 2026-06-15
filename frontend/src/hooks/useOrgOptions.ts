import { useState, useEffect } from 'react';
import { getDepartments, getBranches } from '../api/organization';
import type { Department, Branch } from '../types/organization';

export default function useOrgOptions() {
  const [depts,    setDepts]    = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      try {
        const [deptsRes, branchesRes] = await Promise.all([
          getDepartments({ status: 'ACTIVE', limit: 200 }),
          getBranches({ limit: 200 }),
        ]);
        if (!cancelled) {
          setDepts(deptsRes.data ?? []);
          setBranches(branchesRes.data ?? []);
        }
      } catch {
        // silently fall back — dropdowns remain empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    window.addEventListener('organizationUpdated', fetchAll);
    return () => {
      cancelled = true;
      window.removeEventListener('organizationUpdated', fetchAll);
    };
  }, []);

  return { depts, branches, loading };
}
