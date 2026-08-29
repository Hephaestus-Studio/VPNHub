import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { vpnTheme } from "./theme/theme";
import { AppShell } from "./components/layout/AppShell";

function App() {
  return (
    <MantineProvider theme={vpnTheme} defaultColorScheme="dark">
      <Notifications position="bottom-right" zIndex={2000} autoClose={4000} />
      <AppShell />
    </MantineProvider>
  );
}

export default App;
