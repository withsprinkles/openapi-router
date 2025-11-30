/** biome-ignore-all lint/suspicious/noExplicitAny: Necessary for proper type inference */

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { RequestMethod, Route } from "@remix-run/fetch-router";
import SuperHeaders from "@remix-run/headers";
import type { Env, Schema } from "hono/types";
import type {
    ExtractParamName,
    JSONRespond,
    RouteConfig,
    Router,
    RouterOptions,
    SkipParamName,
} from "./types.ts";

export type ToOpenApiPath<Pattern extends string> =
    Pattern extends `${infer Head}:${infer AfterColon}`
        ? `${Head}{${ExtractParamName<AfterColon>}}${ToOpenApiPath<SkipParamName<AfterColon>>}`
        : Pattern extends `${infer Path}?${infer _Query}`
          ? Path
          : Pattern;

export const toOpenApiPath = <Pattern extends string>(pattern: Pattern) => {
    // Strip search parameters (everything after ?)
    const pathWithoutQuery = pattern.split("?")[0];
    // Convert :param to {param}
    return pathWithoutQuery.replace(/:([A-Za-z0-9_]+)/g, "{$1}") as ToOpenApiPath<Pattern>;
};
export const toOpenApiMethod = (method: RequestMethod | "ANY") => {
    let openApi = method === "ANY" ? "GET" : method;
    return openApi.toLowerCase() as Lowercase<RequestMethod>;
};

export function createSpec<
    const TRoute extends Route,
    Config extends Omit<RouteConfig, "method" | "path">,
>(
    route: TRoute,
    config: Config,
): Config & {
    method: Lowercase<RequestMethod>;
    path: TRoute extends Route<RequestMethod | "ANY", infer Pattern extends string>
        ? ToOpenApiPath<Pattern>
        : string;
} {
    const pattern = route.pattern.source as TRoute extends Route<
        RequestMethod | "ANY",
        infer Pattern extends string
    >
        ? Pattern
        : string;

    // Map searchParams to query for the underlying library
    const transformedConfig = {
        ...config,
        request: config.request
            ? {
                  ...config.request,
                  query: (config.request as any).searchParams,
              }
            : undefined,
    };

    return createRoute({
        method: toOpenApiMethod(route.method),
        path: toOpenApiPath(pattern),
        ...(transformedConfig as any),
    }) as any;
}

export function createRouter<E extends Env = Env, BasePath extends string = "/">(
    options?: RouterOptions<E, BasePath>,
): Router<E, Schema, BasePath> {
    const { basePath, middleware, ...honoOptions } = options ?? {};

    // Create the OpenAPIHono instance with the provided options
    const oapi = new OpenAPIHono<E, Schema, BasePath>(honoOptions);

    // Apply base path if provided
    let instance = oapi;
    if (basePath) {
        instance = oapi.basePath(basePath) as typeof oapi;
    }

    // Apply global middleware if provided
    if (middleware) {
        const middlewares = Array.isArray(middleware) ? middleware : [middleware];
        for (const mw of middlewares) {
            instance.use(mw);
        }
    }

    const router = instance as Router<E, Schema, BasePath>;
    router.map = <R extends RouteConfig>(config: R, handler: any) => {
        instance.openapi(config as any, async c => {
            // @ts-expect-error validations cannot be typed at the generic level
            const params = c.req.valid("param");
            // @ts-expect-error validations cannot be typed at the generic level
            const query = c.req.valid("query");
            // @ts-expect-error validations cannot be typed at the generic level
            const body = c.req.valid("json");

            return await handler({
                params,
                searchParams: query,
                body,
                method: c.req.method,
                url: new URL(c.req.url),
                headers: new SuperHeaders(c.req.raw.headers),
                request: c.req.raw,
                // TODO: Handle formData when present
                // formData: undefined,
                raw: c,
            });
        });
    };

    return router;
}

export const createJsonResponse: JSONRespond = (value, init) =>
    Response.json(value, init as any) as any;
export { createJsonResponse as json };

// TODO: Add more type-safe response helpers
// export const createRedirectResponse
// export const createHtmlResponse
// export const createFileResponse
// export { createRedirectResponse as redirect, createHtmlResponse as html, createFileResponse as file };

export { z } from "@hono/zod-openapi";
export { createRoutes, formAction, resource, resources, route } from "@remix-run/fetch-router";
export type { RouterOptions } from "./types.ts";
