export { DOQueueHandler } from "@opennextjs/cloudflare/durable-objects/queue";
export { DOShardedTagCache } from "@opennextjs/cloudflare/durable-objects/sharded-tag-cache";

export default {
  fetch: () => {
    return new Response("Hello from OpenNext Cache Worker!");
  },
};
