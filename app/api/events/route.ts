import { auth } from "@/lib/auth";
import { addClient, removeClient } from "@/lib/mqtt/sse";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const id = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      addClient(id, controller);

      // Send an initial comment so the browser knows the connection is live
      controller.enqueue(new TextEncoder().encode(": connected\n\n"));

      req.signal.addEventListener("abort", () => {
        removeClient(id);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
