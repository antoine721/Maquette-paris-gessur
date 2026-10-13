import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, Page } from '../components/ui.jsx';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Page>
      <EmptyState title="Page introuvable" action={<Button variant="gold" onClick={() => navigate('/')}>Retour aux boosters</Button>}>
        Cette page n’existe pas, ou plus.
      </EmptyState>
    </Page>
  );
}
