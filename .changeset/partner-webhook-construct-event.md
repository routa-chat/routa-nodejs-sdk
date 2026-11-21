---
'@routa-chat/sdk': minor
---

Partner API (experimental): `partner.webhook.constructEvent()`.

A partner can now verify a delivery of its webhook with the `RoutaPartner` it already has, instead of building a `Routa` on some project key only to reach `routa.webhooks.constructEvent()`. It is the same verification, local and with no network call, returning the same `RoutaEvent` (`projectId` and `externalRef` say which customer it is about). It accepts one secret or several, for a rotation overlap.
