import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function validatePhone(phone: string): string {
  if (!phone.trim()) return '';
  const stripped = phone.replace(/[\s\-().]/g, '');
  if (/^(0[1-9]\d{9}|\+44[1-9]\d{9})$/.test(stripped)) return '';
  return 'Please enter a valid UK phone number (e.g. 07911 123456)';
}
import { profileService } from '../services/profileService';
import { jobService } from '../services/jobService';
import type { Skill } from '../services/profileService';
import type { Category } from '../services/jobService';
import type { GeocodeSuggestion } from '../services/geocodeService';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { UserRole } from '@tradeapp/shared';

export function EditProfilePage() {
  const { user, professionalProfile, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Basic profile fields
  const [basic, setBasic] = useState({ firstName: '', lastName: '', phone: '' });

  // Professional fields (no location here — stored separately below)
  const [pro, setPro] = useState({
    bio: '',
    hourlyRate: '',
    availabilityRadiusKm: '20',
    isAvailable: true,
  });

  // Location state: geocodedLocation holds the saved coords; locationDisplay is the human-readable label;
  // locationAddress is only the live search input (always starts empty)
  const [locationAddress, setLocationAddress] = useState('');
  const [locationDisplay, setLocationDisplay] = useState('');
  const [geocodedLocation, setGeocodedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Skills
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [phoneError, setPhoneError] = useState('');
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
      });
      if (professionalProfile.location?.latitude && professionalProfile.location?.longitude) {
        setGeocodedLocation({
          latitude: professionalProfile.location.latitude,
          longitude: professionalProfile.location.longitude,
        });
        setLocationDisplay(
          professionalProfile.location.display ||
          `${professionalProfile.location.latitude.toFixed(4)}, ${professionalProfile.location.longitude.toFixed(4)}`
        );
      }
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
    if (e.target.name === 'phone') setPhoneError('');
  };

  const handleProChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPro({ ...pro, [e.target.name]: e.target.value });
  };

  const handleAddressChange = (value: string) => {
    setLocationAddress(value);
  };

  const handleLocationSelect = (suggestion: GeocodeSuggestion) => {
    setLocationAddress('');
    setLocationDisplay(suggestion.shortName);
    setGeocodedLocation({ latitude: suggestion.latitude, longitude: suggestion.longitude });
  };

  const handleLocationClear = () => {
    setGeocodedLocation(null);
    setLocationDisplay('');
    setLocationAddress('');
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
    const pErr = validatePhone(basic.phone);
    if (pErr) { setPhoneError(pErr); return; }
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
          location: geocodedLocation ?? null,
          locationDisplay: geocodedLocation ? locationDisplay : null,
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
              <label htmlFor="phone" className="form-label">Phone <span className="text-light">(optional)</span></label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="form-input"
                placeholder="e.g. 07911 123456"
                value={basic.phone}
                onChange={handleBasicChange}
                onBlur={() => setPhoneError(validatePhone(basic.phone))}
              />
              {phoneError && <p className="text-xs" style={{ color: 'var(--color-danger, #ef4444)', marginTop: '4px' }}>{phoneError}</p>}
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

                <div className="form-group">
                  <label className="form-label">Your location</label>

                  {/* Saved location chip */}
                  {geocodedLocation && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', marginBottom: '8px',
                      borderRadius: '6px', backgroundColor: '#f0fdf4',
                      border: '1px solid #86efac',
                    }}>
                      <span style={{ fontSize: '0.875rem', flex: 1, color: '#166534' }}>
                        📍 {locationDisplay}
                      </span>
                      <button
                        type="button"
                        onClick={handleLocationClear}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: '1.1rem', lineHeight: 1, padding: '0 2px' }}
                        title="Remove location"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <AddressAutocomplete
                    value={locationAddress}
                    onChange={handleAddressChange}
                    onSelect={handleLocationSelect}
                    placeholder={geocodedLocation ? 'Search to change location…' : 'Start typing your base address or postcode…'}
                  />
                  {!geocodedLocation && (
                    <p className="text-xs text-light" style={{ marginTop: '4px' }}>
                      Used for location-based job matching. Select an address from the dropdown.
                    </p>
                  )}
                </div>
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
