import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export interface Coords {
  lat: number;
  lon: number;
}

type Status = 'idle' | 'loading' | 'granted' | 'denied';

/**
 * Lightweight geolocation hook for "events near me". Requests permission once
 * and exposes the user's coordinates, degrading gracefully when unavailable
 * (e.g. permission denied or web without geolocation).
 */
export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const request = useCallback(async () => {
    setStatus('loading');
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setStatus('granted');
    } catch {
      setStatus('denied');
    }
  }, []);

  useEffect(() => {
    request();
  }, [request]);

  return { coords, status, request };
}
