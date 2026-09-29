import { useState, useEffect } from 'react';
import { healthService } from '../services/healthService';
import { HealthResponse } from '@ibvap/shared';

export function useHealth(pollIntervalMs = 10000) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const data = await healthService.checkHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backend unreachable');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    if (pollIntervalMs > 0) {
      const interval = setInterval(fetchHealth, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [pollIntervalMs]);

  return { health, loading, error, refetch: fetchHealth };
}
