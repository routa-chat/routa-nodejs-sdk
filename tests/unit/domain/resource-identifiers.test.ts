import { describe, expect, it } from 'vitest'
import { isChannelId } from '../../../src/domain/channel-id'
import { isEventId } from '../../../src/event/event-id'
import { isMediaId } from '../../../src/media/media-id'
import { isMessageId } from '../../../src/message/message-id'
import { isTemplateId } from '../../../src/template/template-id'
import { isWebhookDeliveryId } from '../../../src/webhook/webhook-delivery-id'
import { isWebhookId } from '../../../src/webhook/webhook-id'

const SUFFIX = '01J8XA1B2C3D4E5F6G7H8J9K0M'

const guards = [
  { name: 'isMessageId', prefix: 'msg', guard: isMessageId },
  { name: 'isChannelId', prefix: 'chan', guard: isChannelId },
  { name: 'isEventId', prefix: 'evt', guard: isEventId },
  { name: 'isWebhookId', prefix: 'whe', guard: isWebhookId },
  { name: 'isWebhookDeliveryId', prefix: 'whd', guard: isWebhookDeliveryId },
  { name: 'isMediaId', prefix: 'med', guard: isMediaId },
  { name: 'isTemplateId', prefix: 'tmpl', guard: isTemplateId },
]

describe.each(guards)('$name', ({ prefix, guard }) => {
  it('accepts an id with its own prefix', () => {
    expect(guard(`${prefix}_${SUFFIX}`)).toBe(true)
  })

  it('rejects ids belonging to every other resource', () => {
    for (const other of guards) {
      if (other.prefix === prefix) continue
      expect(guard(`${other.prefix}_${SUFFIX}`)).toBe(false)
    }
  })
})
