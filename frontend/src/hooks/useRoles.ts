import { useState, useEffect } from 'react';
import { rolesPermissionsAPI } from '../api/rolesPermissions';

export interface RoleOption {
  value: string; // AppUserRole enum value (e.g. "LEARNER")
  label: string; // Display name from the Role table (e.g. "Learner")
}

// Mirror the normalization the backend does when filtering/creating users.
// Maps role display names → AppUserRole enum values.
const ENUM_ROLES = new Set(['LEARNER', 'INSTRUCTOR', 'MANAGER', 'ADMIN_ASSISTANT']);
const ROLE_ALIAS: Record<string, string> = {
  ADMINISTRATOR: 'ADMIN_ASSISTANT',
  ADMIN: 'ADMIN_ASSISTANT',
};

export function roleNameToEnum(name: string): string {
  const upper = name.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (ENUM_ROLES.has(upper)) return upper;
  return ROLE_ALIAS[upper] ?? upper;
}

export default function useRoles() {
  const [options,  setOptions]  = useState<RoleOption[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function fetchRoles() {
      setLoading(true);
      setHasError(false);
      rolesPermissionsAPI
        .getRoles({ status: 'ACTIVE', limit: 200 })
        .then((res) => {
          if (!cancelled) {
            setOptions(
              (res.data ?? [])
                .filter((r) => !r.isCustomRole)
                .map((r) => ({
                  value: roleNameToEnum(r.name),
                  label: r.name,
                }))
            );
          }
        })
        .catch(() => {
          if (!cancelled) setHasError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    fetchRoles();

    window.addEventListener('rolesUpdated', fetchRoles);
    return () => {
      cancelled = true;
      window.removeEventListener('rolesUpdated', fetchRoles);
    };
  }, []);

  return { options, loading, hasError };
}
