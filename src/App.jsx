import { Component, useEffect, useState } from 'react';
import { GameProvider, useGame } from './context/GameContext.jsx';
import { AppShell } from './components/layout.jsx';
import { SetupScreen } from './components/SetupScreen.jsx';
import { SquadComposer } from './components/SquadComposer.jsx';
import { TurnBoard } from './components/TurnBoard.jsx';
import { ReviewBoard } from './components/ReviewBoard.jsx';
import { ModeratorBar } from './components/ModeratorBar.jsx';
import { DisplayView } from './components/DisplayView.jsx';
import { Button, ErrorState, Modal, Spinner } from './components/common.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-16">
          <ErrorState
            message="Terjadi galat tak terduga. Muat ulang atau mulai game baru."
            onRetry={() => window.location.reload()}
          />
          <div className="mt-3 text-center">
            <Button variant="ghost" onClick={() => { try { localStorage.clear(); } catch {} window.location.reload(); }}>
              Reset Game
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ContinueDialog({ onContinue, onNew }) {
  return (
    <Modal title="Lanjutkan sesi?" onClose={onContinue}>
      <p className="text-sm text-[#A9BCE6]">Ada sesi tersimpan yang belum selesai (format v3).</p>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={onNew} className="flex-1" aria-label="Buang sesi dan mulai baru">Mulai Baru</Button>
        <Button onClick={onContinue} className="flex-1" aria-label="Lanjutkan sesi tersimpan">Lanjutkan</Button>
      </div>
    </Modal>
  );
}

function PhaseRouter() {
  const { state, derived, actions, dataset } = useGame();
  const [resumed, setResumed] = useState(false);

  // Shortcut moderator: R reveal, U undo, Enter turn berikutnya.
  useEffect(() => {
    if (state.phase !== 'DRAFT') return;
    const onKey = (e) => {
      if (e.target.matches('input,select,textarea')) return;
      if (e.key === 'u' || e.key === 'U') actions.undo();
      if (e.key === 'r' || e.key === 'R') actions.revealTurn();
      if (e.key === 'Enter') actions.nextTurn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, actions]);

  if (dataset.status === 'loading' || dataset.status === 'idle') {
    return (
      <AppShell phase={state.phase}>
        <Spinner label="Memuat daftar klub..." />
      </AppShell>
    );
  }

  if (dataset.status === 'error') {
    return (
      <AppShell phase={state.phase}>
        <ErrorState message="Daftar klub gagal dimuat. Periksa koneksi lalu coba lagi." onRetry={dataset.refetch} />
      </AppShell>
    );
  }

  const showResume = state.sessionId && state.phase !== 'SETUP' && !resumed;
  const club = dataset.clubs.find((c) => c.id === state.config.clubId)
    ?? (dataset.snapshot ? { ...dataset.snapshot.club, squadSize: dataset.snapshot.squad.length } : null);

  return (
    <AppShell phase={state.phase} managersView={derived.managersView} club={club} progress={derived.progress}>
      {showResume && (
        <ContinueDialog onContinue={() => setResumed(true)} onNew={() => { setResumed(true); actions.resetGame(); }} />
      )}

      {state.phase === 'SETUP' && (
        <div className="mt-4">
          <SetupScreen dataset={dataset} onStart={({ managers, config }) => actions.startCompose({ managers, config })} />
        </div>
      )}

      {state.phase !== 'SETUP' && (
        <ModeratorBar state={state} actions={actions} managersView={derived.managersView} />
      )}

      {state.phase === 'COMPOSE' && (
        <div className="mt-4">
          <SquadComposer state={state} actions={actions} entityMap={derived.entityMap} squad={dataset.players} targets={dataset.targets} coaches={dataset.coaches} clubId={state.config.clubId} datasetIssues={dataset.issues} onReloadDataset={dataset.refetch} />
        </div>
      )}

      {state.phase === 'DRAFT' && (
        <div className="mt-4">
          <TurnBoard state={state} actions={actions} derived={derived} entityMap={derived.entityMap} />
        </div>
      )}

      {state.phase === 'REVIEW' && (
        <div className="mt-4">
          <ReviewBoard managersView={derived.managersView} comparison={derived.comparison} state={state} actions={actions} entityMap={derived.entityMap} club={club} />
        </div>
      )}
    </AppShell>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'display') {
    return (
      <ErrorBoundary>
        <GameProvider>
          <DisplayRoute />
        </GameProvider>
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary>
      <GameProvider>
        <PhaseRouter />
      </GameProvider>
    </ErrorBoundary>
  );
}

function DisplayRoute() {
  const { state, dataset, derived } = useGame();
  return <DisplayView liveState={state} dataset={dataset} entityMap={derived.entityMap} />;
}
