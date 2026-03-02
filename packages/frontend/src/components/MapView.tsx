import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { JobResponse } from '../services/jobService';

// Fix Leaflet's broken default icon paths under Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapViewProps {
  jobs: JobResponse[];
  center?: [number, number]; // [latitude, longitude]
}

export function MapView({ jobs, center }: MapViewProps) {
  const jobsWithLocation = jobs.filter((j) => j.location);

  // Derive a sensible center: prefer provided center, then first job, then London
  const mapCenter: [number, number] =
    center ??
    (jobsWithLocation.length > 0
      ? [jobsWithLocation[0].location!.latitude, jobsWithLocation[0].location!.longitude]
      : [51.5074, -0.1278]);

  return (
    <MapContainer
      key={mapCenter.join(',')}
      center={mapCenter}
      zoom={center ? 11 : 10}
      style={{ height: '420px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {jobsWithLocation.map((job) => (
        <Marker
          key={job.id}
          position={[job.location!.latitude, job.location!.longitude]}
        >
          <Popup>
            <div style={{ minWidth: '160px' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>{job.title}</strong>
              <span style={{ fontSize: '0.8rem', color: '#666', display: 'block', marginBottom: '6px' }}>
                {job.category?.name} &middot; {job.address}
              </span>
              <Link to={`/jobs/${job.id}`} style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                View job →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
