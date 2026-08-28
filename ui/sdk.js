(function () {
  let port = null;
  let init = null;
  let sequence = 0;
  const pending = new Map();
  const listeners = new Map();
  let connectResolve;
  const connected = new Promise((resolve) => { connectResolve = resolve; });

  function emit(type, value) {
    for (const listener of listeners.get(type) || []) listener(value);
  }

  window.addEventListener('message', (event) => {
    if (port || event.source !== window.parent || event.data?.type !== 'vibescope.host.connect' || !event.ports[0]) return;
    port = event.ports[0];
    init = event.data.init;
    port.onmessage = (messageEvent) => {
      const message = messageEvent.data;
      if (message?.requestId && pending.has(message.requestId)) {
        const request = pending.get(message.requestId);
        pending.delete(message.requestId);
        if (message.ok) request.resolve(message.value);
        else request.reject(new Error(message.error?.message || '插件请求失败'));
        return;
      }
      emit(message?.type || 'message', message);
    };
    port.start();
    connectResolve(init);
  });

  window.vibescopePlugin = {
    connected,
    get init() { return init; },
    request(capability, method, params = {}) {
      return connected.then(() => new Promise((resolve, reject) => {
        const requestId = `request_${Date.now().toString(36)}_${++sequence}`;
        pending.set(requestId, { resolve, reject });
        port.postMessage({ type: 'plugin.request', requestId, capability, method, params });
      }));
    },
    ready() { return connected.then(() => port.postMessage({ type: 'plugin.ready' })); },
    setTitle(title) { return connected.then(() => port.postMessage({ type: 'plugin.setTitle', title })); },
    emitEvent(event, payload) { return connected.then(() => port.postMessage({ type: 'plugin.event', event, payload })); },
    on(type, listener) {
      const values = listeners.get(type) || new Set();
      values.add(listener);
      listeners.set(type, values);
      return () => values.delete(listener);
    },
  };
})();
