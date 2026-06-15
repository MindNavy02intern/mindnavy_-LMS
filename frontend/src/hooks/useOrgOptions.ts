import { useState, useEffect } from 'react';
import { getDepartments, getBranches } from '../api/organization';
import type { Department, Branch } from '../types/organization';

export default function useOrgOptions() {
  const [depts,        setDepts]        = useState<Department[]>([]);
  const [branches,     setBranches]     = useState<Branch[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [deptsError,   setDeptsError]   = useState(false);
  const [branchesError,setBranchesError]= useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setDeptsError(false);
      setBranchesError(false);

      const [deptsResult, branchesResult] = await Promise.allSettled([
        getDepartments({ status: 'ACTIVE', limit: 200 }),
        getBranches({ limit: 200 }),
      ]);

      if (!cancelled) {
        if (deptsResult.status === 'fulfilled') {
          setDepts(deptsResult.value.data ?? []);
        } else {
          setDeptsError(true);
        }

        if (branchesResult.status === 'fulfilled') {
          setBranches(branchesResult.value.data ?? []);
        } else {
          setBranchesError(true);
        }

        setLoading(false);
      }
    }

    fetchAll();
    window.addEventListener('organizationUpdated', fetchAll);
    return () => {
      cancelled = true;
      window.removeEventListener('organizationUpdated', fetchAll);
    };
  }, []);

  return { depts, branches, loading, deptsError, branchesError };
}
