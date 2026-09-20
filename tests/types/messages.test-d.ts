import { expectTypeOf, test } from 'vitest'
import { toChannelId } from '../../src/domain/channel-id'
import type { Page } from '../../src/domain/pagination'
import type { Message, MessageContent } from '../../src/message/message'
import { toMessageId } from '../../src/message/message-id'
import type { MessagesResource } from '../../src/message/messages-resource'
import type { SendMessageParams } from '../../src/message/send-message'

test('SendMessageParams accepts text alone', () => {
  const params: SendMessageParams = {
    channel: 'chan_1',
    to: '+1',
    text: 'hi',
  }
  void params
})

test('SendMessageParams accepts template alone', () => {
  const params: SendMessageParams = {
    channel: 'chan_1',
    to: '+1',
    template: { id: 'tmpl_1', bodyParameters: ['a'] },
  }
  void params
})

test('SendMessageParams rejects text and template together — compile error', () => {
  // @ts-expect-error — text and template are mutually exclusive.
  const params: SendMessageParams = {
    channel: 'chan_1',
    to: '+1',
    text: 'hi',
    template: { id: 'tmpl_1' },
  }
  void params
})

test('SendMessageParams requires at least one of text/template', () => {
  // @ts-expect-error — neither text nor template provided.
  const params: SendMessageParams = { channel: 'chan_1', to: '+1' }
  void params
})

test('MessageContent is exhaustively discriminated by type', () => {
  function describe(content: MessageContent): string {
    switch (content.type) {
      case 'text':
        return content.body
      case 'image':
        return content.media_id
      case 'document':
        return content.media_id
      case 'audio':
        return content.media_id
      case 'video':
        return content.media_id
      case 'sticker':
        return content.media_id
      case 'location':
        return `${content.latitude},${content.longitude}`
      case 'reaction':
        return content.emoji
      case 'template':
        return content.template_id
      case 'unsupported':
        return 'unsupported'
      default: {
        const exhaustiveCheck: never = content
        return exhaustiveCheck
      }
    }
  }
  void describe
})

test('retrieve()/markRead() require a MessageId, not a raw string or ChannelId', () => {
  const resource = {} as MessagesResource
  const messageId = toMessageId('msg_01J8XA1B2C3D4E5F6G7H8J9K0M')
  const channelId = toChannelId('chan_01J8XA1B2C3D4E5F6G7H8J9K0M')

  void resource.retrieve(messageId)
  void resource.markRead(messageId)

  // @ts-expect-error — a raw string is not a MessageId.
  void resource.retrieve('msg_01J8XA1B2C3D4E5F6G7H8J9K0M')
  // @ts-expect-error — a ChannelId must not be assignable to a MessageId.
  void resource.retrieve(channelId)
})

test('list() returns an AsyncIterable<Message> with a page() escape hatch', () => {
  const resource = {} as MessagesResource
  const list = resource.list()

  expectTypeOf(list).toMatchTypeOf<AsyncIterable<Message>>()
  expectTypeOf(list.page).toEqualTypeOf<() => Promise<Page<Message>>>()
})

test('Message.id is branded as MessageId, not a raw string', () => {
  expectTypeOf<Message['id']>().not.toEqualTypeOf<string>()
})
