import { DragLayer } from './components/drag/DragLayer.tsx';
import { Stage } from './components/desk/Stage.tsx';
import { DevMenu } from './screens/DevMenu.tsx';
import { EndScreen } from './screens/EndScreen.tsx';
import { HiringScreen } from './screens/HiringScreen.tsx';
import { Hub } from './screens/hub/Hub.tsx';
import { LabPlaceholder } from './screens/LabPlaceholder.tsx';
import { PressRun } from './screens/PressRun.tsx';
import { SetupScreen } from './screens/SetupScreen.tsx';
import { TitleScreen } from './screens/TitleScreen.tsx';
import { useStore } from './state/store.ts';

export function App() {
  const screen = useStore((s) => s.screen);
  return (
    <Stage>
      {screen === 'title' ? <TitleScreen /> : null}
      {screen === 'setup' ? <SetupScreen /> : null}
      {screen === 'hiring' ? <HiringScreen /> : null}
      {screen === 'hub' ? <Hub /> : null}
      {screen === 'press' ? <PressRun /> : null}
      {screen === 'end' ? <EndScreen /> : null}
      {screen === 'lab' ? <LabPlaceholder /> : null}
      <DragLayer />
      {import.meta.env.DEV ? <DevMenu /> : null}
    </Stage>
  );
}
