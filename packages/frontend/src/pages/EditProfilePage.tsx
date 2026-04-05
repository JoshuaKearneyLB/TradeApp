import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOnboardingStatus, onboardProfessional } from '../services/paymentService';

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
import { NotificationBell } from '../components/NotificationBell';

export function EditProfilePage() {
  const { user, professionalProfile, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [basic, setBasic] = useState({ firstName: '', lastName: '', phone: '' });
  const [pro, setPro] = useState({
    bio: '',
    hourlyRate: '',
    availabilityRadiusKm: '20',
    isAvailable: true,
  });

  const [locationAddress, setLocationAddress] = useState('');
  const [locationDisplay, setLocationDisplay] = useState('');
  const [geocodedLocation, setGeocodedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [phoneError, setPhoneError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [stripeComplete, setStripeComplete] = useState<boolean | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const isPro = user?.role === UserRole.PROFESSIONAL;

  useEffect(() => {
    if (user) {
      setBasic({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' });
    }
    if (professionalProfile) {
      setPro({
        bio: professionalProfile.bio || '',
        hourlyRate: professionalProfile.hourlyRate ? String(professionalProfile.hourlyRate) : '',
        availabilityRadiusKm: String(professionalProfile.availabilityRadiusKm),
        isAvailable: professionalProfile.isAvailable,
      });
      if (professionalProfile.location?.latitude && professionalProfile.location?.longitude) {
        setGeocodedLocation({ latitude: professionalProfile.location.latitude, longitude: professionalProfile.location.longitude });
        setLocationDisplay(
          professionalProfile.location.display ||
          `${professionalProfile.location.latitude.toFixed(4)}, ${professionalProfile.location.longitude.toFixed(4)}`
        );
      }
    }
  }, [user, professionalProfile]);

  useEffect(() => {
    if (!isPro) return;
    jobService.getCategories().then(setCategories).catch(console.error);
    profileService.getSkills().then((data) => setSkills(data.skills)).catch(console.error);
    getOnboardingStatus()
      .then(({ complete }) => setStripeComplete(complete))
      .catch(() => setStripeComplete(false));
  }, [isPro, searchParams]);

  const handleConnectStripe = async () => {
    setStripeLoading(true);
    try {
      const { url } = await onboardProfessional();
      window.location.href = url;
    } catch {
      setStripeLoading(false);
    }
  };

  const handleBasicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBasic({ ...basic, [e.target.name]: e.target.value });
    if (e.target.name === 'phone') setPhoneError('');
  };

  const handleProChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPro({ ...pro, [e.target.name]: e.target.value });
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
      await profileService.updateProfile({ firstName: basic.firstName, lastName: basic.lastName, phone: basic.phone });
      if (isPro) {
        await profileService.updateProfessionalProfile({
          bio: pro.bio || null,
          hourlyRate: pro.hourlyRate ? Number(pro.hourlyRate) : null,
          availabilityRadiusKm: Number(pro.availabilityRadiusKm),
          isAvailable: pro.isAvailable,
          location: geocodedLocation ?? null,
          locationDisplay: geocodedLocation ? locationDisplay : null,
        });
        await profileService.updateSkills(
          skills.map((s) => ({ categoryId: s.categoryId, yearsExperience: s.yearsExperience }))
        );
      }
      await refreshUser();
      setSuccess('Profile saved successfully');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp<span className="navbar-brand-dot" /></Link>
          <div className="navbar-actions">
            <Link to="/dashboard" className="navbar-link">Dashboard</Link>
            <NotificationBell />
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>Log out</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Header */}
        <div className="animate-in" style={{ marginBottom: 32 }}>
          <p className="section-label">Account</p>
          <h1 style={{ marginBottom: 6 }}>
            Edit profile
            <span style={{ color: 'var(--color-amber)' }}>.</span>
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Update your {isPro ? 'personal and professional details' : 'account information'}.
          </p>
        </div>

        <form onSubmit={handleSave} className="animate-in animate-in-delay-1">
          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}
          {success && (
            <div style={{
              padding: '14px 18px', marginBottom: 20, borderRadius: 'var(--radius)',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              color: '#0f766e', fontSize: '0.875rem', fontWeight: 600,
            }}>
              ✓ {success}
            </div>
          )}

          {/* Stripe Connect banner — professionals only */}
          {isPro && stripeComplete !== null && (
            <div style={{
              padding: '16px 18px', marginBottom: 20, borderRadius: 'var(--radius)',
              background: stripeComplete ? 'rgba(13,148,136,0.08)' : 'rgba(13,148,136,0.06)',
              border: `1px solid ${stripeComplete ? 'rgba(13,148,136,0.3)' : 'rgba(13,148,136,0.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: stripeComplete ? '#0f766e' : '#0f766e', marginBottom: 2 }}>
                  {stripeComplete ? '✓ Payments enabled' : '💳 Connect your bank account'}
                </div>
                <div style={{ fontSize: '0.8rem', color: stripeComplete ? '#0f766e' : '#0f766e', opacity: 0.85 }}>
                  {stripeComplete
                    ? 'You will receive payouts directly to your bank account.'
                    : 'Required to receive payments from customers.'}
                </div>
              </div>
              {!stripeComplete && (
                <button
                  type="button"
                  onClick={handleConnectStripe}
                  disabled={stripeLoading}
                  style={{
                    padding: '8px 16px', border: 'none', borderRadius: 'var(--radius)',
                    background: '#0d9488', color: '#fff',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem',
                    cursor: stripeLoading ? 'default' : 'pointer',
                    opacity: stripeLoading ? 0.7 : 1, flexShrink: 0,
                  }}
                >
                  {stripeLoading ? 'Redirecting…' : 'Connect with Stripe'}
                </button>
              )}
            </div>
          )}

          {/* Personal info */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 18px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Personal information</h4>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName" className="form-label">First name</label>
                <input id="firstName" name="firstName" type="text" className="form-input"
                  value={basic.firstName} onChange={handleBasicChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="lastName" className="form-label">Last name</label>
                <input id="lastName" name="lastName" type="text" className="form-input"
                  value={basic.lastName} onChange={handleBasicChange} required />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="phone" className="form-label">
                Phone <span style={{ color: 'var(--color-text-light)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="phone" name="phone" type="tel" className="form-input"
                placeholder="e.g. 07911 123456"
                value={basic.phone} onChange={handleBasicChange}
                onBlur={() => setPhoneError(validatePhone(basic.phone))}
              />
              {phoneError && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-danger)' }}>{phoneError}</p>}
            </div>
          </div>

          {/* Professional details */}
          {isPro && (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 18px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Professional details</h4>

                <div className="form-group">
                  <label htmlFor="bio" className="form-label">Bio</label>
                  <textarea
                    id="bio" name="bio" className="form-input" rows={4}
                    placeholder="Tell customers about your experience, qualifications and what makes you the right person for the job…"
                    value={pro.bio} onChange={handleProChange}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hourlyRate" className="form-label">Hourly rate</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--color-text-muted)', fontWeight: 600,
                      }}>£</span>
                      <input
                        id="hourlyRate" name="hourlyRate" type="number" className="form-input"
                        min="0" step="0.01" placeholder="0.00"
                        value={pro.hourlyRate} onChange={handleProChange}
                        style={{ paddingLeft: 30 }}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="availabilityRadiusKm" className="form-label">Service radius (km)</label>
                    <input
                      id="availabilityRadiusKm" name="availabilityRadiusKm" type="number" className="form-input"
                      min="1" max="500"
                      value={pro.availabilityRadiusKm} onChange={handleProChange}
                    />
                  </div>
                </div>

                {/* Availability toggle */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Availability</label>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    onClick={() => setPro({ ...pro, isAvailable: !pro.isAvailable })}
                  >
                    <div style={{
                      width: 48, height: 26, borderRadius: 13,
                      background: pro.isAvailable ? 'var(--color-navy)' : 'var(--color-border)',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 10, background: '#fff',
                        position: 'absolute', top: 3,
                        left: pro.isAvailable ? 25 : 3,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: pro.isAvailable ? 'var(--color-navy)' : 'var(--color-text-muted)' }}>
                      {pro.isAvailable ? '🟢 Available for work' : '🔴 Not available'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="card" style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 18px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Base location</h4>

                {geocodedLocation && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', marginBottom: 12,
                    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 'var(--radius)',
                  }}>
                    <span style={{ fontSize: '0.875rem', flex: 1, color: '#0f766e', fontWeight: 500 }}>
                      📍 {locationDisplay}
                    </span>
                    <button
                      type="button"
                      onClick={handleLocationClear}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#0f766e', fontSize: '1.1rem', padding: '0 2px', lineHeight: 1,
                      }}
                      title="Remove location"
                    >
                      ×
                    </button>
                  </div>
                )}

                <AddressAutocomplete
                  value={locationAddress}
                  onChange={setLocationAddress}
                  onSelect={handleLocationSelect}
                  placeholder={geocodedLocation ? 'Search to change location…' : 'Start typing your base address or postcode…'}
                />
                {!geocodedLocation && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                    Used for location-based job matching. Select an address from the dropdown.
                  </p>
                )}
              </div>

              {/* Skills */}
              <div className="card" style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 6px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Skills & trades</h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Select the services you offer and add your years of experience.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {categories.map((cat) => {
                    const skill = skills.find((s) => s.categoryId === cat.id);
                    const isSelected = !!skill;
                    return (
                      <div
                        key={cat.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 14px', borderRadius: 'var(--radius)',
                          border: `1.5px solid ${isSelected ? 'var(--color-navy)' : 'var(--color-border)'}`,
                          background: isSelected ? 'rgba(27,58,92,0.04)' : 'var(--color-surface)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onClick={() => toggleSkill(cat.id)}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                          border: `2px solid ${isSelected ? 'var(--color-navy)' : 'var(--color-border)'}`,
                          background: isSelected ? 'var(--color-navy)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {isSelected && <span style={{ color: '#fff', fontSize: '0.7rem', lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{
                          flex: 1, fontSize: '0.9rem',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--color-navy)' : 'var(--color-text)',
                        }}>
                          {cat.name}
                        </span>
                        {isSelected && (
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: 80, padding: '5px 8px', fontSize: '0.82rem', marginBottom: 0 }}
                            min="0" max="50"
                            placeholder="Yrs exp"
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

          <button type="submit" className="btn btn-primary btn-block" disabled={saving} style={{ fontSize: '1rem', padding: '14px' }}>
            {saving
              ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Saving…</>
              : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
