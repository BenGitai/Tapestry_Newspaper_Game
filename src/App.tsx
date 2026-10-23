import { DragLayer } from './components/drag/DragLayer.tsx';
import { Stage } from './components/desk/Stage.tsx';
import { DevMenu } from './screens/DevMenu.tsx';
import { Editor } from './screens/editor/Editor.tsx';
import { EndScreen } from './screens/EndScreen.tsx';
import { LabPlaceholder } from './screens/LabPlaceholder.tsx';
import { PressRun } from './screens/PressRun.tsx';
import { TitleScreen } from './screens/TitleScreen.tsx';
import { useStore } from './state/store.ts';

export function App() {
  const screen = useStore((s) => s.screen);
  return (
    <Stage>
      {screen === 'title' || screen === 'setup' ? <TitleScreen /> : null}
      {screen === 'editor' ? <Editor /> : null}
      {screen === 'press' ? <PressRun /> : null}
      {screen === 'end' ? <EndScreen /> : null}
      {screen === 'lab' ? <LabPlaceholder /> : null}
      <DragLayer />
      {import.meta.env.DEV ? <DevMenu /> : null}
    </Stage>
  );
}
