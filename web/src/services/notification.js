export function notify(message, type = "success") {
  window.dispatchEvent(
    new CustomEvent("abc:notification", {
      detail: { id: crypto.randomUUID(), message, type },
    }),
  );
}
