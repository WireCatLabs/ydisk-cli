import { setTimeout as sleep } from "node:timers/promises"
import { linkFetch, type Pacer } from "@wirecat/cli-core"
import * as v from "valibot"
import { expect, it } from "vitest"
import { FAKE_TOKEN, fakeDisk } from "../testing/fake-disk.js"
import { diskSource } from "./source.js"
import { failureOf, transport } from "./transport.js"

const anything = v.unknown()
const failing = (error: unknown) => async () => Promise.reject(error)
const silent = async (_url: unknown, init?: RequestInit) =>
  new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)))
const accountOver = (fetch: typeof globalThis.fetch, options: Partial<Parameters<typeof transport>[0]> = {}) =>
  diskSource(transport({ token: FAKE_TOKEN, fetch, ...options }), linkFetch({ hosts: [] })).account()

it.each([
  [401, false, "authentication_error"],
  [404, false, "not_found"],
  [429, true, "rate_limited"],
  [503, false, "provider_unavailable"],
  [503, true, "outcome_unknown"],
  [500, true, "outcome_unknown"],
  [400, true, "validation_error"],
])("HTTP %i (a write: %s) is %s", (status, writes, code) => {
  expect(failureOf(status, writes).code).toBe(code)
})

it("a write that failed on the service is never marked safe to retry", () => {
  expect(failureOf(500, true).details).toMatchObject({ retryable: false })
  expect(failureOf(503, false).details).toMatchObject({ retryable: true })
  expect(failureOf(429, false, 2000).details).toMatchObject({ retryable: true, retry_after_ms: 2000 })
  expect(failureOf(429, false).details).not.toHaveProperty("retry_after_ms")
})

it("sends the token as OAuth in the Authorization header only, and refuses a redirect", async () => {
  const service = fakeDisk()
  const sent: RequestInit[] = []
  const user = await accountOver((input, init = {}) => {
    sent.push(init)
    return service.fetch(input, init)
  })
  expect(user).toEqual({ id: "1000", login: "test-person", name: null })
  expect(service.calls[0]?.url.href).not.toContain(FAKE_TOKEN)
  expect(service.calls[0]?.auth).toBe(`OAuth ${FAKE_TOKEN}`)
  expect(sent[0]?.redirect).toBe("error")
  expect(service.refusals).toEqual([])
})

it("a refused token is an authentication_error that never repeats the service's words", async () => {
  const fetch = async () => new Response(JSON.stringify({ description: FAKE_TOKEN }), { status: 401 })
  const failure = await accountOver(fetch).catch((error: unknown) => error)
  expect(failure).toMatchObject({ code: "authentication_error" })
  expect(JSON.stringify(failure)).not.toContain(FAKE_TOKEN)
  // The command layer adds how to sign in again; the transport names no command (WC-ARCH-16).
  expect(String(failure)).not.toContain("session")
})

it('refuses an id of "." or ".." before any request, since it would reach another endpoint', async () => {
  const service = fakeDisk()
  const send = (id: string) =>
    transport({ token: FAKE_TOKEN, fetch: service.fetch }).send(
      { method: "GET", path: "disk/{x}", ids: { x: id } },
      anything,
    )
  for (const id of ["..", ".", ""]) await expect(send(id)).rejects.toMatchObject({ code: "validation_error" })
  expect(service.calls).toEqual([])
  await expect(
    transport({ token: FAKE_TOKEN, fetch: service.fetch }).send({ method: "GET", path: "disk/{x}" }, anything),
  ).rejects.toMatchObject({ code: "validation_error" })
  expect(service.calls).toEqual([])
  await expect(send("a/b")).rejects.toMatchObject({ code: "validation_error" })
  expect(service.calls[0]?.url.pathname).toBe("/v1/disk/a%2Fb")
})

it("a read that got no answer is a retryable timeout or network error; a write is outcome_unknown", async () => {
  const send = (fetch: typeof globalThis.fetch, method: "GET" | "POST") =>
    transport({ token: FAKE_TOKEN, fetch, timeoutMs: 5, sleep: async () => {} }).send(
      { method, path: "disk/resources", body: {} },
      anything,
    )
  await expect(send(silent, "GET")).rejects.toMatchObject({ code: "timeout", details: { retryable: true } })
  await expect(send(failing(new TypeError("fetch failed")), "GET")).rejects.toMatchObject({
    code: "network_error",
    details: { retryable: true },
  })
  await expect(send(silent, "POST")).rejects.toMatchObject({
    code: "outcome_unknown",
    details: { retryable: false },
  })
})

it("sends a read again after a 503 and a write again only after a 429", async () => {
  const statuses = [503, 200, 503, 429, 200]
  const calls: string[] = []
  const fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    calls.push(init?.method ?? "GET")
    const status = statuses.shift() ?? 200
    return new Response(status === 200 ? "{}" : null, { status })
  }
  const api = transport({ token: FAKE_TOKEN, fetch, sleep: async () => {} })
  await api.send({ method: "GET", path: "disk" }, anything)
  await expect(api.send({ method: "POST", path: "disk/resources/copy" }, anything)).rejects.toMatchObject({
    code: "outcome_unknown",
  })
  await api.send({ method: "POST", path: "disk/resources/copy" }, anything)
  expect(calls).toEqual(["GET", "GET", "POST", "POST", "POST"])
})

it("a stop during a read cancels it; during a write it stays outcome_unknown", async () => {
  const stop = new AbortController()
  stop.abort()
  const send = (method: "GET" | "PUT") =>
    transport({ token: FAKE_TOKEN, fetch: failing(new Error("aborted")), signal: stop.signal }).send(
      { method, path: "disk/resources" },
      anything,
    )
  await expect(send("GET")).rejects.toMatchObject({ code: "cancelled" })
  await expect(send("PUT")).rejects.toMatchObject({ code: "outcome_unknown" })
})

it("an answer that is not JSON is invalid_response", async () => {
  const fetch = async () => new Response("<html>", { status: 200 })
  await expect(accountOver(fetch)).rejects.toMatchObject({ code: "invalid_response" })
})

it("an answer in another shape is invalid_response", async () => {
  const fetch = async () => new Response(JSON.stringify({ user: { login: "test-person" } }), { status: 200 })
  await expect(accountOver(fetch)).rejects.toMatchObject({ code: "invalid_response" })
})

it("a 204 is read as no body, as a delete answers", async () => {
  const fetch = async () => new Response(null, { status: 204 })
  const answer = await transport({ token: FAKE_TOKEN, fetch }).send(
    { method: "DELETE", path: "disk/resources", query: { path: "disk:/plan.txt" } },
    v.undefined(),
  )
  expect(answer).toBeUndefined()
})

it("waits its turn under the profile's pace, and ends the run instead of a long wait", async () => {
  const service = fakeDisk()
  const waits: number[] = []
  const paced = (at: number) =>
    accountOver(service.fetch, {
      now: () => 1_000,
      pacer: { reserve: async () => at } as unknown as Pacer,
      sleep: async (ms) => {
        waits.push(ms)
      },
    })
  await paced(1_500)
  await paced(900)
  expect(waits).toEqual([500])
  await expect(paced(1_000 + 120_000)).rejects.toMatchObject({ code: "rate_limited" })
  expect(service.calls).toHaveLength(2)
})

it("a request may take longer than the transport's limit, and its own stop cancels it alone", async () => {
  const api = transport({ token: FAKE_TOKEN, fetch: silent, timeoutMs: 5 })
  const stop = new AbortController()
  const slow = api.send({ method: "GET", path: "disk/resources", timeoutMs: 60_000, signal: stop.signal }, anything)
  await sleep(20)
  stop.abort()
  await expect(slow).rejects.toMatchObject({ code: "cancelled" })
  await expect(api.send({ method: "GET", path: "disk/resources" }, anything)).rejects.toMatchObject({ code: "timeout" })
})
