import { useState, useEffect, useCallback } from 'react';
import { api, uploadAddonFile } from '../api';
import { useSocket } from '../contexts/SocketContext';

export function useAddons() {
  const { socket } = useSocket();
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAddons = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/api/addons');
      setAddons(data);
    } catch (err) {
      console.error('Failed to fetch addons:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAddons();
  }, [fetchAddons]);

  useEffect(() => {
    if (!socket) return;

    const onUploaded = (addon) => {
      setAddons(prev => {
        if (prev.some(a => a.id === addon.id)) return prev;
        return [addon, ...prev];
      });
    };

    const onDeleted = ({ addonId }) => {
      setAddons(prev => prev.filter(a => a.id !== addonId));
    };

    socket.on('addon:uploaded', onUploaded);
    socket.on('addon:deleted', onDeleted);
    return () => {
      socket.off('addon:uploaded', onUploaded);
      socket.off('addon:deleted', onDeleted);
    };
  }, [socket]);

  const uploadAddon = useCallback((file, description, onProgress) => {
    return uploadAddonFile(file, description, onProgress);
  }, []);

  const deleteAddon = useCallback(async (addonId) => {
    await api(`/api/addons/${addonId}`, { method: 'DELETE' });
  }, []);

  return { addons, loading, uploadAddon, deleteAddon, refreshAddons: fetchAddons };
}
