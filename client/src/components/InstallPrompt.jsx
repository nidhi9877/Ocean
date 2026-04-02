import { useState, useEffect } from 'react';
import '../index.css';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'var(--glass-bg)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-md)',
      padding: '15px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      zIndex: 9999,
      boxShadow: 'var(--shadow-lg)',
      width: 'max-content',
      maxWidth: '90%',
      color: 'var(--text-primary)'
    }}>
      <div>
        <h4 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '1rem' }}>Install App</h4>
        <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Add to home screen for a better experience
        </p>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={handleClose}
          className="btn btn-secondary btn-sm"
          style={{ padding: '0.4rem 0.8rem' }}
        >
          Not Now
        </button>
        <button 
          onClick={handleInstallClick}
          className="btn btn-primary btn-sm"
          style={{ padding: '0.4rem 0.8rem' }}
        >
          Install
        </button>
      </div>
    </div>
  );
}
