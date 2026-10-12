import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadClubList, loadClubSnapshot, loadTargets, loadCoaches } from '../services/dataApi.js';

// Dataset v3: daftar klub + snapshot skuad klub terpilih + bursa luar-klub + bursa pelatih.
export function useDataset() {
  const [clubs, setClubs] = useState([]);
  const [targets, setTargets] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [meta, setMeta] = useState({ season: '', cutoff: '', sample: false, source: 'local' });
  const [clubId, setClubId] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [issues, setIssues] = useState([]);

  const fetchClubs = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setIssues([]);
    try {
      const res = await loadClubList();
      setClubs(res.clubs);
      setMeta({ season: res.season, cutoff: res.cutoff, sample: res.sample, source: res.source });
      try {
        setTargets(await loadTargets());
      } catch {
        setTargets([]);
        setIssues((prev) => [...prev, 'targets']);
      }
      try {
        setCoaches(await loadCoaches());
      } catch {
        setCoaches([]);
        setIssues((prev) => [...prev, 'coaches']);
      }
      setStatus(res.clubs.length ? 'success' : 'error');
      if (!res.clubs.length) setError(new Error('Tidak ada klub valid.'));
    } catch (e) {
      setError(e);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const selectClub = useCallback(async (id) => {
    setClubId(id);
    if (!id) { setSnapshot(null); return null; }
    const snap = await loadClubSnapshot(id);
    setSnapshot(snap);
    return snap;
  }, []);

  const entityMap = useMemo(() => {
    const m = new Map();
    for (const p of snapshot?.squad ?? []) m.set(p.id, p);
    return m;
  }, [snapshot]);

  return {
    clubs, targets, coaches, meta, clubId, snapshot,
    players: snapshot?.squad ?? [],
    entityMap,
    issues,
    status, error,
    refetch: fetchClubs, selectClub,
  };
}
