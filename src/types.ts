/** biome-ignore-all lint/suspicious/noExplicitAny: Necessary for proper type inference */
/** biome-ignore-all lint/complexity/noBannedTypes: Necessary for proper type inference */

import type {
    OpenApiGeneratorV3,
    RouteConfig as RouteConfigBase,
    ZodContentObject,
    ZodMediaTypeObject,
    ZodRequestBody,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type SuperHeaders from "@remix-run/headers";
import type { SuperHeadersInit } from "@remix-run/headers";
import type {
    Context,
    Env,
    Handler,
    Hono,
    Input,
    MiddlewareHandler,
    TypedResponse,
    ValidationTargets,
} from "hono";
import type { H, HandlerResponse, Next, Schema } from "hono/types";
import type {
    ClientErrorStatusCode,
    ContentfulStatusCode,
    InfoStatusCode,
    RedirectStatusCode,
    ServerErrorStatusCode,
    StatusCode,
    SuccessStatusCode,
} from "hono/utils/http-status";
import type { InvalidJSONValue, JSONParsed, JSONValue } from "hono/utils/types";
import type { ZodError, ZodType, z } from "zod";

export type MaybePromise<T> = Promise<T> | T;

export type RequestTypes = Omit<NonNullable<RouteConfigBase["request"]>, "query"> & {
    searchParams?: NonNullable<RouteConfigBase["request"]>["query"];
};

export type RouteConfig = Omit<RouteConfigBase, "request"> & {
    middleware?: H | H[];
    hide?: boolean;
    request?: RequestTypes;
};

export type IsJson<T> = T extends string
    ? T extends `application/${infer Start}json${infer _End}`
        ? Start extends "" | `${string}+` | `vnd.${string}+`
            ? "json"
            : never
        : never
    : never;

export type IsForm<T> = T extends string
    ? T extends
          | `multipart/form-data${infer _Rest}`
          | `application/x-www-form-urlencoded${infer __Rest}`
        ? "form"
        : never
    : never;

export type ReturnJsonOrTextOrResponse<
    ContentType,
    Content,
    Status extends keyof StatusCodeRangeDefinitions | StatusCode,
> = ContentType extends string
    ? ContentType extends `application/${infer Start}json${infer _End}`
        ? Start extends "" | `${string}+` | `vnd.${string}+`
            ? TypedResponse<JSONParsed<Content>, ExtractStatusCode<Status>, "json">
            : never
        : ContentType extends `text/plain${infer _Rest}`
          ? TypedResponse<Content, ExtractStatusCode<Status>, "text">
          : Response
    : never;

export type RequestPart<
    R extends RouteConfig,
    Part extends string,
> = R["request"] extends RequestTypes
    ? Part extends keyof R["request"]
        ? R["request"][Part]
        : {}
    : {};

export type HasUndefined<T> = undefined extends T ? true : false;

export type InputTypeBase<
    R extends RouteConfig,
    Part extends string,
    Type extends keyof ValidationTargets,
> = R["request"] extends RequestTypes
    ? RequestPart<R, Part> extends ZodType
        ? {
              in: {
                  [K in Type]: HasUndefined<ValidationTargets[K]> extends true
                      ? {
                            [K2 in keyof z.input<RequestPart<R, Part>>]?: z.input<
                                RequestPart<R, Part>
                            >[K2];
                        }
                      : {
                            [K2 in keyof z.input<RequestPart<R, Part>>]: z.input<
                                RequestPart<R, Part>
                            >[K2];
                        };
              };
              out: { [K in Type]: z.output<RequestPart<R, Part>> };
          }
        : {}
    : {};

export type InputTypeJson<R extends RouteConfig> = R["request"] extends RequestTypes
    ? R["request"]["body"] extends ZodRequestBody
        ? R["request"]["body"]["content"] extends ZodContentObject
            ? IsJson<keyof R["request"]["body"]["content"]> extends never
                ? {}
                : R["request"]["body"]["content"][keyof R["request"]["body"]["content"]] extends Record<
                        "schema",
                        ZodType<any>
                    >
                  ? {
                        in: {
                            json: z.input<
                                R["request"]["body"]["content"][keyof R["request"]["body"]["content"]]["schema"]
                            >;
                        };
                        out: {
                            json: z.output<
                                R["request"]["body"]["content"][keyof R["request"]["body"]["content"]]["schema"]
                            >;
                        };
                    }
                  : {}
            : {}
        : {}
    : {};

export type InputTypeForm<R extends RouteConfig> = R["request"] extends RequestTypes
    ? R["request"]["body"] extends ZodRequestBody
        ? R["request"]["body"]["content"] extends ZodContentObject
            ? IsForm<keyof R["request"]["body"]["content"]> extends never
                ? {}
                : R["request"]["body"]["content"][keyof R["request"]["body"]["content"]] extends Record<
                        "schema",
                        ZodType<any>
                    >
                  ? {
                        in: {
                            form: z.input<
                                R["request"]["body"]["content"][keyof R["request"]["body"]["content"]]["schema"]
                            >;
                        };
                        out: {
                            form: z.output<
                                R["request"]["body"]["content"][keyof R["request"]["body"]["content"]]["schema"]
                            >;
                        };
                    }
                  : {}
            : {}
        : {}
    : {};

export type InputTypeParam<R extends RouteConfig> = InputTypeBase<R, "params", "param">;
export type InputTypeSearchParams<R extends RouteConfig> = InputTypeBase<
    R,
    "searchParams",
    "query"
>;
export type InputTypeHeader<R extends RouteConfig> = InputTypeBase<R, "headers", "header">;
export type InputTypeCookie<R extends RouteConfig> = InputTypeBase<R, "cookies", "cookie">;

export type ExtractContent<T> = T extends {
    [K in keyof T]: infer A;
}
    ? A extends Record<"schema", ZodType>
        ? z.infer<A["schema"]>
        : never
    : never;

export type StatusCodeRangeDefinitions = {
    "1XX": InfoStatusCode;
    "2XX": SuccessStatusCode;
    "3XX": RedirectStatusCode;
    "4XX": ClientErrorStatusCode;
    "5XX": ServerErrorStatusCode;
};
export type RouteConfigStatusCode = keyof StatusCodeRangeDefinitions | StatusCode;
export type ExtractStatusCode<T extends RouteConfigStatusCode> =
    T extends keyof StatusCodeRangeDefinitions ? StatusCodeRangeDefinitions[T] : T;
export type DefinedStatusCodes<R extends RouteConfig> = keyof R["responses"] &
    RouteConfigStatusCode;
export type RouteConfigToTypedResponse<R extends RouteConfig> =
    | {
          [Status in DefinedStatusCodes<R>]: R["responses"][Status] extends {
              content: infer Content;
          }
              ? undefined extends Content
                  ? never
                  : ReturnJsonOrTextOrResponse<
                        keyof R["responses"][Status]["content"],
                        ExtractContent<R["responses"][Status]["content"]>,
                        Status
                    >
              : TypedResponse<{}, ExtractStatusCode<Status>, string>;
      }[DefinedStatusCodes<R>]
    | ("default" extends keyof R["responses"]
          ? R["responses"]["default"] extends { content: infer Content }
              ? undefined extends Content
                  ? never
                  : ReturnJsonOrTextOrResponse<
                        keyof Content,
                        ExtractContent<Content>,
                        Exclude<StatusCode, ExtractStatusCode<DefinedStatusCodes<R>>>
                    >
              : TypedResponse<
                    {},
                    Exclude<StatusCode, ExtractStatusCode<DefinedStatusCodes<R>>>,
                    string
                >
          : never);

export type Hook<T, E extends Env, P extends string, R> = (
    result: { target: keyof ValidationTargets } & (
        | {
              success: true;
              data: T;
          }
        | {
              success: false;
              error: ZodError;
          }
    ),
    c: Context<E, P>,
) => R;

export type ConvertPathType<T extends string> =
    T extends `${infer Start}/{${infer Param}}${infer Rest}`
        ? `${Start}/:${Param}${ConvertPathType<Rest>}`
        : T;

export type OpenAPIHonoOptions<E extends Env> = {
    defaultHook?: Hook<any, E, any, any>;
};
export type HonoInit<E extends Env> = ConstructorParameters<typeof Hono>[0] & OpenAPIHonoOptions<E>;

/**
 * Turns `T | T[] | undefined` into `T[]`
 */
export type AsArray<T> = T extends undefined // TODO move to utils?
    ? []
    : T extends any[]
      ? T
      : [T];

/**
 * Like simplify but recursive
 */
export type DeepSimplify<T> = {
    // TODO move to utils?
    [KeyType in keyof T]: T[KeyType] extends Record<string, unknown>
        ? DeepSimplify<T[KeyType]>
        : T[KeyType];
} & {};

/**
 * Helper to infer generics from {@link MiddlewareHandler}
 */
export type OfHandlerType<T extends MiddlewareHandler> =
    T extends MiddlewareHandler<infer E, infer P, infer I>
        ? {
              env: E;
              path: P;
              input: I;
          }
        : never;

/**
 * Reduce a tuple of middleware handlers into a single
 * handler representing the composition of all
 * handlers.
 */
export type MiddlewareToHandlerType<M extends MiddlewareHandler<any, any, any>[]> = M extends [
    infer First,
    infer Second,
    ...infer Rest,
]
    ? First extends MiddlewareHandler<any, any, any>
        ? Second extends MiddlewareHandler<any, any, any>
            ? Rest extends MiddlewareHandler<any, any, any>[] // Ensure Rest is an array of MiddlewareHandler
                ? MiddlewareToHandlerType<
                      [
                          MiddlewareHandler<
                              DeepSimplify<
                                  OfHandlerType<First>["env"] & OfHandlerType<Second>["env"]
                              >, // Combine envs
                              OfHandlerType<First>["path"], // Keep path from First
                              OfHandlerType<First>["input"] // Keep input from First
                          >,
                          ...Rest,
                      ]
                  >
                : never
            : never
        : never
    : M extends [infer Last]
      ? Last // Return the last remaining handler in the array
      : MiddlewareHandler<Env>;

export type RouteMiddlewareParams<R extends RouteConfig> = OfHandlerType<
    MiddlewareToHandlerType<AsArray<R["middleware"]>>
>;

export type RouteConfigToEnv<R extends RouteConfig> =
    RouteMiddlewareParams<R> extends never ? Env : RouteMiddlewareParams<R>["env"];

export type RouteHandler<
    R extends RouteConfig,
    E extends Env = RouteConfigToEnv<R>,
    I extends Input = InputTypeParam<R> &
        InputTypeSearchParams<R> &
        InputTypeHeader<R> &
        InputTypeCookie<R> &
        InputTypeForm<R> &
        InputTypeJson<R>,
    P extends string = ConvertPathType<R["path"]>,
> = Handler<
    E,
    P,
    I,
    // If response type is defined, only TypedResponse is allowed.
    R extends {
        responses: {
            [statusCode: number]: {
                content: {
                    [mediaType: string]: ZodMediaTypeObject;
                };
            };
        };
    }
        ? MaybePromise<RouteConfigToTypedResponse<R>>
        : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>
>;

export type RouteHook<
    R extends RouteConfig,
    E extends Env = RouteConfigToEnv<R>,
    I extends Input = InputTypeParam<R> &
        InputTypeSearchParams<R> &
        InputTypeHeader<R> &
        InputTypeCookie<R> &
        InputTypeForm<R> &
        InputTypeJson<R>,
    P extends string = ConvertPathType<R["path"]>,
> = Hook<
    I,
    E,
    P,
    RouteConfigToTypedResponse<R> | Response | Promise<Response> | void | Promise<void>
>;

export type OpenAPIObjectConfig = Parameters<
    InstanceType<typeof OpenApiGeneratorV3>["generateDocument"]
>[0];

export type OpenAPIObjectConfigure<E extends Env, P extends string> =
    | OpenAPIObjectConfig
    | ((context: Context<E, P>) => OpenAPIObjectConfig);

export type OpenAPIGeneratorOptions = ConstructorParameters<typeof OpenApiGeneratorV3>[1];

export type OpenAPIGeneratorConfigure<E extends Env, P extends string> =
    | OpenAPIGeneratorOptions
    | ((context: Context<E, P>) => OpenAPIGeneratorOptions);

export type AnyInput<R extends RouteConfig> = InputTypeParam<R> &
    InputTypeSearchParams<R> &
    InputTypeHeader<R> &
    InputTypeCookie<R> &
    InputTypeForm<R> &
    InputTypeJson<R>;

export type ExtractParams<R> = R extends { request: { params: infer P } }
    ? P extends z.ZodType
        ? z.output<P>
        : never
    : undefined;

export type ExtractSearchParams<R> = R extends { request: { searchParams: infer Q } }
    ? Q extends z.ZodType
        ? z.output<Q>
        : never
    : undefined;

export type ExtractBody<R> = R extends {
    request: { body: { content: { "application/json": { schema: infer S } } } };
}
    ? S extends z.ZodType
        ? z.output<S>
        : never
    : undefined;

export type RouteContext<R extends RouteConfig> = {
    params: ExtractParams<R>;
    searchParams: ExtractSearchParams<R>;
    body: ExtractBody<R>;
    method: string;
    url: URL;
    headers: SuperHeaders;
    request: Request;
    // formData: FormData | undefined;
    // TODO: Pass through the correct generic types for the raw Hono.Context
    raw: Context;
};

export type ContextHandler<
    TRouteConfig extends RouteConfig,
    TResponse extends HandlerResponse<any> = any,
> = (c: RouteContext<TRouteConfig>, next: Next) => TResponse;

export type Router<
    E extends Env = Env,
    S extends Schema = {},
    BasePath extends string = "/",
> = OpenAPIHono<E, S, BasePath> & {
    map<R extends RouteConfig>(
        config: R,
        handler: ContextHandler<
            R,
            // If response type is defined, only TypedResponse is allowed.
            R extends {
                responses: {
                    [statusCode: number]: {
                        content: {
                            [mediaType: string]: ZodMediaTypeObject;
                        };
                    };
                };
            }
                ? MaybePromise<RouteConfigToTypedResponse<R>>
                : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>
        >,
    ): void;
};

export type RouterOptions<E extends Env = Env, BasePath extends string = "/"> = HonoInit<E> & {
    basePath?: BasePath;
    middleware?: MiddlewareHandler<E, BasePath, any> | MiddlewareHandler<E, BasePath, any>[];
};

export interface ResponseInit<T extends StatusCode = StatusCode> {
    headers?: SuperHeaders | Headers | SuperHeadersInit;
    status?: T;
    statusText?: string;
}
export type ResponseOrInit<T extends StatusCode = StatusCode> = ResponseInit<T> | Response;

/**
 * Interface for responding with JSON.
 *
 * @interface JSONRespond
 * @template T - The type of the JSON value or simplified unknown type.
 * @template U - The type of the status code.
 *
 * @param {T} object - The JSON object to be included in the response.
 * @param {U} [status] - An optional status code for the response.
 * @param {HeaderRecord} [headers] - An optional record of headers to include in the response.
 *
 * @returns {JSONRespondReturn<T, U>} - The response after rendering the JSON object, typed with the provided object and status code types.
 */
export interface JSONRespond {
    <
        T extends JSONValue | {} | InvalidJSONValue,
        U extends ContentfulStatusCode = ContentfulStatusCode,
    >(
        object: T,
        status?: U,
        headers?: SuperHeaders | Headers | SuperHeadersInit,
    ): JSONRespondReturn<T, U>;
    <
        T extends JSONValue | {} | InvalidJSONValue,
        U extends ContentfulStatusCode = ContentfulStatusCode,
    >(
        object: T,
        init?: ResponseOrInit<U>,
    ): JSONRespondReturn<T, U>;
}
/**
 * @template T - The type of the JSON value or simplified unknown type.
 * @template U - The type of the status code.
 *
 * @returns {Response & TypedResponse<JSONParsed<T>, U, 'json'>} - The response after rendering the JSON object, typed with the provided object and status code types.
 */
export type JSONRespondReturn<
    T extends JSONValue | {} | InvalidJSONValue,
    U extends ContentfulStatusCode,
> = Response & TypedResponse<JSONParsed<T>, U, "json">;

// Delimiters that end a param name – tweak as needed
export type ParamDelimiter = "/" | "." | "-" | ")" | "(" | "?" | "&" | ":" | "";

// Extract the param name after the colon, stopping at the first delimiter
export type ExtractParamName<
    S extends string,
    Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
    ? C extends ParamDelimiter
        ? Acc
        : ExtractParamName<Rest, `${Acc}${C}`>
    : Acc;

// Drop everything up to and including the param name, keep the rest
export type SkipParamName<S extends string> = S extends `${infer C}${infer Rest}`
    ? C extends ParamDelimiter
        ? `${C}${Rest}` // we hit delimiter: keep it and the rest
        : SkipParamName<Rest>
    : "";
