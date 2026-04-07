import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { uploadService } from '../services/uploadService';
import type { JobPhoto } from '../services/uploadService';

interface PhotoGalleryProps {
  jobId: string;
  jobStatus: string;
}

const TYPE_LABEL: Record<string, string> = {
  problem: 'Problem',
  completion: 'Completion',
};

// Extend JobPhoto with a resolved blob URL for authenticated display
interface DisplayPhoto extends JobPhoto {
  blobUrl?: string;
}

export function PhotoGallery({ jobId, jobStatus }: PhotoGalleryProps) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<DisplayPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<DisplayPhoto | null>(null);
  const [uploadType, setUploadType] = useState<'problem' | 'completion'>('problem');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlsRef = useRef<string[]>([]);

  const canUpload = ['pending', 'accepted', 'in_progress', 'completed'].includes(jobStatus);

  // Revoke all blob URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  async function resolvePhotos(raw: JobPhoto[]): Promise<DisplayPhoto[]> {
    return Promise.all(
      raw.map(async (p) => {
        try {
          const blobUrl = await uploadService.fetchPhotoBlob(p.url);
          blobUrlsRef.current.push(blobUrl);
          return { ...p, blobUrl };
        } catch {
          return p; // fallback — blobUrl undefined, img will be broken (acceptable)
        }
      }),
    );
  }

  useEffect(() => {
    uploadService.getJobPhotos(jobId)
      .then(resolvePhotos)
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const photo = await uploadService.uploadPhoto(jobId, file, uploadType);
      const blobUrl = await uploadService.fetchPhotoBlob(photo.url).catch(() => undefined);
      if (blobUrl) blobUrlsRef.current.push(blobUrl);
      setPhotos((prev) => [...prev, { ...photo, blobUrl }]);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Remove this photo?')) return;
    try {
      await uploadService.deletePhoto(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (lightbox?.id === photoId) setLightbox(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h4 style={{ margin: 0, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
          Photos ({photos.length}/20)
        </h4>
        {canUpload && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as 'problem' | 'completion')}
              style={{
                padding: '6px 10px', border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius)', fontSize: '0.8rem',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}
            >
              <option value="problem">Problem photo</option>
              <option value="completion">Completion photo</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || photos.length >= 20}
              className="btn btn-sm"
              style={{
                background: 'var(--color-amber)', color: '#fff', border: 'none',
                opacity: uploading || photos.length >= 20 ? 0.6 : 1,
              }}
            >
              {uploading ? '…' : '+ Add photo'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
          <span className="spinner" />
        </div>
      ) : photos.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>No photos yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              style={{ position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden', cursor: 'pointer', aspectRatio: '1' }}
              onClick={() => setLightbox(photo)}
            >
              <img
                src={photo.blobUrl}
                alt={photo.originalName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '4px 8px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              }}>
                <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 600 }}>
                  {TYPE_LABEL[photo.photoType] || photo.photoType}
                </span>
                {photo.uploadedBy === user?.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                    style={{
                      background: 'rgba(220,38,38,0.85)', border: 'none', color: '#fff',
                      borderRadius: 4, padding: '2px 6px', fontSize: '0.65rem',
                      cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={lightbox.blobUrl}
              alt={lightbox.originalName}
              style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, display: 'block' }}
            />
            <div style={{
              marginTop: 10, color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', textAlign: 'center',
            }}>
              {lightbox.uploaderName} · {TYPE_LABEL[lightbox.photoType]} · {new Date(lightbox.createdAt).toLocaleDateString('en-GB')}
            </div>
            <button
              onClick={() => setLightbox(null)}
              style={{
                position: 'absolute', top: -14, right: -14,
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--color-danger)', border: 'none', color: '#fff',
                fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
