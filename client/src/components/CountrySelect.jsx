import { useState, useRef, useEffect } from 'react';
import { COUNTRIES } from '../utils/countries';

export default function CountrySelect({
  value,
  onChange,
  name = 'country',
  id = 'country',
  placeholder = 'Select country...',
  required = false,
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleSelect = (country) => {
    if (onChange) {
      // Simulate standard event object for seamless integration with formData handlers
      onChange({
        target: {
          name,
          value: country
        }
      });
    }
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange({
        target: {
          name,
          value: ''
        }
      });
    }
    setSearch('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Hidden input for HTML5 required form validation */}
      <input
        type="text"
        id={id}
        name={name}
        value={value || ''}
        required={required}
        onChange={() => {}}
        tabIndex={-1}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: '100%',
          bottom: 0,
          height: 0
        }}
      />

      {/* Select Box / Trigger */}
      <div
        className={`form-input ${className}`}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          padding: '0.65rem 0.9rem',
          minHeight: '44px',
          borderColor: isOpen ? 'var(--accent-primary)' : undefined,
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : undefined,
          transition: 'border-color 0.15s, box-shadow 0.15s'
        }}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (!disabled) setIsOpen(true);
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>

          {value ? (
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {value}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.15rem 0.3rem',
                fontSize: '0.85rem',
                borderRadius: '50%',
                lineHeight: 1
              }}
              title="Clear selection"
            >
              ✕
            </button>
          )}
          <span style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1050,
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Search box inside dropdown */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #f8fafc)' }}>
            <div style={{ position: 'relative' }}>

              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem 0.4rem 2rem',
                  fontSize: '0.85rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-primary, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* List of countries */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '200px' }}>
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => {
                const isSelected = value === country;
                return (
                  <div
                    key={country}
                    onClick={() => handleSelect(country)}
                    style={{
                      padding: '0.55rem 0.9rem',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      color: isSelected ? 'var(--accent-primary, #2563eb)' : 'var(--text-primary, #0f172a)',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'background 0.12s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary, #f1f5f9)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>{country}</span>
                    {isSelected && <span style={{ fontSize: '0.85rem' }}>✓</span>}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No country found matching "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
