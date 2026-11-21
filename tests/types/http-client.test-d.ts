import { expectTypeOf, test } from 'vitest'
import type {
  HttpMethod,
  HttpRequestOptions,
  HttpResponse,
} from '../../src/http/http-client'

test('body and rawBody are mutually exclusive', () => {
  const bytes = new Uint8Array([1, 2, 3])

  // Either one alone compiles.
  const jsonRequest: HttpRequestOptions = {
    method: 'POST',
    path: '/v1/messages',
    body: { text: 'hi' },
  }
  const rawRequest: HttpRequestOptions = {
    method: 'POST',
    path: '/v1/media',
    rawBody: { data: bytes, contentType: 'image/png' },
  }
  const bodyless: HttpRequestOptions = { method: 'GET', path: '/v1/whoami' }
  void [jsonRequest, rawRequest, bodyless]

  // @ts-expect-error — `body` and `rawBody` cannot be sent together.
  const both: HttpRequestOptions = {
    method: 'POST',
    path: '/v1/media',
    body: { source_url: 'https://example.com/a.png' },
    rawBody: { data: bytes, contentType: 'image/png' },
  }
  void both
})

test('rawBody needs a content type and accepts only buffered data', () => {
  const missingContentType: HttpRequestOptions = {
    method: 'POST',
    path: '/v1/media',
    // @ts-expect-error — a raw body must say what it is.
    rawBody: { data: new Uint8Array(1) },
  }
  const stream: HttpRequestOptions = {
    method: 'POST',
    path: '/v1/media',
    // @ts-expect-error — streams are not resendable, so they are not accepted (D10).
    rawBody: { data: new ReadableStream(), contentType: 'image/png' },
  }
  const text: HttpRequestOptions = {
    method: 'POST',
    path: '/v1/media',
    // @ts-expect-error — a string is not a byte body; use `body` for JSON.
    rawBody: { data: 'plain', contentType: 'text/plain' },
  }
  void [missingContentType, stream, text]
})

test('PUT is an HttpMethod and HttpResponse carries the status', () => {
  expectTypeOf<'PUT'>().toExtend<HttpMethod>()
  expectTypeOf<HttpResponse<unknown>['status']>().toEqualTypeOf<number>()
  expectTypeOf<HttpResponse<unknown>['headers']>().toEqualTypeOf<Headers>()
})
