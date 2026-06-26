import { useCallback, useEffect, useState } from 'react';
import { getOrgChart } from '../../api/organization';
import type { OrgChart, OrgChartNode, OrgNodeType } from '../../types/organization';
import { ApiError } from '../../api/users';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const NODE_COLORS: Record<OrgNodeType, { bg: string; border: string; text: string }> = {
  COMPANY:    { bg: '#eff6ff', border: '#2563eb', text: '#1e40af' },
  BRANCH:     { bg: '#faf5ff', border: '#7c3aed', text: '#5b21b6' },
  DEPARTMENT: { bg: '#fff7ed', border: '#c2410c', text: '#9a3412' },
  TEAM:       { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' },
  USER:       { bg: '#f9fafb', border: '#6b7280', text: '#374151' },
};

const TYPE_LABEL: Record<OrgNodeType, string> = {
  COMPANY:    'Company',
  BRANCH:     'Branch',
  DEPARTMENT: 'Department',
  TEAM:       'Team',
  USER:       'User',
};

// ── Build tree from flat nodes ─────────────────────────────────────────────────

interface TreeNode extends OrgChartNode {
  children: TreeNode[];
}

function buildTree(nodes: OrgChartNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  nodes.forEach(n => byId.set(n.id, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  nodes.forEach(n => {
    const node = byId.get(n.id)!;
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// ── Single node card ───────────────────────────────────────────────────────────

function NodeCard({ node, search, defaultExpanded }: { node: TreeNode; search: string; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const colors = NODE_COLORS[node.type] ?? NODE_COLORS.USER;
  const hasChildren = node.children.length > 0;

  const matchesSearch = search
    ? node.label.toLowerCase().includes(search.toLowerCase()) ||
      node.data.name.toLowerCase().includes(search.toLowerCase())
    : false;

  const highlight = search && matchesSearch;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Node card */}
      <div
        style={{
          border: `2px solid ${highlight ? '#f59e0b' : colors.border}`,
          background: highlight ? '#fef9c3' : colors.bg,
          borderRadius: 10,
          padding: '10px 14px',
          minWidth: 150,
          maxWidth: 200,
          textAlign: 'center',
          boxShadow: highlight ? '0 0 0 3px #fde68a' : '0 1px 4px rgba(0,0,0,0.08)',
          position: 'relative',
          cursor: hasChildren ? 'pointer' : 'default',
          transition: 'box-shadow 0.15s',
        }}
        onClick={() => hasChildren && setExpanded(e => !e)}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: highlight ? '#92400e' : colors.text, marginBottom: 3 }}>
          {TYPE_LABEL[node.type]}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', wordBreak: 'break-word', lineHeight: 1.3 }}>
          {node.data.name || node.label}
        </div>
        {node.data.manager && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.data.manager}
          </div>
        )}
        {node.data.userCount !== undefined && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {node.data.userCount} {node.data.userCount === 1 ? 'user' : 'users'}
          </div>
        )}
        {hasChildren && (
          <div style={{ position: 'absolute', bottom: -11, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20, background: '#fff', border: `2px solid ${colors.border}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: colors.text, fontWeight: 700, zIndex: 1, lineHeight: 1 }}>
            {expanded ? '−' : '+'}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <>
          {/* Vertical connector */}
          <div style={{ width: 2, height: 20, background: '#d1d5db', marginTop: 10 }} />
          {/* Horizontal bar across children */}
          {node.children.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
              {node.children.map((child, idx) => (
                <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px', position: 'relative' }}>
                  {/* Top connector piece */}
                  <div style={{ width: 2, height: 14, background: '#d1d5db', marginBottom: 0 }} />
                  {/* Horizontal line connecting siblings */}
                  {idx < node.children.length - 1 && (
                    <div style={{ position: 'absolute', top: 14, left: '50%', width: 'calc(100% + 24px)', height: 2, background: '#d1d5db', zIndex: 0 }} />
                  )}
                  <NodeCard node={child} search={search} defaultExpanded={search.length > 0} />
                </div>
              ))}
            </div>
          )}
          {node.children.length === 1 && (
            <NodeCard node={node.children[0]} search={search} defaultExpanded={search.length > 0} />
          )}
        </>
      )}
    </div>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
      {(Object.keys(NODE_COLORS) as OrgNodeType[]).filter(t => t !== 'USER').map(type => {
        const c = NODE_COLORS[type];
        return (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <div style={{ width: 14, height: 14, background: c.bg, border: `2px solid ${c.border}`, borderRadius: 3 }} />
            <span style={{ color: '#6b7280' }}>{TYPE_LABEL[type]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OrganizationChart({ showToast }: Props) {
  const [chart,   setChart]   = useState<OrgChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');

  const load = useCallback(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOrgChart();
        setChart(data);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Failed to load organization chart';
        setError(msg);
        showToast('error', msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const roots = chart ? buildTree(chart.nodes) : [];
  const matchCount = search
    ? chart?.nodes.filter(n =>
        n.label.toLowerCase().includes(search.toLowerCase()) ||
        n.data.name.toLowerCase().includes(search.toLowerCase())
      ).length ?? 0
    : 0;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search nodes…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28, paddingRight: search ? 28 : 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', width: 200, fontFamily: 'inherit', background: '#fff', color: '#374151' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>}
        </div>
        {search && <span style={{ fontSize: 12, color: '#6b7280' }}>{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>}
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={load} style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'inherit', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>Refresh</button>
        </div>
      </div>

      <Legend />

      {error && !loading && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 13, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={load} style={{ fontSize: 12, fontWeight: 600, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading organization chart…</div>
          </div>
        </div>
      )}

      {!loading && !error && roots.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af', fontSize: 13 }}>
          No organization data available yet.
        </div>
      )}

      {!loading && roots.length > 0 && (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)', padding: '24px 16px 40px', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', minWidth: 'max-content' }}>
            {roots.map(root => (
              <NodeCard key={root.id} node={root} search={search} defaultExpanded={true} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
