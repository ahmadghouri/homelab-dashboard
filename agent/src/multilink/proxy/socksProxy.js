import net from 'node:net';
import { bridgeSockets, connectUpstream } from './connectUpstream.js';

// SOCKS5 proxy (RFC 1928): no-authentication method and the CONNECT command only.

const SOCKS_VERSION = 0x05;
const METHOD_NO_AUTH = 0x00;
const METHOD_NONE_ACCEPTABLE = 0xff;
const COMMAND_CONNECT = 0x01;
const ADDRESS_IPV4 = 0x01;
const ADDRESS_DOMAIN = 0x03;
const ADDRESS_IPV6 = 0x04;
const HANDSHAKE_TIMEOUT_MS = 10_000;
// Greeting + request never need more than this; anything larger is not a SOCKS5 client.
const MAX_HANDSHAKE_BYTES = 600;

export const SOCKS_REPLY = Object.freeze({
  succeeded: 0x00,
  generalFailure: 0x01,
  networkUnreachable: 0x03,
  hostUnreachable: 0x04,
  connectionRefused: 0x05,
  commandNotSupported: 0x07,
  addressTypeNotSupported: 0x08,
});

const REPLY_BY_ERROR_CODE = {
  ENOLINE: SOCKS_REPLY.networkUnreachable,
  ENETUNREACH: SOCKS_REPLY.networkUnreachable,
  ENETDOWN: SOCKS_REPLY.networkUnreachable,
  EADDRNOTAVAIL: SOCKS_REPLY.networkUnreachable,
  EHOSTUNREACH: SOCKS_REPLY.hostUnreachable,
  ETIMEDOUT: SOCKS_REPLY.hostUnreachable,
  ENOTFOUND: SOCKS_REPLY.hostUnreachable,
  EAI_AGAIN: SOCKS_REPLY.hostUnreachable,
  ECONNREFUSED: SOCKS_REPLY.connectionRefused,
};

// Reply with the bound address; failures use 0.0.0.0:0 as RFC 1928 allows.
function buildReply(code, socket) {
  const address = (socket?.localAddress ?? '0.0.0.0').replace(/^::ffff:(?=\d+\.)/i, '');
  const port = socket?.localPort ?? 0;
  if (net.isIPv6(address)) {
    const reply = Buffer.alloc(22);
    reply.set([SOCKS_VERSION, code, 0x00, ADDRESS_IPV6]);
    expandIpv6(address).forEach((group, index) => reply.writeUInt16BE(group, 4 + index * 2));
    reply.writeUInt16BE(port, 20);
    return reply;
  }
  const octets = net.isIPv4(address) ? address.split('.').map(Number) : [0, 0, 0, 0];
  const reply = Buffer.from([SOCKS_VERSION, code, 0x00, ADDRESS_IPV4, ...octets, 0, 0]);
  reply.writeUInt16BE(port, 8);
  return reply;
}

// Expands a (possibly shortened) IPv6 address into its 8 groups.
function expandIpv6(address) {
  const [head, tail = ''] = address.split('::');
  const parse = (part) => (part ? part.split(':').map((group) => Number.parseInt(group, 16) || 0) : []);
  const start = parse(head);
  const end = parse(tail);
  const zeros = address.includes('::') ? Array.from({ length: 8 - start.length - end.length }, () => 0) : [];
  return [...start, ...zeros, ...end].slice(0, 8);
}

function formatIpv6(buffer) {
  const groups = [];
  for (let i = 0; i < 16; i += 2) {
    groups.push(buffer.readUInt16BE(i).toString(16));
  }
  return groups.join(':');
}

// Parses the greeting. Returns null while incomplete, otherwise { size, noAuth } or { invalid: true }.
export function parseGreeting(buffer) {
  if (buffer.length < 2) {
    return null;
  }
  if (buffer[0] !== SOCKS_VERSION) {
    return { invalid: true };
  }
  const size = 2 + buffer[1];
  if (buffer.length < size) {
    return null;
  }
  return { size, noAuth: buffer.subarray(2, size).includes(METHOD_NO_AUTH) };
}

// Parses the request. Returns null while incomplete, otherwise { size, host, port } or { size, error: replyCode }.
export function parseRequest(buffer) {
  if (buffer.length < 5) {
    return null;
  }
  if (buffer[0] !== SOCKS_VERSION) {
    return { size: buffer.length, error: SOCKS_REPLY.generalFailure };
  }
  const addressType = buffer[3];
  let host;
  let offset;
  if (addressType === ADDRESS_IPV4) {
    offset = 8;
    host = buffer.length >= offset ? [...buffer.subarray(4, 8)].join('.') : null;
  } else if (addressType === ADDRESS_DOMAIN) {
    offset = 5 + buffer[4];
    host = buffer.length >= offset ? buffer.subarray(5, offset).toString('latin1') : null;
  } else if (addressType === ADDRESS_IPV6) {
    offset = 20;
    host = buffer.length >= offset ? formatIpv6(buffer.subarray(4, 20)) : null;
  } else {
    return { size: buffer.length, error: SOCKS_REPLY.addressTypeNotSupported };
  }
  if (host === null || buffer.length < offset + 2) {
    return null;
  }
  const size = offset + 2;
  if (buffer[1] !== COMMAND_CONNECT) {
    return { size, error: SOCKS_REPLY.commandNotSupported };
  }
  return { size, host, port: buffer.readUInt16BE(offset) };
}

function handleClient(client, context) {
  let buffer = Buffer.alloc(0);
  let stage = 'greeting';
  client.setTimeout(HANDSHAKE_TIMEOUT_MS, () => client.destroy());
  client.on('error', () => client.destroy());

  function fail(code) {
    client.removeListener('data', onData);
    client.end(buildReply(code));
  }

  function connect(request, rest) {
    client.removeListener('data', onData);
    client.pause();
    connectUpstream({ host: request.host, port: request.port, selector: context.selector, usage: context.usage })
      .then(({ socket }) => {
        if (client.destroyed) {
          socket.destroy();
          return;
        }
        context.trackUpstream(socket);
        client.setTimeout(0);
        client.write(buildReply(SOCKS_REPLY.succeeded, socket));
        if (rest.length > 0) {
          socket.write(rest);
        }
        bridgeSockets(client, socket);
      })
      .catch((error) => {
        if (!client.destroyed) {
          client.end(buildReply(REPLY_BY_ERROR_CODE[error.code] ?? SOCKS_REPLY.generalFailure));
        }
      });
  }

  function onData(chunk) {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > MAX_HANDSHAKE_BYTES) {
      client.destroy();
      return;
    }
    if (stage === 'greeting') {
      const greeting = parseGreeting(buffer);
      if (!greeting) {
        return;
      }
      if (greeting.invalid) {
        client.destroy();
        return;
      }
      if (!greeting.noAuth) {
        client.removeListener('data', onData);
        client.end(Buffer.from([SOCKS_VERSION, METHOD_NONE_ACCEPTABLE]));
        return;
      }
      client.write(Buffer.from([SOCKS_VERSION, METHOD_NO_AUTH]));
      buffer = buffer.subarray(greeting.size);
      stage = 'request';
    }
    const request = parseRequest(buffer);
    if (!request) {
      return;
    }
    if (request.error !== undefined) {
      fail(request.error);
      return;
    }
    connect(request, buffer.subarray(request.size));
  }

  client.on('data', onData);
}

/**
 * Creates (does not start) the SOCKS5 server.
 * `context` = { selector, usage, trackUpstream(socket) }.
 */
export function createSocksProxy(context) {
  return net.createServer({ allowHalfOpen: true }, (client) => handleClient(client, context));
}
