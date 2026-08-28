(async function () {
  const init = await window.vibescopePlugin.connected;
  const variant = init.contribution.id;
  const variants = {
    'claude-search': { title: 'Claude Code 对话搜索', providers: ['claude'] },
    'codex-search': { title: 'Codex 对话搜索', providers: ['codex'] },
    'kimi-search': { title: 'Kimi Code 对话搜索', providers: ['kimi'] },
    'all-search': { title: '全部对话搜索', providers: ['claude', 'codex', 'kimi'] },
    search: { title: init.plugin.name, providers: init.plugin.id.includes('claude') ? ['claude'] : init.plugin.id.includes('codex') ? ['codex'] : init.plugin.id.includes('kimi') ? ['kimi'] : ['claude', 'codex', 'kimi'] },
  };
  const config = variants[variant] || variants.search;
  const capability = {
    claude: 'conversations:claude-code:read',
    codex: 'conversations:codex:read',
    kimi: 'conversations:kimi-code:read',
  };
  const names = { claude: 'Claude Code', codex: 'Codex', kimi: 'Kimi Code' };
  const resume = {
    claude: (id) => `claude --resume ${id}`,
    codex: (id) => `codex resume ${id}`,
    kimi: (id) => `kimi --session ${id}`,
  };

  window.conversationSearchConfig = config;
  window.conversationSearch = {
    async projects(providers) {
      const groups = await Promise.all(providers.map(async (provider) => {
        const items = await window.vibescopePlugin.request(capability[provider], 'projects');
        return items.map((item) => ({ ...item, cli: provider, cliName: names[provider] }));
      }));
      return groups.flat();
    },
    async search(options) {
      const started = performance.now();
      const groups = await Promise.all(options.providers.map(async (provider) => {
        const response = await window.vibescopePlugin.request(capability[provider], 'search', {
          query: options.query,
          mode: options.mode,
          ...(options.projectKey?.startsWith(`${provider}:`) ? { projectKey: options.projectKey } : {}),
          limit: 300,
        });
        return {
          ...response,
          results: response.results.map((item) => ({ ...item, cli: provider, cliName: names[provider] })),
        };
      }));
      const results = groups.flatMap((group) => group.results)
        .sort((a, b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0))
        .slice(0, 300);
      return {
        providers: options.providers,
        keywords: groups[0]?.keywords || [],
        mode: options.mode,
        filesScanned: groups.reduce((sum, group) => sum + Number(group.filesScanned || 0), 0),
        total: results.length,
        elapsedMs: Math.round(performance.now() - started),
        truncated: groups.some((group) => group.truncated) || results.length >= 300,
        results,
      };
    },
    async copyResume(cli, sessionId) {
      const command = resume[cli](sessionId);
      await window.vibescopePlugin.request('clipboard:write-text', 'writeText', { text: command });
      return command;
    },
    close() {},
    minimize() {},
    toggleMaximize() {},
  };
  await window.vibescopePlugin.setTitle(config.title);
  await window.vibescopePlugin.ready();
  const script = document.createElement('script');
  script.src = 'app.js';
  document.body.appendChild(script);
})();
