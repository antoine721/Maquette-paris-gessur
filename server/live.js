// Diffusion en direct (Server-Sent Events) : les amis voient les belles prises et les cadeaux.
export function createLive() {
  const clients = new Set();

  const ping = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, 25000);
  ping.unref();

  return {
    connect(req, res, user) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 4000\n\n');
      res.user = user.username;
      clients.add(res);
      req.on('close', () => {
        clients.delete(res);
        this.broadcast('presence', { online: this.online() });
      });
      this.broadcast('presence', { online: this.online() });
    },
    broadcast(event, data) {
      const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of clients) res.write(msg);
    },
    online() {
      return [...new Set([...clients].map((r) => r.user))];
    },
    close() {
      clearInterval(ping);
      for (const res of clients) res.end();
      clients.clear();
    },
  };
}
