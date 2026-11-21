import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ title, description, children, onClose, busy = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog
      className="modal"
      ref={dialog}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p id="modal-description" className="muted">
              {description}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={busy}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
