// Tiny in-memory fixed-window rate limiter (no dependency). Fine for one server process;
// use a shared store (e.g. Redis) if you run several instances.
module.exports = function rateLimit({ windowMs, max, key, message }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let h = hits.get(k);
    if (!h || h.reset <= now) { h = { n: 0, reset: now + windowMs }; hits.set(k, h); }
    h.n += 1;
    if (h.n > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ message: message || 'Too many attempts. Please wait a few minutes and try again.' });
    }
    next();
  };
};
