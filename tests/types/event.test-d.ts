import { expectTypeOf, test } from 'vitest'
import type { EventType, RoutaEvent } from '../../src/event/event'

test('EventType is exhaustively discriminated — a switch missing a real kind fails to compile', () => {
  function describe(type: EventType): string {
    switch (type) {
      case 'message.accepted':
      case 'message.sent':
      case 'message.delivered':
      case 'message.read':
      case 'message.failed':
      case 'message.received':
      case 'channel.status_changed':
      case 'template.submitted':
      case 'template.pending':
      case 'template.approved':
      case 'template.rejected':
      case 'template.paused':
      case 'template.disabled':
      case 'template.failed':
      case 'template.category_changed':
      case 'template.updated':
      case 'template.deleted':
        return type
      default: {
        const exhaustiveCheck: never = type
        return exhaustiveCheck
      }
    }
  }
  void describe
})

test('a switch over RoutaEvent.type covers all 17 known kinds plus a generic fallback', () => {
  function describe(event: RoutaEvent): string {
    switch (event.type) {
      case 'message.accepted':
      case 'message.sent':
      case 'message.delivered':
      case 'message.read':
      case 'message.failed':
      case 'message.received':
      case 'channel.status_changed':
      case 'template.submitted':
      case 'template.pending':
      case 'template.approved':
      case 'template.rejected':
      case 'template.paused':
      case 'template.disabled':
      case 'template.failed':
      case 'template.category_changed':
      case 'template.updated':
      case 'template.deleted':
        return event.type
      default:
        // An unrecognized `type` still carries `data`, never throwing.
        return event.type
    }
  }
  void describe
})

test('checking for `id` narrows RoutaEvent to the known-branch shape', () => {
  function describe(event: RoutaEvent): string {
    if ('id' in event) {
      // Known branch: the full envelope is present, `type` is an EventType.
      const type: EventType = event.type
      return `${type}:${event.id}`
    }
    // Fallback: only `type`/`data`.
    return event.type
  }
  void describe
})

test('the fallback member of RoutaEvent accepts any type string with unknown data', () => {
  const fallback: RoutaEvent = { type: 'something.unknown', data: { a: 1 } }
  expectTypeOf(fallback.type).toEqualTypeOf<string>()
  expectTypeOf(fallback.data).toEqualTypeOf<unknown>()
})

test("RoutaEvent's id is only accessible after narrowing away the fallback", () => {
  function describe(event: RoutaEvent) {
    // @ts-expect-error — `id` does not exist on the generic fallback member.
    return event.id
  }
  void describe
})

test('EventType has exactly 17 members', () => {
  type Members = {
    [K in EventType]: K
  }
  expectTypeOf<keyof Members>().toEqualTypeOf<EventType>()

  // Distributing over the union counts its members: a 17-tuple only
  // type-checks while `EventType` has exactly 17 of them.
  type UnionToTuple<U, Last = LastOf<U>> = [U] extends [never]
    ? []
    : [...UnionToTuple<Exclude<U, Last>>, Last]
  type LastOf<U> = (
    (U extends unknown ? (x: () => U) => void : never) extends (
      x: infer I
    ) => void
      ? I
      : never
  ) extends () => infer R
    ? R
    : never
  expectTypeOf<UnionToTuple<EventType>['length']>().toEqualTypeOf<17>()
})

test('the new template kinds are EventType members', () => {
  expectTypeOf<'template.failed'>().toMatchTypeOf<EventType>()
  expectTypeOf<'template.category_changed'>().toMatchTypeOf<EventType>()
  expectTypeOf<'template.updated'>().toMatchTypeOf<EventType>()
  expectTypeOf<'template.deleted'>().toMatchTypeOf<EventType>()
})

test('a known event carries externalRef: string | null, only after narrowing away the fallback', () => {
  function describe(event: RoutaEvent) {
    if ('id' in event) {
      expectTypeOf(event.externalRef).toEqualTypeOf<string | null>()
    }
    // @ts-expect-error — `externalRef` does not exist on the generic fallback member.
    return event.externalRef
  }
  void describe
})
