import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/profileService';
import { jobService } from '../services/jobService';
import type { Skill } from '../services/profileService';
import type { Category } from '../services/jobService';
import { UserRole } from '@tradeapp/shared';

export function EditProfilePage() {
  const { user, professionalProfile, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Basic profile fields
  const [basic, setBasic] = useState({ firstName: '', lastName: '', phone: '' });

  // Professional fields
  const [pro, setPro] = useState({
    bio: '',
    hourlyRate: '',
    availabilityRadiusKm: '20',
    isAvailable: true,
    locationLat: '',
    locationLng: '',
  });

  // Skills
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const isPro = user?.role === UserRole.PROFESSIONAL;

  // Seed form with current data
  useEffect(() => {
    if (user) {
      setBasic({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
      });
    }
    if (professionalProfile) {
      setPro({
        bio: professionalProfile.bio || '',
        hourlyRate: professionalProfile.hourlyRate ? String(professionalProfile.hourlyRate) : '',
        availabilityRadiusKm: String(professionalProfile.availabilityRadiusKm),
        isAvailable: professionalProfile.isAvailable,
        locationLat: professionalProfile.location?.latitude ? String(professionalProfile.location.latitude) : '',
        locationLng: professionalProfile.location?.longitude ? String(professionalProfile.location.longitude) : '',
      });
    }
  }, [user, professionalProfile]);

  // Load categories + skills for professionals
  useEffect(() => {
    if (!isPro) return;
    jobService.getCategories().then(setCategories).catch(console.error);
    profileService.getSkills().then((data) => setSkills(data.skills)).catch(console.error);
  }, [isPro]);

  const handleBasicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBasic({ ...basic, [e.target.name]: e.target.value });
  };

  const handleProChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPro({ ...pro, [e.target.name]: e.target.value });
  };

  // Skills helpers
  const toggleSkill = (categoryId: number) => {
    const exists = skills.find((s) => s.categoryId === categoryId);
    if (exists) {
      setSkills(skills.filter((s) => s.categoryId !== categoryId));
    } else {
      setSkills([...skills, { categoryId, yearsExperience: null }]);
    }
  };

  const updateSkillExperience = (categoryId: number, years: string) => {
    setSkills(skills.map((s) =>
      s.categoryId === categoryId ? { ...s, yearsExperience: years ? Number(years) : null } : s
    ));
  };

  const handleSave = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // 1. Save basic profile
      await profileService.updateProfile({
        firstName: basic.firstName,
        lastName: basic.lastName,
        phone: basic.phone,
      });

      // 2. Save professional profile if applicable
      if (isPro) {
        await profileService.updateProfessionalProfile({
          bio: pro.bio || null,
          hourlyRate: pro.hourlyRate ? Number(pro.hourlyRate) : null,
          availabilityRadiusKm: Number(pro.availabilityRadiusKm),
          isAvailable: pro.isAvailable,
          location: pro.locationLat && pro.locationLng
            ? { latitude: Number(pro.locationLat), longitude: Number(pro.locationLng) }
            : null,
        });

        // 3. Save skills
        await profileService.updateSkills(
          skills.map((s) => ({ categoryId: s.categoryId, yearsExperience: s.yearsExperience }))
        );
      }

      // Refresh the auth context so dashboard etc. reflect changes
      await refreshUser();
      setSuccess('Profile saved successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp</Link>
          <div className="navbar-actions">
            <Link to="/dashboard" className="btn btn-outline">Dashboard</Link>
            <button className="btn btn-outline" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="page-narrow" style={{ maxWidth: '560px' }}>
        <h2 style={{ marginBottom: '6px' }}>Edit profile</h2>
        <p className="text-muted">Update your personal information{isPro ? ' and professional details' : ''}.</p>

        <form onSubmit={handleSave}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* ── Basic info ── */}
          <div className="card mt-3">
            <h3>Personal information</h3>

            <div className="form-row mt-2">
              <div className="form-group">
                <label htmlFor="firstName" className="form-label">First name</label>
                <input id="firstName" name="firstName" type="text" className="form-input" value={basic.firstName} onChange={handleBasicChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="lastName" className="form-label">Last name</label>
                <input id="lastName" name="lastName" type="text" className="form-input" value={basic.lastName} onChange={handleBasicChange} required />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="phone" className="form-label">Phone</label>
              <input id="phone" name="phone" type="tel" className="form-input" value={basic.phone} onChange={handleBasicChange} />
            </div>
          </div>

          {/* ── Professional details ── */}
          {isPro && (
            <>
              <div className="card mt-3">
                <h3>Professional details</h3>

                <div className="form-group mt-2">
                  <label htmlFor="bio" className="form-label">Bio</label>
                  <textarea id="bio" name="bio" className="form-input" rows={3} placeholder="Tell customers about your experience and expertise..." value={pro.bio} onChange={handleProChange} style={{ resize: 'vertical' }} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hourlyRate" className="form-label">Hourly rate ($)</label>
                    <input id="hourlyRate" name="hourlyRate" type="number" className="form-input" min="0" step="0.01" placeholder="e.g. 45" value={pro.hourlyRate} onChange={handleProChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="availabilityRadiusKm" className="form-label">Service radius (km)</label>
                    <input id="availabilityRadiusKm" name="availabilityRadiusKm" type="number" className="form-input" min="1" max="500" value={pro.availabilityRadiusKm} onChange={handleProChange} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Availability</label>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                    onClick={() => setPro({ ...pro, isAvailable: !pro.isAvailable })}
                  >
                    <div style={{
                      width: '44px', height: '24px', borderRadius: '12px',
                      backgroundColor: pro.isAvailable ? '#111' : '#ccc',
                      position: 'relative', transition: 'background 0.2s',
                    }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '10px',
                        backgroundColor: '#fff', position: 'absolute', top: '2px',
                        left: pro.isAvailable ? '22px' : '2px', transition: 'left 0.2s',
                      }} />
                    </div>
                    <span className="text-sm">{pro.isAvailable ? 'Available for work' : 'Not available'}</span>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="locationLat" className="form-label">Latitude</label>
                    <input id="locationLat" name="locationLat" type="number" className="form-input" step="any" placeholder="e.g. 51.5074" value={pro.locationLat} onChange={handleProChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="locationLng" className="form-label">Longitude</label>
                    <input id="locationLng" name="locationLng" type="number" className="form-input" step="any" placeholder="e.g. -0.1278" value={pro.locationLng} onChange={handleProChange} />
                  </div>
                </div>
                <p className="text-xs text-light" style={{ marginTop: '-8px' }}>
                  Used for location-based job matching. You can find your coordinates on Google Maps.
                </p>
              </div>

              {/* ── Skills ── */}
              <div className="card mt-3">
                <h3>Skills</h3>
                <p className="text-sm text-muted">Select the services you offer and your years of experience.</p>

                <div className="flex-col gap-1 mt-2">
                  {categories.map((cat) => {
                    const skill = skills.find((s) => s.categoryId === cat.id);
                    const isSelected = !!skill;

                    return (
                      <div key={cat.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 14px', borderRadius: 'var(--radius)',
                        border: `1.5px solid ${isSelected ? '#111' : 'var(--color-border)'}`,
                        backgroundColor: isSelected ? '#fafafa' : 'var(--color-bg)',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSkill(cat.id)}
                          style={{ width: '18px', height: '18px', accentColor: '#111' }}
                        />
                        <span
                          className="text-sm"
                          style={{ flex: 1, fontWeight: isSelected ? 600 : 400 }}
                          onClick={() => toggleSkill(cat.id)}
                        >
                          {cat.name}
                        </span>
                        {isSelected && (
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '80px', padding: '5px 8px', fontSize: '0.85rem' }}
                            min="0"
                            max="50"
                            placeholder="Yrs"
                            value={skill?.yearsExperience ?? ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateSkillExperience(cat.id, e.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Save ── */}
          <button type="submit" className="btn btn-primary mt-3" disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </>
  );
}
