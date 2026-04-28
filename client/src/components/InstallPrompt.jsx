import { useState, useEffect } from 'react';
import '../index.css';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsDismissed(false);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (isInstalled || isDismissed || !deferredPrompt) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      marginTop: '3rem',
      padding: '1.25rem 1.75rem',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      animation: 'fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) both',
      maxWidth: '400px',
      width: '100%',
    }}>
      <p style={{ 
        margin: 0, 
        fontSize: '0.95rem', 
        fontWeight: '500', 
        color: 'var(--text-primary)',
        fontFamily: "'Outfit', sans-serif"
      }}>
        Install Vortex on your device
      </p>
      
      <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
        <button
          onClick={handleInstall}
          className="btn btn-primary"
          style={{ flex: 2 }}
        >
          Install Now
        </button>
        <button
          onClick={handleDismiss}
          className="btn btn-secondary"
          style={{ flex: 1 }}
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
