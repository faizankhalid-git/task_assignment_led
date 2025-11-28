import { useEffect, useState } from 'react';
import { AuthGuard } from './components/AuthGuard';
import { AdminPanel } from './components/AdminPanel';
import { LEDDisplay } from './components/LEDDisplay';

function App() {
  const [isLEDMode, setIsLEDMode] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    setIsLEDMode(path === '/led' || path.startsWith('/led/'));
  }, []);

  if (isLEDMode) {
    return <LEDDisplay />;
  }

  return (
    <AuthGuard>
      <AdminPanel />
    </AuthGuard>
  );
}

export default App;
