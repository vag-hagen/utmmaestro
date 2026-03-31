const API = {
  async request(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`/api${path}`, opts);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },

  links: {
    list:    (params = {}) => API.request('GET', `/links?${new URLSearchParams(params)}`),
    create:  (body)        => API.request('POST', '/links', body),
    update:  (id, body)    => API.request('PATCH', `/links/${id}`, body),
    remove:  (id)          => API.request('DELETE', `/links/${id}`),
    sources:     ()        => API.request('GET', '/links/sources'),
    suggestions: ()        => API.request('GET', '/links/suggestions'),
    clicks: (params = {})  => API.request('GET', `/links/clicks?${new URLSearchParams(params)}`),
  },

  ga4: {
    get:     (range = '30d') => API.request('GET', `/ga4?range=${range}`),
    refresh: (range = '30d') => API.request('POST', '/ga4/refresh', { range }),
  },
};
