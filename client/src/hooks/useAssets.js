import { useState, useEffect, useCallback } from 'react';
import { api, uploadAssetFile } from '../api';
import { useSocket } from '../contexts/SocketContext';

export function useAssets() {
  const { socket } = useSocket();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/api/assets');
      setAssets(data);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    if (!socket) return;

    const onUploaded = (asset) => {
      setAssets(prev => {
        if (prev.some(a => a.id === asset.id)) return prev;
        return [asset, ...prev];
      });
    };

    const onDeleted = ({ assetId }) => {
      setAssets(prev => prev.filter(a => a.id !== assetId));
    };

    const onExpired = ({ assetIds }) => {
      const expiredSet = new Set(assetIds);
      setAssets(prev => prev.filter(a => !expiredSet.has(a.id)));
    };

    socket.on('asset:uploaded', onUploaded);
    socket.on('asset:deleted', onDeleted);
    socket.on('asset:expired', onExpired);
    return () => {
      socket.off('asset:uploaded', onUploaded);
      socket.off('asset:deleted', onDeleted);
      socket.off('asset:expired', onExpired);
    };
  }, [socket]);

  const uploadAsset = useCallback((file, description, onProgress) => {
    return uploadAssetFile(file, description, onProgress);
  }, []);

  const deleteAsset = useCallback(async (assetId) => {
    await api(`/api/assets/${assetId}`, { method: 'DELETE' });
  }, []);

  return { assets, loading, uploadAsset, deleteAsset, refreshAssets: fetchAssets };
}
