import * as introspector from "@langion/introspector";
import * as _ from "lodash";
import { GraphqlDefinition } from "../../emitters";
import * as types from "../../typings";
import { Reference } from "../../typings";
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
            let line = generics.join();

            if (!line) {
                line = this.getRawType();
            }

            name = `new graphql.GraphQLList(${line})`;
            return name;
        } else if (this.desc.type.kind === introspector.TypeKind.Map) {
            return this.getRawType();
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

    public getRawType(): string {
        const emitter = this.type.prism.getEmitter(GraphqlDefinition) as GraphqlDefinition<O, E, types.Context<O, E>>;

        const reference: Reference = {
            import: "{Raw}",
            path: emitter.props.rawTypePath,
        };

        const emit = this.type.prism.getEmit(this.desc.emit, this.desc.requestedFrom);
        emit.connections.push(reference);

        return "Raw";
    }

    private mapType(kind: introspector.TypeKind) {
        switch (kind) {
            case introspector.TypeKind.Boolean:
                return "graphql.GraphQLBoolean";
            case introspector.TypeKind.Date:
                return this.getRawType();
            case introspector.TypeKind.Number:
                return "graphql.GraphQLFloat";
            case introspector.TypeKind.String:
                return "graphql.GraphQLString";
            case introspector.TypeKind.Object:
                return this.getRawType();
            case introspector.TypeKind.Void:
                return this.getRawType();
            default:
                return "";
        }
    }
}
