import * as introspector from "@langion/introspector";
import * as _ from "lodash";
import { GraphqlDefinition } from "../../emitters";
import * as types from "../../typings";
import { BaseType } from "./BaseType";
import { Type } from "./Type";

export class GraphQLType<O extends string, E extends string> extends BaseType<O, E> {
    constructor(private desc: types.GraphQLTypeGetter<O, E>, type: Type<O, E>) {
        super(type);
    }

    public get() {
        let name = this.mapType(this.desc.type.kind);

        if (name) {
            return name;
        }

        if (this.desc.type.kind === introspector.TypeKind.TypeParameter) {
            return `${this.desc.type.name}!`;
        }

        name = this.desc.type.name;

        const generics = this.getGenerics(this.desc);

        if (this.desc.type.kind === introspector.TypeKind.List) {
            const line = generics.join();
            name = `new graphql.GraphQLList(${line})`;
            return name;
        } else if (this.desc.type.kind === introspector.TypeKind.Map) {
            return this.getGqlAnyType();
        }

        const prefix = this.getAnotherFilePrefix(this.desc);

        if (prefix) {
            name = `${prefix}.${name}`;
        }

        const genericLine = generics.join();

        if (this.desc.type.kind === introspector.TypeKind.Enumeration) {
            return name;
        }

        if (_.isNil(this.desc.isInputType)) {
            name = `${name}(isInput, ${genericLine})`;
        } else {
            name = `${name}(${this.desc.isInputType}, ${genericLine})`;
        }

        return name;
    }

    public getGqlAnyType(): string {
        const type: introspector.Type<O> = {
            name: "Any",
            origin: this.type.prism.config.unknown.origin,
            comment: "",
            generics: {},
            isDuplicate: false,
            kind: introspector.TypeKind.Entity,
        };

        const emitter = this.type.prism.getEmitter(GraphqlDefinition);

        const anyTypePath = this.type.get({
            kind: "TypeScript",
            type,
            emit: this.desc.emit,
            requestedFrom: this.desc.requestedFrom,
            typeLocation: {
                emission: emitter.emission,
                origin: type.origin,
            },
        });

        return anyTypePath;
    }

    private mapType(kind: introspector.TypeKind) {
        switch (kind) {
            case introspector.TypeKind.Boolean:
                return "graphql.GraphQLBoolean";
            case introspector.TypeKind.Date:
                return this.getGqlAnyType();
            case introspector.TypeKind.Number:
                return "graphql.GraphQLFloat";
            case introspector.TypeKind.String:
                return "graphql.GraphQLString";
            case introspector.TypeKind.Object:
                return this.getGqlAnyType();
            case introspector.TypeKind.Void:
                return this.getGqlAnyType();
            default:
                return "";
        }
    }
}
