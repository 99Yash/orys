/**
 * Poke event bus. Server-side pub/sub for triggering client pulls.
 * In-memory for local dev; swap for Redis pubsub in production.
 */

type PokeHandler = () => void;
type Channel = Set<PokeHandler>;

const channels = new Map<string, Channel>();

export function subscribe(channel: string, handler: PokeHandler): () => void {
  let ch = channels.get(channel);
  if (!ch) {
    ch = new Set();
    channels.set(channel, ch);
  }
  ch.add(handler);
  return () => {
    ch!.delete(handler);
    if (ch!.size === 0) channels.delete(channel);
  };
}

export function publish(channel: string) {
  const ch = channels.get(channel);
  if (ch) {
    for (const handler of ch) handler();
  }
}

/** Emit pokes after a push. */
export function emitPokes(
  userId: string,
  affectedListingIds: Set<string>,
) {
  publish("poke:feed:home");
  publish(`poke:user:${userId}`);
  for (const id of affectedListingIds) {
    publish(`poke:listing:${id}`);
  }
}
