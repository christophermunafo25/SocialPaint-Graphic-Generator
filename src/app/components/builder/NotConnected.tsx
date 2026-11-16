import React, { useEffect, useRef } from "react";
import { Button, ModalActions, ModalBody } from "../primitives";
import { useRouter } from "../../router";
import { focusLost } from "./useStillOpen";

/** What an import's dialog says when the workspace hasn't connected the
 * service. */
export const notConnectedLine = (service: "Figma" | "Canva") =>
  `Your workspace hasn't connected ${service}.`;

/** An import's dialog when the workspace hasn't connected the service: the
 * one line, then Cancel and Open settings, which goes to Integrations. It
 * replaces the link field once the check comes back, so it takes the focus
 * the field had. */
export function NotConnected({
  service,
  onClose,
}: {
  service: "Figma" | "Canva";
  onClose(): void;
}) {
  const { navigate } = useRouter();
  const openSettings = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusLost()) openSettings.current?.focus();
  }, []);
  return (
    <>
      <ModalBody>{notConnectedLine(service)}</ModalBody>
      <ModalActions>
        <Button kind="neutral" onClick={onClose}>
          Cancel
        </Button>
        <Button
          ref={openSettings}
          kind="primary"
          onClick={() => {
            onClose();
            navigate({ name: "settings", section: "integrations" });
          }}
        >
          Open settings
        </Button>
      </ModalActions>
    </>
  );
}
