import * as introspector from "@langion/introspector";

export interface Connection<O extends string, E extends string> {
    origin: O;
    emission: E;
}

export interface Emit<O extends string, E extends string> extends Connection<O, E> {
    headlines: string[];
    lines: string[];
    connections: Array<Connection<O, E>>;
}

export interface TypeInfo<O extends string, E extends string> {
    type: introspector.Type<O>;
    typeLocation: Connection<O, E>;
    requestedFrom: Connection<O, E>;
    emit: Record<O, Emit<O, E>>;
}

export interface TypeScriptTypeGetter<O extends string, E extends string> extends TypeInfo<O, E> {
    kind: "TypeScript";
}

export interface GraphQLTypeGetter<O extends string, E extends string> extends TypeInfo<O, E> {
    kind: "GraphQL";
    isInputType?: boolean;
}

export type TypeDesc<O extends string, E extends string> = TypeScriptTypeGetter<O, E> | GraphQLTypeGetter<O, E>;

export interface Context<O extends string, E extends string> {
    emit: Emit<O, E>;
    requestedFrom: Connection<O, E>;
    introspection: introspector.Introspection<O>;
}
