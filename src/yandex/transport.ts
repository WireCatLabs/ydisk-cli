import { CliError, isCliError, realSleep, type SleepLike, wallClock } from "@wirecat/cli-base"
import { hostFetch, providerWaitMs, readJsonResponse, retrying, statusToCode } from "@wirecat/cli-base/http"
import { type EventSink, type Pacer, providerRequest } from "@wirecat/cli-core"
import * as v from "valibot"
import { API_HOSTS, SERVICE } from "../identity.js"

export const SERVICE_URL = "https://cloud-api.yandex.net/v1/"

const TIMEOUT_MS = 30_000
const LARGEST_ANSWER = 8 * 1024 * 1024
/** A pace or retry wait longer than this, in all, ends the request instead of sitting in it. */
const LONGEST_WAIT_MS = 60_000

export interface Request {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  /** The path as a template, `disk/resources`: the run record keeps the template, never an id. */
  path: string
  ids?: Record<string, string>
  query?: Record<string, string | number | undefined>
  body?: Record<string, unknown>
  /** Stops this request alone: a listing that must end before the run's deadline, while the run goes on. */
  signal?: AbortSignal
  /** How long this request may take instead of the transport's own limit. */
  timeoutMs?: number
}

export interface TransportOptions {
  token: string
  fetch?: typeof fetch
  signal?: AbortSignal | undefined
  /** The run's sink from `baseContext(...).run(events => …)`, so each request lands in the run record (WC-LIFE-15). */
  events?: EventSink
  /** cli-core's per-profile pace, shared by every process of the profile through a file. */
  pacer?: Pacer
  sleep?: SleepLike
  now?: () => number
  timeoutMs?: number
}

/** `new URL` folds a `.` or `..` segment into its parent, so such an id would reach another endpoint. */
const segment = (name: string, value: string) => {
  if (value === "" || value === "." || value === "..")
    throw new CliError("validation_error", `${name} must name one item; an empty, "." or ".." id is refused`)
  return encodeURIComponent(value)
}

const urlOf = ({ path, ids = {}, query = {} }: Request) => {
  const url = new URL(
    path.replace(/\{(\w+)\}/g, (_, name: string) => segment(name, ids[name] ?? "")),
    SERVICE_URL,
  )
  for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value))
  return url
}

/**
 * A refusal as a CliError with cli-base's code for its status. The service's own message is never repeated: it can
 * quote what was sent (WC-SECR-6). A write that failed on the service's side may have happened, so it is
 * `outcome_unknown` and never retryable (WC-OUT-20, WC-LIFE-9).
 */
export const failureOf = (status: number, writes: boolean, retryAfterMs?: number): CliError => {
  if (status === 401) return new CliError("authentication_error", `${SERVICE} refused the token`, { status })
  if (status === 429)
    return new CliError("rate_limited", `${SERVICE} asked to slow down; retry the command later`, {
      status,
      retryable: true,
      ...(retryAfterMs === undefined ? {} : { retry_after_ms: retryAfterMs }),
    })
  if (status >= 500 && writes)
    return new CliError("outcome_unknown", `${SERVICE} failed during a write; check it before repeating the write`, {
      status,
      retryable: false,
    })
  if (status === 404) return new CliError("not_found", `${SERVICE} has no such item, or this token cannot see it`)
  return new CliError(statusToCode(status), `${SERVICE} refused the request (HTTP ${status})`, {
    status,
    // 507: the Disk is full, which a retry does not change.
    retryable: status >= 500 && status !== 507,
  })
}

/**
 * The only code that holds the token: it goes in the Authorization header, never in an address, an error or a run
 * record (WC-SECR-7). cli-base's `retrying` waits the profile's pace and sends a read again after a retryable failure;
 * a write is sent again only after a 429, which refused it, since any other failure may have landed (WC-OUT-20).
 */
export const transport = (options: TransportOptions) => {
  const now = options.now ?? Date.now
  const fetchOf = retrying(hostFetch({ hosts: API_HOSTS, ...(options.fetch ? { fetch: options.fetch } : {}) }), {
    ...(options.pacer ? { pacer: options.pacer } : {}),
    budget: LONGEST_WAIT_MS,
    sleep: options.sleep ?? realSleep,
    now: () => new Date(now()),
  })

  const unanswered = (writes: boolean, error: unknown, stop?: AbortSignal): CliError => {
    // Before the stop check: a write stopped in flight may still have landed (WC-LIFE-9).
    if (writes)
      return new CliError("outcome_unknown", `${SERVICE} did not answer a write; check it before repeating the write`, {
        retryable: false,
      })
    if (options.signal?.aborted || stop?.aborted) return new CliError("cancelled", `the ${SERVICE} request was stopped`)
    const timedOut = error instanceof Error && error.name === "TimeoutError"
    return timedOut
      ? new CliError("timeout", `${SERVICE} did not answer in time`, { retryable: true })
      : new CliError("network_error", `${SERVICE} could not be reached`, { retryable: true })
  }

  const send = async <T>(request: Request, answer: v.GenericSchema<unknown, T>): Promise<T> => {
    const writes = request.method !== "GET"
    const url = urlOf(request)
    // Not AbortSignal.timeout: its timer keeps the run's async context alive until it fires.
    const deadline = new AbortController()
    const timer = setTimeout(
      () => deadline.abort(new DOMException("timed out", "TimeoutError")),
      request.timeoutMs ?? options.timeoutMs ?? TIMEOUT_MS,
    )
    timer.unref()
    const signal = AbortSignal.any(
      [options.signal, request.signal, deadline.signal].filter((one): one is AbortSignal => one !== undefined),
    )
    const end = providerRequest(`${request.method} /${request.path}`, options.events, {
      method: request.method,
      transport: "http",
    })
    try {
      let response: Response
      try {
        response = await fetchOf(url, {
          method: request.method,
          headers: {
            // Yandex's scheme word is OAuth, not Bearer (https://yandex.ru/dev/disk-api/doc/en/concepts/quickstart).
            authorization: `OAuth ${options.token}`,
            accept: "application/json",
            ...(request.body ? { "content-type": "application/json" } : {}),
          },
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
          // A redirect would carry the Authorization header to an address we did not choose.
          redirect: "error",
          signal,
        })
      } catch (error) {
        // The pace refused to wait that long, so nothing was sent, not even a write.
        const failure =
          isCliError(error) && error.code === "rate_limited"
            ? error
            : unanswered(writes, deadline.signal.reason ?? error, request.signal)
        end({ errorCode: failure.code })
        throw failure
      }
      if (!response.ok) {
        const failure = failureOf(response.status, writes, providerWaitMs(response.headers, wallClock))
        end({ status: response.status, errorCode: failure.code })
        throw failure
      }
      let body: unknown
      try {
        // A delete answers 204 with no body (https://yandex.ru/dev/disk-api/doc/en/reference/delete).
        body =
          response.status === 204 ? undefined : await readJsonResponse(response, { maxBytes: LARGEST_ANSWER, signal })
      } catch (error) {
        const failure =
          isCliError(error) && error.code !== "invalid_response"
            ? error
            : new CliError("invalid_response", `${SERVICE} answered with something other than bounded JSON`)
        end({ status: response.status, errorCode: failure.code })
        throw failure
      }
      const parsed = v.safeParse(answer, body)
      if (!parsed.success) {
        end({ status: response.status, errorCode: "invalid_response" })
        throw new CliError("invalid_response", `${SERVICE}'s answer does not have the documented shape`)
      }
      end({ status: response.status })
      return parsed.output
    } finally {
      clearTimeout(timer)
    }
  }

  return { send }
}

export type Transport = ReturnType<typeof transport>
