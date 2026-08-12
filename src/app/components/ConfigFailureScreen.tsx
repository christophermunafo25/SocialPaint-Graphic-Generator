/** Full-screen stop for a production bundle that shipped without a data
 * backend. Deliberately not ErrorState: there is no retry, and nothing else
 * may load behind it. The copy names a deployment problem, not a user one, and
 * carries no configuration detail — that goes to the console (main.tsx).
 * This module must stay free of store/auth imports: nothing on this path may
 * touch localStorage. */
export function ConfigFailureScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--bg-canvas)", fontFamily: "var(--font-ui)" }}
    >
      <div className="text-center space-y-3" style={{ maxWidth: 440 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
          This app isn't set up yet
        </p>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          The service is missing part of its deployment configuration, so it can't sign you in or
          save anything you make.
        </p>
        <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
          This is a problem with the deployment — not with your account, browser, or device. Please
          contact whoever runs this site.
        </p>
      </div>
    </div>
  );
}
