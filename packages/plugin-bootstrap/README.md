# @elizaos/plugin-bootstrap

Event handlers, services, actions, providers and functionality on top of the elizaOS core package.

Should be imported into most agents.

## Registering Custom Sources

Plugins can provide their own messaging sources that aren't associated with a room component. Use the runtime `registerSource` method during plugin initialization to make these sources available to actions such as `sendMessageAction`.

```ts
export const myPlugin: Plugin = {
  name: 'my-plugin',
  init: async (_config, runtime) => {
    runtime.registerSource('myCustomSource');
  },
};
```

Any sources registered in this way will be merged with sources discovered from room components when `sendMessageAction` validates whether it can run.
