import { type FetchLike, hostFetch, retrying } from "@wirecat/cli-base/http"
import { Pacer, pacePathFor, serviceApiCommand } from "@wirecat/cli-core"
import { DOCUMENT_UNTRUSTED, marksUntrusted } from "@wirecat/cli-core/documents"
import type { Command } from "commander"
import { API, configuration, LINK_OPERATIONS } from "../config.js"
import { contextOf, PACE, tokenOf } from "../context.js"
import { API_HOSTS, IDENTITY } from "../identity.js"

/** A resource's fields that carry a link to its bytes (`file`, `preview`, `sizes` in Yandex's Resource model). */
const LINK_FIELDS = new Set(["file", "preview", "sizes"])

const strip = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(strip)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value).flatMap(([key, one]) => (LINK_FIELDS.has(key) ? [] : [[key, strip(one)]])),
        )
      : value

/** The answers with every download link taken out, so the api group never prints one. */
const withoutLinks =
  (fetch: FetchLike): FetchLike =>
  async (input, init) => {
    const response = await fetch(input, init)
    if (!response.headers.get("content-type")?.includes("json")) return response
    const text = await response.text()
    // An empty answer stays bodiless: a body of "" with no length reads as JSON that could not be parsed.
    if (text === "") return new Response(null, response)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return new Response(text, response)
    }
    const headers = new Headers(response.headers)
    headers.delete("content-length")
    headers.delete("content-encoding")
    return new Response(JSON.stringify(strip(body)), {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

/**
 * The service's raw API from its spec, `api list`, `api show` and one command per operation, through cli-core's shared
 * group. The manifest gives the server, the sign-in header, the paging of `--all` and the keys: each write asks or
 * refuses by `api.<operation>`, a delete or a share also by its key. The requests keep the profile's pace, and the
 * token is the profile's own, read by `tokenOf` like every other command's.
 */
export const apiCommand = (): Command => {
  const group = serviceApiCommand({
    ...API,
    app: IDENTITY,
    configuration,
    fetch: (command) => {
      const { environment, env, profile } = contextOf(command)
      const send = hostFetch({ hosts: API_HOSTS, ...(environment.fetch ? { fetch: environment.fetch } : {}) })
      return withoutLinks(retrying(send, { pacer: new Pacer(pacePathFor(IDENTITY, profile, env), PACE) }))
    },
    excluded: LINK_OPERATIONS.map((id) => ({
      id,
      reason: "answers a link that grants the file to whoever holds it; files download and files upload use it unseen",
    })),
    token: tokenOf,
    schemas: () => import("../generated/schemas.js").then((module) => module.schemas),
    definitions: () => import("../generated/definitions.js").then((module) => module.definitions),
  })
  // A raw answer holds the names and paths whoever shares a folder chose; list and show describe only the spec.
  for (const operation of group.commands)
    if (operation.name() !== "list" && operation.name() !== "show") marksUntrusted(operation, DOCUMENT_UNTRUSTED)
  return group
}
