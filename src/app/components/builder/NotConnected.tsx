import React from "react";
import { Button, ModalActions, ModalBody } from "../primitives";
import { useRouter } from "../../router";

/** An import's dialog when the workspace hasn't connected the service: the
 * one line, then Cancel and Open settings, which goes to Integrations. */
export function NotConnected({
  service,
  onClose,
}: {
  service: "Figma" | "Canva";
  onClose(): void;
}) {
  const { navigate } = useRouter();
  return (
    <>
      <ModalBody>{`${service} isn't connected for this workspace.`}</ModalBody>
      <ModalActions>
        <Button kind="neutral" onClick={onClose}>
          Cancel
        </Button>
        <Button
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
