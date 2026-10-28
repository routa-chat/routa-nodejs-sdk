# @routa-chat/sdk

## 0.2.0

### Minor Changes

- [`f17fdc9`](https://github.com/routa-chat/routa-nodejs-sdk/commit/f17fdc9757ad38bf24190e2636261891fabc8dba) Thanks [@nathvnfwck](https://github.com/nathvnfwck)! - `Message['content']` is now `MessageContent | null`, and `Message` has a new `contentRedactedAt: string | null`.
  
  Routa removes message content once it is older than the retention period of the plan, and returns `content: null` with a `content_redacted_at` timestamp for those messages. Before this change, `messages.retrieve()` and `messages.list()` threw `TypeError: Cannot read properties of null` on such a message, so one old message broke a whole listing. They now return it, with the rest of the message intact.
  
  This is a breaking change to the type, and the SDK is 0.x, so it ships as a minor. Code that reads `message.content` without a check stops compiling. To migrate, guard the read:
  
  ```ts
  if (message.content) {
    // use message.content
  }
  ```
