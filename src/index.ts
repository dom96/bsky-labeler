import { encode as cborEncode } from "@atcute/cbor";
import type { At } from "@atcute/client/lexicons";
import { concat as ui8Concat } from "uint8arrays";

function frameToBytes(type: "error", body: unknown): Uint8Array;
function frameToBytes(type: "message", body: unknown, t: string): Uint8Array;
function frameToBytes(type: "error" | "message", body: unknown, t?: string): Uint8Array {
  const header = type === "error" ? { op: -1 } : { op: 1, t };
  return ui8Concat([cborEncode(header), cborEncode(body)]);
}

const LABEL_VERSION = 1;

// TODO: Signatures. But do I really need them? Guess not.

// export function formatLabel(
// 	label: UnsignedLabel & { sig?: ArrayBuffer | Uint8Array | At.Bytes },
// ): FormattedLabel {
// 	const sig = label.sig instanceof ArrayBuffer
// 		? toBytes(new Uint8Array(label.sig))
// 		: label.sig instanceof Uint8Array
// 		? toBytes(label.sig)
// 		: label.sig;
// 	if (!sig || !("$bytes" in sig)) {
// 		throw new Error("Expected sig to be an object with base64 $bytes, got " + sig);
// 	}
// 	return { ...label, ver: LABEL_VERSION, neg: !!label.neg, sig };
// }

// export function signLabel(label: UnsignedLabel, signingKey: Uint8Array): SignedLabel {
// 	const toSign = formatLabelCbor(label);
// 	const bytes = cborEncode(toSign);
// 	const sig = k256Sign(signingKey, bytes);
// 	return { ...toSign, sig };
// }

async function replay(sub: WebSocket, cursor: number | null) {
  // XXX: Read from your DB any rows after `cursor`.
  const rows = [
    {

    }
  ];

  for (const row of rows) {
    // https://atproto.com/specs/label#schema-and-data-model
    const label = {
      ver: LABEL_VERSION,
      src: "did:plc:3og4uthwqpnlasfb4hnlyysr" as At.DID, // @labelertest42.bsky.social
      uri: "did:plc:z72i7hdynmk6r22z27h6tvur", // @bsky.app
      val: "verified-human",
      neg: false,
      cts: "2024-12-21T19:45:01.398Z",
    };
    const bytes = frameToBytes("message", {
      seq: 0, // XXX: Row ID
      labels: [/*formatLabel(*/label/*)*/],
    }, "#labels");
    sub.send(bytes);
  }
}

let subscribers: WebSocket[] = [];

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    console.log("URL: ", request.url);
    console.log("Request: ", JSON.stringify(new Map(request.headers)));
    console.log("Text: ", await request.text());

    if (url.pathname == "/init" && request.method == "POST") {
      // Set up labelling service and label defs.
      //
      // As an example, here is a labeller's service record https://api.bsky.app/xrpc/com.atproto.repo.getRecord?repo=skywatch.blue&collection=app.bsky.labeler.service&rkey=self
      //
      // Meh, it's just easier to run `npx @skyware/labeler setup` and it sets everything up for you.

    } else if (url.pathname == "/xrpc/com.atproto.label.subscribeLabels") {
      // Set up WS connection.
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      subscribers.push(server);
      replay(server, cursor).catch(reason => console.error(reason));

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("404", { status: 404 });

  },
} satisfies ExportedHandler<Env>;
