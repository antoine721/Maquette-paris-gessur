// Routes de l'application.
import { AnimatePresence } from 'motion/react';
import { Suspense, lazy } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Logo, Shell } from './components/Shell.jsx';
import { Spinner } from './components/ui.jsx';
import { useSession } from './lib/session.jsx';
import Auth from './pages/Auth.jsx';
import Boosters from './pages/Boosters.jsx';

const Collection = lazy(() => import('./pages/Collection.jsx'));
const Catalogue = lazy(() => import('./pages/Catalogue.jsx'));
const CardPage = lazy(() => import('./pages/CardPage.jsx'));
const Friends = lazy(() => import('./pages/Friends.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner />
    </div>
  );
}

export default function App() {
  const { status, bootError } = useSession();
  const location = useLocation();

  if (bootError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <Logo />
          <p className="mt-4 text-muted">Le serveur ne répond pas. Recharge la page dans un instant.</p>
        </div>
      </div>
    );
  }
  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }
  if (status === 'out') return <Auth />;

  return (
    <Shell>
      <Suspense fallback={<Loading />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Boosters />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/cartes" element={<Catalogue />} />
            <Route path="/carte/:id" element={<CardPage />} />
            <Route path="/amis" element={<Friends />} />
            <Route path="/joueur/:name" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </Shell>
  );
}
