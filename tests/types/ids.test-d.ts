import { expectTypeOf, test } from 'vitest'
import type { ChannelId } from '../../src/domain/channel-id'
import { toChannelId } from '../../src/domain/channel-id'
import type { MessageId } from '../../src/message/message-id'
import { toMessageId } from '../../src/message/message-id'

test('MessageId and ChannelId are not interchangeable', () => {
  const messageId = toMessageId('msg_01J8XA1B2C3D4E5F6G7H8J9K0M')
  const channelId = toChannelId('chan_01J8XA1B2C3D4E5F6G7H8J9K0M')

  expectTypeOf(messageId).toEqualTypeOf<MessageId>()
  expectTypeOf(messageId).not.toEqualTypeOf<ChannelId>()
  expectTypeOf(channelId).not.toEqualTypeOf<MessageId>()

  // @ts-expect-error — a ChannelId must not be assignable to a MessageId.
  const wrong: MessageId = channelId
  void wrong
})
