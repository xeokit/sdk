#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const http = require("http");

const port = Number(process.env.PORT || process.argv[2] || 8098);
const path = process.env.PATHNAME || "/flight-sim";
const host = process.env.HOST || "127.0.0.1";
const clients = new Set();

const server = http.createServer((request, response) => {
  if (request.url === "/" || request.url === path) {
    response.writeHead(200, {"content-type": "text/plain; charset=utf-8"});
    response.end(`xeokit Amsterdam flight-sim relay\nWebSocket path: ${path}\n`);
    return;
  }
  response.writeHead(404, {"content-type": "text/plain; charset=utf-8"});
  response.end("Not found\n");
});

server.on("upgrade", (request, socket) => {
  if (!request.url.startsWith(path)) {
    socket.destroy();
    return;
  }
  const key = request.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));

  clients.add(socket);
  socket.on("data", (buffer) => {
    for (const message of decodeFrames(buffer)) {
      if (message === null) {
        socket.end();
        return;
      }
      broadcast(message, socket);
    }
  });
  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
});

server.listen(port, host, () => {
  console.log(`xeokit Amsterdam flight-sim relay listening on ws://${host}:${port}${path}`);
});

function broadcast(message, sender) {
  const frame = encodeTextFrame(message);
  for (const client of clients) {
    if (client !== sender && !client.destroyed) {
      client.write(frame);
    }
  }
}

function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset++];
    const second = buffer[offset++];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    if (length === 126) {
      if (offset + 2 > buffer.length) break;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (offset + 8 > buffer.length) break;
      const high = buffer.readUInt32BE(offset);
      const low = buffer.readUInt32BE(offset + 4);
      offset += 8;
      length = high * 2 ** 32 + low;
    }
    const mask = masked ? buffer.subarray(offset, offset + 4) : null;
    if (masked) {
      offset += 4;
    }
    if (offset + length > buffer.length) {
      break;
    }
    const payload = Buffer.from(buffer.subarray(offset, offset + length));
    offset += length;
    if (opcode === 8) {
      messages.push(null);
      continue;
    }
    if (opcode !== 1) {
      continue;
    }
    if (mask) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i & 3];
      }
    }
    messages.push(payload.toString("utf8"));
  }
  return messages;
}

function encodeTextFrame(message) {
  const payload = Buffer.from(String(message), "utf8");
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  if (payload.length < 65536) {
    const header = Buffer.allocUnsafe(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.allocUnsafe(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeUInt32BE(0, 2);
  header.writeUInt32BE(payload.length, 6);
  return Buffer.concat([header, payload]);
}
