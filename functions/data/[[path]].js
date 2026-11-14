export async function onRequestGet(context) {
  // A service binding must be configured explicitly. Never proxy owner tokens.
  if (context.env.DATA_WORKER) return context.env.DATA_WORKER.fetch(context.request);
  return context.next(); // Dated checked-in snapshot while activation is blocked.
}
