const { EnvHttpProxyAgent, setGlobalDispatcher } = require('undici');
setGlobalDispatcher(new EnvHttpProxyAgent());
