import { LogoOrbit } from "@/components/ui/logo-orbit";

function ReactIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 10.11c1.03 0 1.87.84 1.87 1.89 0 1-.84 1.85-1.87 1.85-1.03 0-1.87-.85-1.87-1.85 0-1.05.84-1.89 1.87-1.89M7.37 20c.63.38 2.01-.2 3.6-1.7-.52-.59-1.03-1.23-1.51-1.9a22.7 22.7 0 0 1-2.4-.36c-.51 2.14-.32 3.61.31 3.96m.71-5.74-.29-.51c-.11.29-.22.58-.29.86.27.06.57.11.88.16l-.3-.51m6.54-.76.81-1.5-.81-1.5c-.3-.53-.62-1-.91-1.47C13.17 9 12.6 9 12 9c-.6 0-1.17 0-1.71.03-.29.47-.61.94-.91 1.47L8.57 12l.81 1.5c.3.53.62 1 .91 1.47.54.03 1.11.03 1.71.03.6 0 1.17 0 1.71-.03.29-.47.61-.94.91-1.47M12 6.78c-.19.2-.39.42-.59.65h1.18c-.2-.23-.4-.45-.59-.65M12 17.22c.19-.2.39-.42.59-.65h-1.18c.2.23.4.45.59.65M16.62 4c-.62-.38-2 .2-3.59 1.7.52.59 1.03 1.23 1.51 1.9.82.08 1.63.2 2.4.36.51-2.14.32-3.61-.32-3.96m-.7 5.74.29.51c.11-.29.22-.58.29-.86-.27-.06-.57-.11-.88-.16zM17.37 16c.95-.57 1.56-1.53 1.56-2.5s-.61-1.93-1.56-2.5c.17-.37.32-.75.44-1.13 2.05.59 3.44 1.68 3.44 3.63s-1.39 3.04-3.44 3.63c-.12-.38-.27-.76-.44-1.13M6.63 16c-.95.57-1.56 1.53-1.56 2.5s.61 1.93 1.56 2.5c-.17.37-.32.75-.44 1.13-2.05-.59-3.44-1.68-3.44-3.63s1.39-3.04 3.44-3.63c.12.38.27.76.44 1.13M17.37 8c.95.57 1.56 1.53 1.56 2.5S18.32 12.43 17.37 13c.12.38.27.76.44 1.13 2.05-.59 3.44-1.68 3.44-3.63S19.86 7.46 17.81 6.87c-.17.37-.32.75-.44 1.13" />
    </svg>
  );
}

function FigmaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 24c2.2 0 4-1.8 4-4v-4H8c-2.2 0-4 1.8-4 4s1.8 4 4 4zM4 12c0-2.2 1.8-4 4-4h4v8H8c-2.2 0-4-1.8-4-4zM4 4c0-2.2 1.8-4 4-4h4v8H8C5.8 8 4 6.2 4 4zM12 0h4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4V0zM20 12c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4 4 1.8 4 4z" />
    </svg>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5.04 15.17a2.53 2.53 0 0 1-2.53-2.53 2.53 2.53 0 0 1 2.53-2.53H7.6v2.53a2.53 2.53 0 0 1-2.56 2.53m10.4-2.53a2.53 2.53 0 0 1 2.53-2.53 2.53 2.53 0 0 1 2.53 2.53 2.53 2.53 0 0 1-2.53 2.53h-2.53zm-7.87 7.9a2.53 2.53 0 0 1-2.53-2.53 2.53 2.53 0 0 1 2.53-2.53h2.56v2.53a2.53 2.53 0 0 1-2.56 2.53m5.33-5.07h-2.53v-2.53a2.53 2.53 0 0 1 2.53-2.53 2.53 2.53 0 0 1 2.53 2.53v2.53z" />
    </svg>
  );
}

function NotionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 4h16v16H4z" opacity="0" />
      <path d="M5 3.5 15.5 3l3.5.5v17l-3.5-.5L5 20V3.5zM8 7v10l1.5-1V8l5 9 1.5-.6V6l-1.5.5v8L9.3 6 8 7z" />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.3-1.4-1.7-1.4-1.7-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.3-3.3 4.4 4.4 0 0 1 .1-3.2s1-.3 3.3 1.3a11.5 11.5 0 0 1 6 0C16.3 5 17.3 5.3 17.3 5.3a4.4 4.4 0 0 1 .1 3.2 4.7 4.7 0 0 1 1.3 3.3c0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" />
    </svg>
  );
}

export default function LogoOrbitDemo() {
  const inner = [
    { label: "React", icon: ReactIcon, color: "#61dafb" },
    { label: "Figma", icon: FigmaIcon, color: "#a259ff" },
    { label: "Slack", icon: SlackIcon, color: "#ecb22e" },
  ];

  const outer = [
    { label: "Notion", icon: NotionIcon },
    { label: "GitHub", icon: GithubIcon },
  ];

  return (
    <div className="flex w-full items-center justify-center p-10">
      <div className="w-full max-w-xl">
        <LogoOrbit
          orbits={[
            { items: inner, radius: 0.55, lap: 14 },
            { items: outer, radius: 0.95, lap: -22 },
          ]}
        >
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Connects with
            </p>
            <p className="text-lg font-semibold text-foreground">
              Your favorite tools
            </p>
          </div>
        </LogoOrbit>
      </div>
    </div>
  );
}
