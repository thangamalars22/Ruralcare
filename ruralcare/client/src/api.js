const BASE = import.meta.env.VITE_API_URL || '/api';

export const tokenStore = {
  get: () => localStorage.getItem('rc_token'),
  set: (t) => localStorage.setItem('rc_token', t),
  clear: () => localStorage.removeItem('rc_token'),
};

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error('We could not reach RuralCare. Please check your internet connection.');
    e.network = true;
    throw e;
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    // Only server-authored messages for 4xx are shown. Anything else gets a friendly generic message.
    const e = new Error(res.status < 500 && data?.message ? data.message : 'Something went wrong. Please try again.');
    e.status = res.status;
    if (res.status === 401 && tokenStore.get()) window.dispatchEvent(new Event('rc-unauthorized'));
    throw e;
  }
  return data;
}

const FRIENDLY = 'Something went wrong. Please try again.';

// Upload a File as the raw request body (PUT) with real progress events. Resolves with the parsed JSON response.
function upload(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', BASE + path);
    if (tokenStore.get()) xhr.setRequestHeader('Authorization', `Bearer ${tokenStore.get()}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => { const e = new Error('We could not reach RuralCare. Please check your internet connection.'); e.network = true; reject(e); };
    xhr.onabort = () => reject(new Error('The upload was cancelled.'));
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* empty body */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      const e = new Error(xhr.status < 500 && data?.message ? data.message : FRIENDLY);
      e.status = xhr.status;
      if (xhr.status === 401 && tokenStore.get()) window.dispatchEvent(new Event('rc-unauthorized'));
      reject(e);
    };
    xhr.send(file);
  });
}

// Fetch a protected file with the user's token (the token is never put in a URL). Resolves with a Blob.
async function blob(path) {
  let res;
  try { res = await fetch(BASE + path, { headers: tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {} }); }
  catch { throw new Error('We could not reach RuralCare. Please check your internet connection.'); }
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* not json */ }
    if (res.status === 401 && tokenStore.get()) window.dispatchEvent(new Event('rc-unauthorized'));
    throw new Error(res.status < 500 && data?.message ? data.message : FRIENDLY);
  }
  return res.blob();
}

export const api = {
  upload, blob,
  del: (p) => request(p, { method: 'DELETE' }),
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
};
