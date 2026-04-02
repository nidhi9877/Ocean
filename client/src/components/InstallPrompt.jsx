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
      gap: '1.25rem',
      marginTop: '3rem',
      padding: '1.5rem 2rem',
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(15px)',
      WebkitBackdropFilter: 'blur(15px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
      animation: 'fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) both',
      maxWidth: '400px',
      width: '100%',
    }}>
      <p style={{ 
        margin: 0, 
        fontSize: '1rem', 
        fontWeight: '500', 
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: "'Outfit', sans-serif"
      }}>
        Experience MarinTech on your home screen
      </p>
      
      <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
        <button
          onClick={handleInstall}
          style={{
            flex: 2,
            padding: '0.8rem 1.5rem',
            borderRadius: '12px',
            fontSize: '0.95rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #9bf8f4 0%, #6f7bf7 100%)',
            border: 'none',
            color: '#0f1729',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(155, 248, 244, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(155, 248, 244, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(155, 248, 244, 0.3)';
          }}
        >
          Install Now
        </button>
        <button
          onClick={handleDismiss}
          style={{
            flex: 1,
            padding: '0.8rem 1rem',
            borderRadius: '12px',
            fontSize: '0.9rem',
            fontWeight: '600',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
